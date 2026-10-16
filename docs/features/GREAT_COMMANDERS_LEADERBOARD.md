# Great Commanders / Великие полководцы — MVP

Status (2026-10-15): merged to `main` in PR #157 and published to GitHub Pages. Deployment confirmed by GitHub Actions run #38783897854 at https://mobigametim-bit.github.io/RPChess/. Cloudflare D1 and dedicated `rpchess-leaderboard` API are deployed. The deleted old static `rpchess` Worker was not recreated. **Production VK account submission is awaiting manual real-VK verification**.

## Product contract

- Keep the existing Chronicle flag and the Current Journey section.
- Replace Best Journey with Great Commanders / Великие полководцы.
- Show authenticated VK player's overall position first, then global top 10.
- One entry per VK user. Score is the **maximum Glory from a completed run**.
- Glory: `floor(sqrt(week * power) / 10)`. Ties: week DESC, power DESC, achieved time ASC, VK account id ASC.
- Display the player name from that user's best completed run. Display RU/EN labels.
- Never insert imaginary leaderboard users or data in production.
- If API is missing/offline, show a small clear localized fallback; don't break Chronicle.
- Do not alter gameplay rules, persistence schema, local history, or Arena economy.

## Components

- `game/js/player-identity-chronicle.mjs`: Chronicle UI and async leaderboard state.
- `game/js/leaderboard-client.mjs`: live leaderboard API client; endpoint configured in `game/index.html`.
- `leaderboard-worker/src/index.mjs`: isolated Web-standard request handler using a Cloudflare D1 binding, not the former static game Worker.
- `leaderboard-worker/schema.sql`: D1 leaderboard table.
- `leaderboard-worker/wrangler.toml`: active D1 binding, database ID, and permitted game origins. Secret `VK_APP_SECRET` is configured as a protected Cloudflare Worker secret.

## API

- `GET /v1/leaderboard`: public top 10, no personal position.
- `POST /v1/leaderboard/view` with `{launch}`: top 10 + verified VK user's position if signed launch params are provided.
- `POST /v1/leaderboard/submit` with `{launch,record}`: verify signed VK user, validate values and recompute Glory, atomically upsert only if better, return updated board.
- The server secret must never appear in HTML or game JavaScript. CORS should allow only intended staging and production host origins.
- For the frontend, configure `globalThis.RPChessLeaderboardAPI='https://<new-api-origin>'` before game initialization or set the page's `meta[name="rpchess-leaderboard-api"]` `content` to the real API URL.

## Security limitations

VK launch signature authenticates **who** submits, not whether the run really happened. A local HTML5 game cannot provide authoritative anti-cheat with only a database. Current validation checks input ranges and the Glory formula but cannot detect all fabricated playthroughs. Do not offer real prizes based on this MVP until stronger verification is implemented.

Some VK desktop iframe launches may omit signed launch params. Those users can view public top 10 but cannot submit or see an authenticated rank until the session-auth path is supported.

## Acceptance

1. DONE: dedicated Cloudflare Worker + D1 deployed; signed-secret presence, CORS, public board reads, rejection of unsigned submissions checked in Actions #38782253574.
2. Real browsers on VK desktop and mobile: launch signed/unsigned, fetch top 10, submit best record, revisit from second device.
3. Two different accounts, duplicates, worse submissions, equal Glory ties, name updates, empty board, offline recovery, RU/EN.
4. Confirm responsive list fits within the original blue banner and independently scrolls when space is narrow.
5. DONE: owner explicitly requested production rollout on 2026-10-15; PR #157 merged and GitHub Pages build validated and deployed. Real-VK manual acceptance remains open.


## Mobile and preview CORS polish (PR #160; October 2026)
- The original production CORS whitelist had only GitHub Pages and the former leaderboard preview. VK-hosted mobile/production pages and the later race-piece preview were not included. A browser cross-origin request from an untrusted origin receives HTTP 403, causing the Chronicle to render its offline fallback.
- Allow the **exact RPChess app ID 54754579** when hosted by VK on `stage-app54754579-*.pages.vk-apps.ru` or `prod-app54754579-*.pages.vk-apps.ru` (also VK's `.com` hosting variant). Do **not** wildcard other VK apps or arbitrary origins.
- Add `rpchess-race-pieces-preview.mobigametim.workers.dev` to allowed preview origins. Keep previous GitHub Pages and leaderboard-preview origins.
- On VK mobile signed `/view` failure, attempt the *public* read-only GET endpoint before reporting offline. Never invent a personal rank, do not bypass signature validation or weaken `/submit`.
- The **separate leaderboard Worker must be deployed** for the CORS correction to take effect. Merely publishing game HTML from the feature branch will not fix a CORS 403. Validate with real `Origin` request headers from mobile staging, preview, and an unrelated host.
- Preserve existing live D1 data, schema, leaderboard scoring, run snapshots and user submissions; this patch changes only CORS access and graceful public read fallback.


## Personal rank on VK mobile WebView (PR #160; follow-up 2026-10-16)

The public top ten and a personal rank are different requests. The public GET can succeed while the personal rank remains absent if the mobile VK WebView omits signed `vk_*` launch parameters from `location.search`. That issue is independent of CORS.

- First try the existing signed `location.search`. If complete signed launch params are absent **and** the platform is a VK launch, ask VK Bridge for `VKWebAppGetLaunchParams`, cache only the returned signed parameters for the current JS session, and send them to the existing `/v1/leaderboard/view` endpoint.
- The bridge response has `vk_app_id`, `vk_user_id`, `vk_ts`, `vk_platform`, `sign`, etc. Never treat an unsigned user ID or profile name as authentication; all signed data must continue to be verified by the Cloudflare Worker using the private `VK_APP_SECRET`.
- The Worker returns `viewerAuthenticated` in the signed view response. `true` with no `me` means the account is verified but **has no recorded completed-run score**. A public GET or a failed VK signature leaves this flag false.
- UI now differentiates RU/EN “VK не подтверждён” / “VK not verified” from RU/EN “Нет результата” / “Not ranked yet” instead of an unexplained dash.
- Keep public top-ten fallback when signed VK requests cannot be completed, but do not claim a personal rank for an unverified session.
- A player's current ongoing Journey, even at week seven or higher, is **not** a ranked result. A best completed Journey must be submitted from a signed VK session to register a score.
- This requires deployment of the updated **leaderboard API** and game build. Cloudflare standalone previews cannot simulate VK user identity; real signed VK mobile test remains required before PR is accepted.
