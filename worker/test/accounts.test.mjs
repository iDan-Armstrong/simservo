import { test } from "node:test";
import assert from "node:assert/strict";
import { Accounts, ApiError, LIMITS, MAX_SAVE_BYTES, SESSION_TTL, randomId, sha256 } from "../src/core.js";
import { route } from "../src/router.js";

// In-memory stand-in for Durable Object storage. Values are cloned like the real store.
function memStore() {
  const m = new Map();
  return {
    m,
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined),
    put: async (k, v) => void m.set(k, structuredClone(v)),
    delete: async (k) => m.delete(k),
  };
}

// Stub WebAuthn: a "passkey" is {id}; verification passes when the response echoes the challenge.
function fakeWebAuthn() {
  return {
    async generateRegistrationOptions(o) {
      return { challenge: randomId(32), rp: { id: o.rpID, name: o.rpName }, user: { name: o.userName } };
    },
    async verifyRegistrationResponse(o) {
      if (o.response?.challenge !== o.expectedChallenge) return { verified: false };
      return {
        verified: true,
        registrationInfo: { credential: { id: o.response.id, publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] } },
      };
    },
    async generateAuthenticationOptions(o) {
      return { challenge: randomId(32), rpId: o.rpID };
    },
    async verifyAuthenticationResponse(o) {
      if (o.response?.challenge !== o.expectedChallenge) return { verified: false };
      assert.deepEqual([...o.credential.publicKey], [1, 2, 3]);
      return { verified: true, authenticationInfo: { newCounter: o.credential.counter + 1 } };
    },
  };
}

function setup() {
  const store = memStore();
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => (t += ms) };
  const a = new Accounts(store, { rpID: "localhost", rpName: "SIMServo", origins: ["http://localhost:8080"] }, fakeWebAuthn(), clock.now);
  return { a, store, clock };
}

async function signUp(a, callsign = "Night-Owl", credId = "cred-1") {
  const { challengeId, options } = await a.registerOptions({ callsign });
  return a.registerVerify({ challengeId, response: { id: credId, challenge: options.challenge } });
}

async function rejects(p, code) {
  await assert.rejects(p, (e) => e instanceof ApiError && e.code === code);
}

test("sign up returns a session and stores only the token's hash", async () => {
  const { a, store } = setup();
  const s = await signUp(a);
  assert.equal(s.callsign, "Night-Owl");
  assert.ok(s.token.length >= 40);
  const keys = [...store.m.keys()];
  assert.ok(keys.includes(`sess:${await sha256(s.token)}`));
  assert.ok(!JSON.stringify([...store.m]).includes(s.token), "raw token must not be stored");
  assert.equal((await a.me(s.token)).callsign, "Night-Owl");
});

test("callsigns are validated and unique regardless of case", async () => {
  const { a } = setup();
  await rejects(a.registerOptions({ callsign: "ab" }), "bad_callsign");
  await rejects(a.registerOptions({ callsign: "has space" }), "bad_callsign");
  await rejects(a.registerOptions({ callsign: "<script>" }), "bad_callsign");
  await signUp(a, "Night-Owl");
  await rejects(a.registerOptions({ callsign: "night-owl" }), "callsign_taken");
});

test("a callsign claimed while the prompt was open is refused at verify", async () => {
  const { a } = setup();
  const first = await a.registerOptions({ callsign: "Racer" });
  await signUp(a, "Racer", "cred-other");
  await rejects(a.registerVerify({ challengeId: first.challengeId, response: { id: "cred-2", challenge: first.options.challenge } }), "callsign_taken");
});

test("challenges are single use and expire", async () => {
  const { a, clock } = setup();
  const { challengeId, options } = await a.registerOptions({ callsign: "Replay" });
  const bad = { challengeId, response: { id: "c", challenge: "wrong" } };
  await rejects(a.registerVerify(bad), "not_verified");
  // the failed attempt consumed the challenge
  await rejects(a.registerVerify({ challengeId, response: { id: "c", challenge: options.challenge } }), "bad_challenge");

  const late = await a.registerOptions({ callsign: "Late" });
  clock.advance(6 * 60 * 1000);
  await rejects(a.registerVerify({ challengeId: late.challengeId, response: { id: "c", challenge: late.options.challenge } }), "bad_challenge");
});

test("a register challenge cannot be used to sign in", async () => {
  const { a } = setup();
  await signUp(a, "Mixer", "cred-m");
  const { challengeId, options } = await a.registerOptions({ callsign: "Other" });
  await rejects(a.loginVerify({ challengeId, response: { id: "cred-m", challenge: options.challenge } }), "bad_challenge");
});

test("sign in with a registered passkey bumps the counter and opens a new session", async () => {
  const { a, store } = setup();
  const first = await signUp(a, "Pilot", "cred-p");
  const { challengeId, options } = await a.loginOptions();
  const s = await a.loginVerify({ challengeId, response: { id: "cred-p", challenge: options.challenge } });
  assert.equal(s.callsign, "Pilot");
  assert.notEqual(s.token, first.token);
  assert.equal((await store.get("cred:cred-p")).counter, 1);
});

