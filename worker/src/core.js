// Account logic for SIMServo: passkey sign-up and sign-in, sessions, and cloud saves.
//
// Everything here works against a small storage interface ({get, put, delete}) and a
// set of injected WebAuthn functions, so the Node tests can run it without a Worker
// runtime or a real authenticator. src/index.js wires it to a Durable Object.

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 30 * DAY;
export const CHALLENGE_TTL = 5 * 60 * 1000;
export const MAX_SAVE_BYTES = 256 * 1024;
export const CALLSIGN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/;

// Requests allowed per hashed client address per window.
export const LIMITS = {
  auth: { max: 20, windowMs: 10 * 60 * 1000 },
  save: { max: 120, windowMs: 10 * 60 * 1000 },
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const enc = new TextEncoder();

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function randomId(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))));
}

function cleanCallsign(raw) {
  const c = String(raw ?? "").trim();
  if (!CALLSIGN_RE.test(c)) {
    throw new ApiError(400, "bad_callsign", "Callsign must be 3 to 24 letters, numbers, dashes or underscores.");
  }
  return c;
}

export class Accounts {
  /**
   * @param store  {get(key), put(key, value), delete(key)}; values are plain JSON
   * @param config {rpID, rpName, origins: string[]}
   * @param webauthn the four @simplewebauthn/server functions (stubbed in tests)
   * @param now    clock in ms
   */
  constructor(store, config, webauthn, now = () => Date.now()) {
    this.store = store;
    this.config = config;
    this.wa = webauthn;
    this.now = now;
  }

  // ---- rate limiting ----

  async limit(kind, clientKey) {
    const { max, windowMs } = LIMITS[kind];
    const win = Math.floor(this.now() / windowMs);
    const key = `rl:${kind}:${clientKey}:${win}`;
    const n = ((await this.store.get(key)) ?? 0) + 1;
    await this.store.put(key, n);
    if (n === 1) {
      // drop the previous window's counter so the table stays small
      await this.store.delete(`rl:${kind}:${clientKey}:${win - 1}`);
    }
    if (n > max) throw new ApiError(429, "rate_limited", "Too many requests. Try again in a few minutes.");
  }

  // ---- challenges: single use, short lived ----

  // `challenge` is options.challenge as the library returned it (base64url), which is
  // exactly what the verify functions expect back
  async saveChallenge(kind, challenge, extra = {}) {
    const id = randomId(16);
    await this.store.put(`chal:${id}`, { kind, challenge, expires: this.now() + CHALLENGE_TTL, ...extra });
    return id;
  }

  async takeChallenge(id, kind) {
    if (typeof id !== "string" || !id) throw new ApiError(400, "bad_challenge", "Missing challenge.");
    const c = await this.store.get(`chal:${id}`);
    await this.store.delete(`chal:${id}`);
    if (!c || c.kind !== kind || c.expires < this.now()) {
      throw new ApiError(400, "bad_challenge", "That sign-in attempt expired. Try again.");
    }
    return c;
  }

  // ---- sign up ----

  async registerOptions(body) {
    const callsign = cleanCallsign(body?.callsign);
    if (await this.store.get(`name:${callsign.toLowerCase()}`)) {
      throw new ApiError(409, "callsign_taken", "That callsign is taken.");
    }
    const userId = randomId(16);
    const options = await this.wa.generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userName: callsign,
      userID: fromB64url(userId),
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const challengeId = await this.saveChallenge("register", options.challenge, { userId, callsign });
    return { challengeId, options };
  }

  async registerVerify(body) {
    const c = await this.takeChallenge(body?.challengeId, "register");
    let result;
    try {
      result = await this.wa.verifyRegistrationResponse({
        response: body?.response,
        expectedChallenge: c.challenge,
        expectedOrigin: this.config.origins,
        expectedRPID: this.config.rpID,
        requireUserVerification: false,
      });
    } catch {
      result = { verified: false };
    }
    if (!result?.verified) throw new ApiError(400, "not_verified", "The passkey could not be verified.");

    // the callsign may have been claimed while the browser prompt was open
    const nameKey = `name:${c.callsign.toLowerCase()}`;
    if (await this.store.get(nameKey)) throw new ApiError(409, "callsign_taken", "That callsign is taken.");

    const cred = result.registrationInfo.credential;
    if (await this.store.get(`cred:${cred.id}`)) throw new ApiError(409, "credential_exists", "That passkey is already registered.");

    await this.store.put(`cred:${cred.id}`, {
      userId: c.userId,
      publicKey: b64url(cred.publicKey),
      counter: cred.counter ?? 0,
      transports: cred.transports ?? [],
    });
    await this.store.put(`user:${c.userId}`, {
      id: c.userId,
      callsign: c.callsign,
      created: this.now(),
      credIds: [cred.id],
    });
    await this.store.put(nameKey, c.userId);
    return this.newSession(c.userId, c.callsign);
  }

