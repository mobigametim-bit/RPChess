# RPChess: бесплатный Netlify API-шлюз (только API)

**Production game remains on GitHub Pages / VK.** Netlify `rpchess-ru-api-gateway` is NOT a game host and does not contain playable RPChess pages, images, music, chess assets, fonts, or scripts. The isolated `/play/` and `/preview-api/` experiments were removed after user feedback. No changes to `main` until user acceptance.

Live gateway: https://rpchess-ru-api-gateway.netlify.app

The Netlify Free project has **Base directory = `netlify-gateway`**, **Publish directory = `public`** and no build command. Its `netlify.toml` configures only:

| Route | Purpose | Implementation |
|---|---|---|
| `/geo` | One-shot visitor country hint | tiny Netlify Edge Function; no credentials |
| `/profile/*` | D1 profile API, including POST/PUT | Netlify CDN proxy rewrite to existing Cloudflare Worker |
| `/tournament/*` | One global queue and real matches | Netlify CDN proxy rewrite to existing Cloudflare Worker |
| `/` | Read-only connection diagnostics | a tiny local HTML+JS+CSS page |

No extra origin credentials, logins, persistence or tournament queues are created on Netlify. No API backend is migrated. The same Cloudflare workers keep token validation, rating and state. Proxied traffic incurs CDN requests/bandwidth credits, not Netlify Functions invocations. `/geo` consumes one Edge invocation per routing check.

## Client routing

- At GitHub Pages / VK runtime, `game/js/api-route.mjs` checks geo once.
- `RU` selects Netlify for both profile + tournament; other resolved countries select direct Cloudflare.
- Unknown geo uses a short, read-only GET `/health` direct probe, selecting proxy only when that fails. On a single selected route, no non-idempotent POST auto-retries.
- User can override the choice in the Tournament UI (auto/direct/proxy). `?rpchess_api_route=proxy` forces gateway for testing.
- The route is shared for profile and tournament to avoid mixing sessions; original cached identity/token storage is preserved. No `/play` references should remain.

## Verification

1. From Russia **without VPN**, open https://rpchess-ru-api-gateway.netlify.app/ and check country `RU`, Profile `Работает`, Tournament `Работает`.
2. GitHub Actions `.github/workflows/ru-netlify-gateway-smoke.yml` confirms live health/CORS and exercises **real guest/private-match POSTs, two legal moves, restore, resign**, via CDN endpoints with GitHub Pages `Origin`. Also ensures obsolete `/play/` and `/preview-api/` no longer respond.
3. Before merging PR #180, validate route selection and browser API calls on a separate game origin (GitHub Pages/VK), including a pair of players located in Russia. Do not give the diagnostic page as a playable build.
4. Approve and merge only after 2-player acceptance; rollback is reverting the client route CSS/JS PR, leaving the existing workers and data untouched.

Security: never log `Authorization`, VK launch params, access tokens or user data. The diagnostics UI uses only GET health/geo. The profile and tournament API origins remain allowlisted by Cloudflare. Confirm CORS for VK and GitHub Pages and the profile PUT method; Netlify is not an open proxy.
