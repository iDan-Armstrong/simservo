// Optional accounts: sign up and sign in with a passkey, keep the shift saved on the server.
// Off unless an API address is configured (config.js, or ?api= for testing).
// The game still saves to localStorage first; the server copy follows a few seconds later.

import { ACCOUNT_API } from "./config.js";

const SESSION_KEY = "simservo.session.v1";
const PUSH_DELAY = 3000;

function apiBase() {
  const override = new URLSearchParams(location.search).get("api");
  const base = override && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override) ? override : ACCOUNT_API;
  return (base || "").replace(/\/+$/, "");
}

export function accountsAvailable() {
  return Boolean(apiBase()) && typeof window.PublicKeyCredential === "function";
}

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s && s.expires > Date.now() ? s : null;
  } catch { return null; }
}
function writeSession(s) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export class AccountError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

async function call(method, path, body, { token, keepalive = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(apiBase() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), keepalive });
  } catch {
    throw new AccountError("offline", "Could not reach the account service. Your progress is still saved in this browser.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AccountError(data.error || "http_error", data.message || `The account service answered ${res.status}.`, res.status);
  return data;
}

let webauthnLoad = null;
function webauthn() {
  // the helper is only fetched when someone actually uses an account
  webauthnLoad ??= new Promise((resolve, reject) => {
    if (window.SimpleWebAuthnBrowser) return resolve(window.SimpleWebAuthnBrowser);
    const s = document.createElement("script");
    s.src = "vendor/simplewebauthn-browser.umd.min.js";
    s.onload = () => resolve(window.SimpleWebAuthnBrowser);
    s.onerror = () => { webauthnLoad = null; reject(new AccountError("load_failed", "Could not load the passkey helper.")); };
    document.head.appendChild(s);
  });
  return webauthnLoad;
}

function cancelled(err) {
  // the person closed the browser's passkey prompt
  return err && (err.name === "NotAllowedError" || err.name === "AbortError");
}

export class Account {
  constructor() {
    this.session = readSession();
    this.timer = null;
    this.pending = null;
    this.onChange = () => {};
  }

  get signedIn() { return Boolean(this.session); }
  get callsign() { return this.session?.callsign ?? null; }

  setSession(s) {
    this.session = s ? { token: s.token, callsign: s.callsign, expires: s.expires } : null;
    writeSession(this.session);
    this.onChange(this);
  }

  async signUp(callsign) {
    const { startRegistration } = await webauthn();
    const { challengeId, options } = await call("POST", "/register/options", { callsign });
    let response;
    try { response = await startRegistration({ optionsJSON: options }); } catch (e) {
      if (cancelled(e)) throw new AccountError("cancelled", "Passkey creation was cancelled.");
      throw new AccountError("webauthn", e.message || "This browser could not create a passkey.");
    }
    this.setSession(await call("POST", "/register/verify", { challengeId, response }));
  }

  async signIn() {
    const { startAuthentication } = await webauthn();
    const { challengeId, options } = await call("POST", "/login/options", {});
    let response;
    try { response = await startAuthentication({ optionsJSON: options }); } catch (e) {
      if (cancelled(e)) throw new AccountError("cancelled", "Sign-in was cancelled.");
      throw new AccountError("webauthn", e.message || "This browser could not use a passkey.");
    }
    this.setSession(await call("POST", "/login/verify", { challengeId, response }));
  }

  async signOut() {
    await this.flush();
    const token = this.session?.token;
    this.setSession(null);
    if (token) await call("POST", "/logout", {}, { token }).catch(() => {});
  }

  async deleteAccount() {
    clearTimeout(this.timer);
    this.pending = null;
    await this.authed("DELETE", "/account");
    this.setSession(null);
  }

  // a 401 means the session ended on the server: sign out here too
  async authed(method, path, body, opts = {}) {
    try {
      return await call(method, path, body, { ...opts, token: this.session?.token });
    } catch (e) {
      if (e.status === 401) this.setSession(null);
      throw e;
    }
  }

  /** The server copy: {state, savedAt} or null. */
  async pull() {
    const { save } = await this.authed("GET", "/save");
    return save && save.state ? save : null;
  }

  /** Queue the latest state for upload; only the newest one is sent. */
  push(state, savedAt) {
    if (!this.signedIn) return;
    this.pending = { state, savedAt };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush().catch(() => {}), PUSH_DELAY);
  }

  async flush({ keepalive = false } = {}) {
    clearTimeout(this.timer);
    const p = this.pending;
    if (!p || !this.signedIn) return;
    this.pending = null;
    try {
      await this.authed("PUT", "/save", { save: p }, { keepalive });
    } catch (e) {
      if (e.status !== 401 && !this.pending) this.pending = p; // retry with the next save
      throw e;
    }
  }
}