  // ---- sign in (discoverable credentials: no username needed) ----

  async loginOptions() {
    const options = await this.wa.generateAuthenticationOptions({
      rpID: this.config.rpID,
      userVerification: "preferred",
    });
    const challengeId = await this.saveChallenge("login", options.challenge);
    return { challengeId, options };
  }

  async loginVerify(body) {
    const c = await this.takeChallenge(body?.challengeId, "login");
    const credId = body?.response?.id;
    const cred = typeof credId === "string" ? await this.store.get(`cred:${credId}`) : null;
    if (!cred) throw new ApiError(400, "unknown_passkey", "That passkey is not registered here.");
    let result;
    try {
      result = await this.wa.verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: c.challenge,
        expectedOrigin: this.config.origins,
        expectedRPID: this.config.rpID,
        credential: {
          id: credId,
          publicKey: fromB64url(cred.publicKey),
          counter: cred.counter,
          transports: cred.transports,
        },
        requireUserVerification: false,
      });
    } catch {
      result = { verified: false };
    }
    if (!result?.verified) throw new ApiError(400, "not_verified", "The passkey could not be verified.");
    await this.store.put(`cred:${credId}`, { ...cred, counter: result.authenticationInfo.newCounter });
    const user = await this.store.get(`user:${cred.userId}`);
    if (!user) throw new ApiError(400, "unknown_passkey", "That passkey is not registered here.");
    return this.newSession(user.id, user.callsign);
  }

  // ---- sessions: the token goes to the browser, only its hash is stored ----

  async newSession(userId, callsign) {
    const token = randomId(32);
    const expires = this.now() + SESSION_TTL;
    await this.store.put(`sess:${await sha256(token)}`, { userId, expires });
    return { token, callsign, expires };
  }

  async auth(token) {
    if (typeof token !== "string" || token.length < 20) throw new ApiError(401, "signed_out", "Sign in again.");
    const key = `sess:${await sha256(token)}`;
    const s = await this.store.get(key);
    if (!s || s.expires < this.now()) {
      if (s) await this.store.delete(key);
      throw new ApiError(401, "signed_out", "Sign in again.");
    }
    const user = await this.store.get(`user:${s.userId}`);
    if (!user) {
      await this.store.delete(key);
      throw new ApiError(401, "signed_out", "Sign in again.");
    }
    return { user, sessionKey: key };
  }

  async me(token) {
    const { user } = await this.auth(token);
    const save = await this.store.get(`save:${user.id}`);
    return { callsign: user.callsign, created: user.created, savedAt: save?.updated ?? null };
  }

  async logout(token) {
    const { sessionKey } = await this.auth(token);
    await this.store.delete(sessionKey);
    return { ok: true };
  }

  // ---- saves ----

  async getSave(token) {
    const { user } = await this.auth(token);
    const save = await this.store.get(`save:${user.id}`);
    return save ? { save: JSON.parse(save.json), updated: save.updated } : { save: null, updated: null };
  }

  async putSave(token, rawBody) {
    const { user } = await this.auth(token);
    if (typeof rawBody !== "string" || enc.encode(rawBody).length > MAX_SAVE_BYTES) {
      throw new ApiError(413, "save_too_large", "That save is larger than 256 KB.");
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new ApiError(400, "bad_save", "The save is not valid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("save" in parsed)) {
      throw new ApiError(400, "bad_save", "Expected {\"save\": {...}}.");
    }
    const json = JSON.stringify(parsed.save);
    const updated = this.now();
    await this.store.put(`save:${user.id}`, { json, updated });
    return { ok: true, updated };
  }

  // ---- delete account: user, passkeys, saves, the current session ----

  async deleteAccount(token) {
    const { user, sessionKey } = await this.auth(token);
    for (const id of user.credIds) await this.store.delete(`cred:${id}`);
    await this.store.delete(`save:${user.id}`);
    await this.store.delete(`name:${user.callsign.toLowerCase()}`);
    await this.store.delete(`user:${user.id}`);
    await this.store.delete(sessionKey);
    // any other session tokens for this user now fail auth() because the user is gone
    return { ok: true };
  }
}
