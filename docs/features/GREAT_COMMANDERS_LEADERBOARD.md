# Great Commanders / Великие полководцы — MVP

Status: feature branch only, no merge or live deployment. Owner deleted the old static `rpchess` Cloudflare Worker. This feature does **not** recreate it.

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
- `game/js/leaderboard-client.mjs`: optional remote API; disabled until the endpoint is configured.
- `leaderboard-worker/src/index.mjs`: isolated Web-standard request handler using a Cloudflare D1 binding, not the former static game Worker.
- `leaderboard-worker/schema.sql`: D1 leaderboard table.
- `leaderboard-worker/wrangler.toml`: deployment template; requires **new database ID**, real `VK_APP_SECRET`, and allowed origin.

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

1. Configure dedicated backing API and database in connected Sites or D1 and stage URL; no further action on deleted Worker.
2. Real browsers on VK desktop and mobile: launch signed/unsigned, fetch top 10, submit best record, revisit from second device.
3. Two different accounts, duplicates, worse submissions, equal Glory ties, name updates, empty board, offline recovery, RU/EN.
4. Confirm responsive list fits within the original blue banner and independently scrolls when space is narrow.
5. Manual owner approval before merging `main`.
