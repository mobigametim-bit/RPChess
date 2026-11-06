# RPChess RU API gateway — Netlify Free

This independent Netlify site uses **CDN proxy rewrites**, not per-request Functions. It forwards both Tournament and RPChess Profile API traffic to the existing Cloudflare Workers, retaining the same Durable Objects and D1 state. A single Edge Function at /geo supplies a non-authenticated country hint.

Netlify project: https://app.netlify.com/projects/rpchess-ru-api-gateway . Expected public hostname: https://rpchess-ru-api-gateway.netlify.app (not live until first deploy).

## First deployment (one-time owner action)

Connect GitHub repository `mobigametim-bit/RPChess` to the new Netlify project. Set **Package directory** to `netlify-gateway`, leave **Base directory** at repository root, set **Publish directory** to `netlify-gateway/public`, leave the build command empty. Use branch `feature/ru-netlify-gateway-20261106` for initial testing and review actual deploy URL in Netlify. Do not attach the existing RPChess Netlify site or modify the root netlify.toml.

Verify from Russia without VPN: GET /geo returns {country:"RU"}; GET /tournament/health and GET /profile/health return 200 JSON; then check OPTIONS and authenticated POST flows from a separate **isolated game preview**. If the country hint is null/incorrect, the browser first probes direct /health before using the proxy. Note: Netlify may be restricted by some Russian providers too; verify on target connections.

## Safety

Only allowlisted route prefixes are proxied. No persistent credentials at gateway; do not log Authorization, VK params, profiles or response bodies. Existing Cloudflare CORS allowlist must include the game's origin; preflight OPTIONS and Authorization need live browser verification. Do not automatically re-send an ambiguous POST, even on network errors. The live client uses a shared connection path for Profile and Tournament and exposes a per-device route override: auto/direct/proxy.

No commercial deployment or merge until proxy functionality is confirmed from Russia without VPN and with two real players. Switching route does not create a new queue or ledger.
