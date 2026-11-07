// Maps HTTP requests to Accounts methods. Kept free of Worker-only imports so tests can call it.

import { ApiError } from "./core.js";

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get("Authorization") || "");
  return m ? m[1] : "";
}

async function json(req) {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "bad_json", "The request body is not valid JSON.");
  }
}

export async function route(accounts, req) {
  const { pathname } = new URL(req.url);
  const client = req.headers.get("X-Client-Key") || "local";
  const key = `${req.method} ${pathname}`;

  switch (key) {
    case "POST /register/options":
      await accounts.limit("auth", client);
      return accounts.registerOptions(await json(req));
    case "POST /register/verify":
      await accounts.limit("auth", client);
      return accounts.registerVerify(await json(req));
    case "POST /login/options":
      await accounts.limit("auth", client);
      return accounts.loginOptions();
    case "POST /login/verify":
      await accounts.limit("auth", client);
      return accounts.loginVerify(await json(req));
    case "GET /me":
      return accounts.me(bearer(req));
    case "GET /save":
      await accounts.limit("save", client);
      return accounts.getSave(bearer(req));
    case "PUT /save":
      await accounts.limit("save", client);
      return accounts.putSave(bearer(req), await req.text());
    case "POST /logout":
      return accounts.logout(bearer(req));
    case "DELETE /account":
      await accounts.limit("auth", client);
      return accounts.deleteAccount(bearer(req));
    default:
      throw new ApiError(404, "not_found", "No such endpoint.");
  }
}
