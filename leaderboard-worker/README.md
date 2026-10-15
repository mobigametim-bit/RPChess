# Great Commanders API — first deployment

This is a **new dedicated** Cloudflare Worker `rpchess-leaderboard`, not the deleted static game Worker `rpchess`.
The main RPChess website stays on GitHub Pages. PR #157 was merged and published on 2026-10-15 (Actions #38783897854). Dedicated Worker and D1 are live; signed VK account score submissions still need real-VK acceptance.

## Already configured

- D1 name: `rpchess-leaderboard`
- D1 ID: `8452f616-2982-428a-ad59-57cb8238708f`
- D1 binding to Worker: `DB` (in `wrangler.toml`)
- Schema: `schema.sql` (creates `leaderboard_v1`, one row per VK user)
- Worker entry: `src/index.mjs`
- Explicitly gated GitHub workflow: `.github/workflows/leaderboard-api-preview.yml`

## Owner setup — no credentials in GitHub files or ChatGPT

1. In Cloudflare, create a scoped **API token** for the appropriate account with Worker deploy/create and D1 edit rights. A token creating the new Worker may require Workers **Admin** for its first deployment; restrict it to this Cloudflare account. Don't use the Global API Key.
2. In GitHub repository **Settings → Secrets and variables → Actions → Repository secrets**, create:
   - `CLOUDFLARE_API_TOKEN` — value is the token created in Cloudflare;
   - `CLOUDFLARE_ACCOUNT_ID` — value is Cloudflare Account ID (not D1 database ID).
3. Inform the developer that both secret names have been configured, **without sending the values**.
4. Staging-only workflow is restricted to the original feature branch, while the main game is published via the separate manual GitHub Pages release workflow. Production release already completed.
5. GitHub Actions will apply `schema.sql` to the existing D1 and deploy the new `rpchess-leaderboard` Worker. Record the **actual** `.workers.dev` URL from the job output; never guess it.
6. In Cloudflare → Workers & Pages → **rpchess-leaderboard** → Settings → Variables and Secrets → Add secret, create `VK_APP_SECRET` using the **secret key from the VK application**. Do NOT use VK access tokens, and do NOT expose the key in GitHub or chat. This must happen after the Worker exists. The Cloudflare dashboard may redeploy it.
7. Verify `GET <actual-worker-url>/health` and `GET <actual-worker-url>/v1/leaderboard`, and a signed launch from a real VK client. The game preview must then explicitly configure the verified API origin. The current client does not invent the endpoint.

## CLI fallback (only if authenticated locally)

From RPChess repository root with Wrangler authenticated for the same Cloudflare account:

```sh
npm ci
npx wrangler d1 execute rpchess-leaderboard --remote --file leaderboard-worker/schema.sql --config leaderboard-worker/wrangler.toml --yes
npx wrangler deploy --config leaderboard-worker/wrangler.toml
npx wrangler secret put VK_APP_SECRET --config leaderboard-worker/wrangler.toml
```

The last command prompts for the secret value; never put it in shell history.

## Important limits

The VK signed launch proves account identity, not honest game results. The Worker recomputes Glory, checks basic value bounds, upserts only personal bests, and never creates demo players. Full anti-cheat requires server-authoritative game verification. No prizes or monetary rewards should be based solely on this MVP.

Worker staging deployment was verified in GitHub Actions #38782253574. The encrypted VK secret was confirmed; public leaderboard reads, CORS, and unsigned write rejection passed. Game is live on GitHub Pages. Real signed VK submissions and the user's leaderboard position still need user acceptance in VK. Preserve secret rotation from earlier exposure; never reintroduce plaintext variables.
