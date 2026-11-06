# RPChess RU API gateway — Netlify Free

This independent Netlify site uses **CDN proxy rewrites**, not per-request Functions. It forwards both Tournament and RPChess Profile API traffic to the existing Cloudflare Workers, retaining the same Durable Objects and D1 state. A single Edge Function at /geo supplies a non-authenticated country hint.

Netlify project: https://app.netlify.com/projects/rpchess-ru-api-gateway . Public hostname: https://rpchess-ru-api-gateway.netlify.app (confirmed live on 2026-11-06, including all three /geo and /health endpoints from Russia without VPN).

## First deployment (one-time owner action)

Connect GitHub repository `mobigametim-bit/RPChess` to the new Netlify project. Set **Base directory** to `netlify-gateway` (there is no Package directory field on this setup screen), **Publish directory** to `public`, and clear the suggested build command (leave it empty). The gateway's own `netlify.toml` is relative to the chosen base directory. Use branch `feature/ru-netlify-gateway-20261106` for initial testing and review actual deploy URL in Netlify. Do not attach the existing RPChess Netlify site or modify the root netlify.toml.

Verify from Russia without VPN: GET /geo returns {country:"RU"}; GET /tournament/health and GET /profile/health return 200 JSON; then check OPTIONS and authenticated POST flows from a separate **isolated game preview**. If the country hint is null/incorrect, the browser first probes direct /health before using the proxy. Note: Netlify may be restricted by some Russian providers too; verify on target connections.

## Safety

Only allowlisted route prefixes are proxied. No persistent credentials at gateway; do not log Authorization, VK params, profiles or response bodies. Existing Cloudflare CORS allowlist must include the game's origin; preflight OPTIONS and Authorization need live browser verification. Do not automatically re-send an ambiguous POST, even on network errors. The live client uses a shared connection path for Profile and Tournament and exposes a per-device route override: auto/direct/proxy.

No commercial deployment or merge until proxy functionality is confirmed from Russia without VPN and with two real players. Switching route does not create a new queue or ledger.

## Playable acceptance without changing main

Open `https://rpchess-ru-api-gateway.netlify.app/play/?rpchess_profile=1&rpchess_api_route=proxy` in two independent browsers/devices. The branch-specific HTML and changed JS/CSS files are served locally, while unchanged game assets are CDN-rewritten to the currently published GitHub Pages game. This is a test harness using the actual RPChess UI and both real Cloudflare profile/tournament services.

The temporary `/preview-api/*` Netlify Edge Function forwards to those two existing origin-verified backends but strips the original Netlify page Origin. This is needed only because a game hosted on Netlify is not a Cloudflare-CORS-approved GitHub Pages/VK origin. It is **not** used by production Github Pages/VK users, who still use cheap `/profile/*` and `/tournament/*` CDN rewrites. Preview Edge invocations consume a small amount of free quota.

The Netlify project must retain **Base directory** = `netlify-gateway`; **Publish directory** = `public`. It automatically runs the small preview copier as its build command. No npm installation or full game build is needed.

Manual checklist: test from Russia with VPN OFF; launch two browsers with distinct local profile storage; find match, make legal moves, reload/reconnect, and verify result. Web guests have unranked matches by design; do not assert real VK Elo changes from the web preview. On GH/VK production, inspect browser Network to confirm the CDN path is used, not `/preview-api`. No mutation of `main` until approval.
