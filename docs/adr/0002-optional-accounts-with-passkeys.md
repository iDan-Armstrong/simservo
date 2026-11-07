# 0002. Optional accounts with passkeys on a Cloudflare Worker

Status: accepted (2026-11-07)

## Context

A shift lives in `localStorage`. That is enough for one browser, but a player who
starts on a laptop cannot continue on a phone, and clearing site data loses the
career. Players asked for a way to keep progress.

An account system brings its own risks. Passwords mean storing hashes, resets, and an
email address to send them to. A game this size should not hold anything worth
stealing.

## Decision

Accounts are optional and use passkeys (WebAuthn) only. No password, no email.

- A small Cloudflare Worker (`worker/`) in front of one SQLite-backed Durable Object.
  The Durable Object serializes every write, so a callsign cannot be claimed twice and
  no database server is needed.
- The account logic lives in `worker/src/core.js` and talks to storage through
  `get`, `put` and `delete` only. The WebAuthn verifiers are passed in. Node tests run
  it against an in-memory map with stub verifiers; the end-to-end test runs the real
  Worker under `wrangler dev` with Chromium's virtual authenticator.
- What is stored: the callsign, each passkey's public key and signature counter, the
  save, and session records. A session token is 32 random bytes; the server keeps only
  its SHA-256 hash. Client addresses are hashed before they are used as rate-limit keys
  and never stored as written.
- Challenges are single use and expire after five minutes. Sessions expire after
  30 days. Saves are capped at 256 KB.
- The Worker answers only origins on its allowlist. The relying party ID is
  `idan-armstrong.github.io`, the host GitHub Pages serves the game from.
- Saves stay local first. The client writes `localStorage`, then uploads a few
  seconds later. On sign-in the newer save wins by the time the client recorded it;
  a local shift that loses is kept in a backup key, not discarded.
- The feature is off until `site/js/config.js` names the service, so the game works
  the same with or without it.
- Deleting an account removes the callsign, passkeys and save on the server. The copy
  in the browser stays.

## Consequences

- Nothing on the server is useful to an attacker: public keys and game saves.
- A player who loses every device with the passkey loses the account. Passkey
  managers sync across devices, which covers the common case.
- One Durable Object is a single point of serialization. At this game's scale that
  is a feature, not a limit; sharding by user would be the next step if it ever mattered.
- Deploys come from Cloudflare's Git integration (Workers Builds), so no Cloudflare
  token lives in this repository or in GitHub Actions.