test("unknown passkeys and bad signatures are refused", async () => {
  const { a } = setup();
  await signUp(a, "Pilot", "cred-p");
  let o = await a.loginOptions();
  await rejects(a.loginVerify({ challengeId: o.challengeId, response: { id: "nope", challenge: o.options.challenge } }), "unknown_passkey");
  o = await a.loginOptions();
  await rejects(a.loginVerify({ challengeId: o.challengeId, response: { id: "cred-p", challenge: "forged" } }), "not_verified");
});

test("a verifier that throws counts as not verified", async () => {
  const { a } = setup();
  a.wa.verifyRegistrationResponse = async () => {
    throw new Error("bad attestation");
  };
  const { challengeId, options } = await a.registerOptions({ callsign: "Thrower" });
  await rejects(a.registerVerify({ challengeId, response: { id: "c", challenge: options.challenge } }), "not_verified");
});

test("sessions expire after 30 days and logout ends one", async () => {
  const { a, clock } = setup();
  const s = await signUp(a);
  await a.me(s.token);
  await a.logout(s.token);
  await rejects(a.me(s.token), "signed_out");

  const s2 = await (async () => {
    const o = await a.loginOptions();
    return a.loginVerify({ challengeId: o.challengeId, response: { id: "cred-1", challenge: o.options.challenge } });
  })();
  clock.advance(SESSION_TTL + 1);
  await rejects(a.me(s2.token), "signed_out");
  await rejects(a.me(""), "signed_out");
  await rejects(a.me(undefined), "signed_out");
});

test("saves round-trip, are per user, and are size-capped", async () => {
  const { a, clock } = setup();
  const s = await signUp(a, "Saver", "cred-s");
  assert.deepEqual(await a.getSave(s.token), { save: null, updated: null });
  const game = { version: 1, tier: 3, cash: 1200, savedAt: 42 };
  clock.advance(10);
  const put = await a.putSave(s.token, JSON.stringify({ save: game }));
  assert.equal(put.updated, 1_000_010);
  assert.deepEqual((await a.getSave(s.token)).save, game);
  assert.equal((await a.me(s.token)).savedAt, 1_000_010);

  const other = await signUp(a, "Other", "cred-o");
  assert.equal((await a.getSave(other.token)).save, null);

  await rejects(a.putSave(s.token, "x".repeat(MAX_SAVE_BYTES + 1)), "save_too_large");
  await rejects(a.putSave(s.token, "{not json"), "bad_save");
  await rejects(a.putSave(s.token, "[1,2]"), "bad_save");
  await rejects(a.putSave(s.token, JSON.stringify({ nosave: 1 })), "bad_save");
  await rejects(a.putSave("forged-token-forged-token", JSON.stringify({ save: {} })), "signed_out");
});

test("delete account removes the user, passkey, save and callsign, and ends every session", async () => {
  const { a, store } = setup();
  const s = await signUp(a, "Gone", "cred-g");
  const o = await a.loginOptions();
  const s2 = await a.loginVerify({ challengeId: o.challengeId, response: { id: "cred-g", challenge: o.options.challenge } });
  await a.putSave(s.token, JSON.stringify({ save: { tier: 1 } }));
  await a.deleteAccount(s.token);
  await rejects(a.me(s.token), "signed_out");
  await rejects(a.me(s2.token), "signed_out");
  const left = [...store.m.keys()].filter((k) => !k.startsWith("rl:") && !k.startsWith("sess:"));
  assert.deepEqual(left, []);
  // the callsign is free again
  await signUp(a, "Gone", "cred-g2");
});

test("rate limits per client and window", async () => {
  const { a, clock } = setup();
  for (let i = 0; i < LIMITS.auth.max; i++) await a.limit("auth", "client-a");
  await rejects(a.limit("auth", "client-a"), "rate_limited");
  await a.limit("auth", "client-b");
  clock.advance(LIMITS.auth.windowMs);
  await a.limit("auth", "client-a");
});

test("router maps endpoints, reads the bearer token, and 404s the rest", async () => {
  const { a } = setup();
  const req = (method, path, body, token) =>
    new Request(`http://x${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  const ro = await route(a, req("POST", "/register/options", { callsign: "Router" }));
  const s = await route(a, req("POST", "/register/verify", { challengeId: ro.challengeId, response: { id: "r", challenge: ro.options.challenge } }));
  await route(a, req("PUT", "/save", { save: { tier: 2 } }, s.token));
  assert.deepEqual((await route(a, req("GET", "/save", undefined, s.token))).save, { tier: 2 });
  assert.equal((await route(a, req("GET", "/me", undefined, s.token))).callsign, "Router");
  await assert.rejects(route(a, req("GET", "/nope")), (e) => e.status === 404);
  await assert.rejects(route(a, req("POST", "/register/options", "{bad")), (e) => e.code === "bad_json");
  await route(a, req("POST", "/logout", undefined, s.token));
  await assert.rejects(route(a, req("GET", "/me", undefined, s.token)), (e) => e.status === 401);
});
