# Great Commanders / Великие полководцы — MVP

Status (2026-10-15): merged to `main` in PR #157 and published to GitHub Pages. Deployment confirmed by GitHub Actions run #38783897854 at https://mobigametim-bit.github.io/RPChess/. Cloudflare D1 and dedicated `rpchess-leaderboard` API are deployed. The deleted old static `rpchess` Worker was not recreated. **Production VK account submission is awaiting manual real-VK verification**.

## Product contract

- Keep the existing Chronicle flag and the Current Journey section.
- Replace Best Journey with Great Commanders / Великие полководцы.
- Show authenticated VK player's overall position first, then global top 10.
- One entry per VK user. Score is the **maximum Glory from either a completed run or an ongoing Journey**; a lower later result never decreases the player's record.
- Every entrance to Main Menu (including returns from battle or summary) recomputes the active Journey's Glory, refreshes the leaderboard, and submits only an improvement with signed VK launch credentials.
- A per-VK-user local high-water record allows an unsent improved active score to retry after connectivity returns; ongoing runs are **not** inserted into the completed Chronicle history.
- Glory: `floor(sqrt(week * power) / 10)`. Ties: week DESC, power DESC, achieved time ASC, VK account id ASC.
- Display the player name from that user's best completed run. Display RU/EN labels.
- Never insert imaginary leaderboard users or data in production.
- If API is missing/offline, show a small clear localized fallback; don't break Chronicle.
- Do not alter gameplay rules, completed Chronicle history, or Arena economy. The separate versionless, per-VK-account leaderboard-best cache is not a completed run.

## Components

- `game/js/player-identity-chronicle.mjs`: Chronicle UI and async leaderboard state.
- `game/js/leaderboard-client.mjs`: live leaderboard API client; endpoint configured in `game/index.html`.
- `leaderboard-worker/src/index.mjs`: isolated Web-standard request handler using a Cloudflare D1 binding, not the former static game Worker.
- `leaderboard-worker/schema.sql`: D1 leaderboard table.
- `leaderboard-worker/wrangler.toml`: active D1 binding, database ID, and permitted game origins. Secret `VK_APP_SECRET` is configured as a protected Cloudflare Worker secret.

## API

- `GET /v1/leaderboard`: public top 10, no personal position.
- `POST /v1/leaderboard/view` with `{launch}`: top 10 + verified VK user's position if signed launch params are provided.
- `POST /v1/leaderboard/submit` with `{launch,record}`: verify signed VK user, validate values and recompute Glory, atomically upsert only if better, return updated board. Existing server and D1 schema already accept active Journey records; no API redeploy or migration is required.
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

## 2026-10-18 — Main Menu Glory refresh

- Active Journey candidate uses the same `floor(sqrt(week * power) / 10)` formula as completed Journey records.
- On opening/re-entering Main Menu, the client reloads the board, computes the best of completed and current Journey, remembers its signed VK account's local high-water mark, and submits when it outranks the existing server result.
- Signed VK launches can submit; unsigned standalone/GitHub Pages launches continue to show public results read-only.
- No gameplay, D1 table, server Worker, Chronicle-history schema, or other branches have been changed for this feature.
