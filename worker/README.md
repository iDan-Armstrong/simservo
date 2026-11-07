# simservo-accounts

The optional account service for SIMServo: passkey sign-up and sign-in, sessions,
and cloud saves. One Cloudflare Worker and one SQLite-backed Durable Object.
Why it looks like this: [ADR 0002](../docs/adr/0002-optional-accounts-with-passkeys.md).

| File | What it does |
| --- | --- |
| `src/core.js` | All account logic, over a `get`/`put`/`delete` store and injected WebAuthn verifiers |
| `src/router.js` | HTTP method and path to `core.js` calls |
| `src/index.js` | Worker entry (CORS, origin allowlist) and the `AccountStore` Durable Object |
| `test/accounts.test.mjs` | Node tests against an in-memory store |
| `wrangler.toml` | Name, Durable Object binding and migration, relying party settings |

## Endpoints

| Method and path | Body or header | Returns |
| --- | --- | --- |
| `POST /register/options` | `{callsign}` | `{challengeId, options}` for `startRegistration` |
| `POST /register/verify` | `{challengeId, response}` | `{token, callsign, expires}` |
| `POST /login/options` | none | `{challengeId, options}` for `startAuthentication` |
| `POST /login/verify` | `{challengeId, response}` | `{token, callsign, expires}` |
| `GET /me` | `Authorization: Bearer` | `{callsign, created, savedAt}` |
| `GET /save` | `Authorization: Bearer` | `{save, updated}` |
| `PUT /save` | `Authorization: Bearer`, `{save}` up to 256 KB | `{ok, updated}` |
| `POST /logout` | `Authorization: Bearer` | `{ok}` |
| `DELETE /account` | `Authorization: Bearer` | `{ok}` |
| `GET /health` | none | `{ok}` |

Errors come back as `{error, message}` with a 4xx status.

## Test

```bash
cd worker
npm ci
npm test                              # logic, in Node
cd .. && npm run build && npm run e2e:accounts   # real Worker + virtual passkey in Chromium
```

## Run it locally

```bash
cd worker && npm run dev              # http://localhost:8787, relying party "localhost"
# in another shell, from the repo root
npm run serve                         # http://localhost:8080/?api=http://localhost:8787
```

## Deploy (Cloudflare dashboard, no token needed)

1. Cloudflare dashboard, Workers & Pages, Create, Import a repository.
2. Pick `iDan-Armstrong/simservo`. Set the root directory to `worker`.
   Build command: `npm ci`. Deploy command: `npx wrangler deploy`.
3. Deploy. The first deploy creates the `AccountStore` Durable Object from the
   migration in `wrangler.toml`.
4. Copy the Worker's address (for example `https://simservo-accounts.<subdomain>.workers.dev`)
   into `ACCOUNT_API` in `site/js/config.js` and push. Pages republishes the game with
   the account panel turned on.

`RP_ID` and `ORIGINS` in `wrangler.toml` must match where the game is served. If the
game moves to a custom domain, change both and redeploy; passkeys made for the old
host will not work on the new one.
