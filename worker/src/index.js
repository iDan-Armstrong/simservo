// SIMServo accounts: a Cloudflare Worker in front of one Durable Object.
// The Worker handles CORS; the Durable Object owns all state, so every write is serialized.

import { DurableObject } from "cloudflare:workers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Accounts, ApiError, sha256 } from "./core.js";
import { route } from "./router.js";

const WEBAUTHN = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};

function origins(env) {
  return String(env.ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cors(req, env) {
  const origin = req.headers.get("Origin");
  const h = { Vary: "Origin" };
  if (origin && origins(env).includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, PUT, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    const origin = req.headers.get("Origin");
    if (origin && !h["Access-Control-Allow-Origin"]) {
      return Response.json({ error: "origin_not_allowed" }, { status: 403, headers: h });
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    const url = new URL(req.url);
    if (url.pathname === "/health") return Response.json({ ok: true }, { headers: h });

    // the client address is only ever stored hashed, for rate limiting
    const ip = req.headers.get("CF-Connecting-IP") || "local";
    const fwd = new Request(req);
    fwd.headers.set("X-Client-Key", (await sha256(`${env.RP_ID}|${ip}`)).slice(0, 22));

    const stub = env.ACCOUNTS.get(env.ACCOUNTS.idFromName("global"));
    const res = await stub.fetch(fwd);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
    return out;
  },
};

export class AccountStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const store = {
      get: (k) => ctx.storage.get(k),
      put: (k, v) => ctx.storage.put(k, v),
      delete: (k) => ctx.storage.delete(k),
    };
    this.accounts = new Accounts(
      store,
      { rpID: env.RP_ID, rpName: env.RP_NAME || "SIMServo", origins: origins(env) },
      WEBAUTHN,
    );
  }

  async fetch(req) {
    try {
      return Response.json(await route(this.accounts, req), { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof ApiError) {
        return Response.json({ error: e.code, message: e.message }, { status: e.status });
      }
      console.error(e);
      return Response.json({ error: "server_error", message: "Something went wrong on the server." }, { status: 500 });
    }
  }
}
