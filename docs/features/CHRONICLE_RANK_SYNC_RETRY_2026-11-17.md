# Chronicle: completed Journey saved locally but not ranked online — 17.11.2026

**Status:** Draft hotfix, pending owner QA. **Branch:** `fix/chronicle-rank-sync-retry-20261117`. **Base:** `main` at `6aa5ce79`.

## Incident

Owner finished a Journey in live VK and saw **373 Glory**, day **72**, Power **898** in Chronicle's Best Journey, but `Great Commanders → Your Rank` displayed `Нет результата` and the TOP list had no entries (screenshot 17.11.2026).

The locally archived `chronicle` and the server-owned `rpchess_leaderboard_v3` are separate records. The UI's `Нет результата` appears when `viewerAuthenticated=true` but `me=null`. The exact D1 account snapshot for this real user cannot be inspected from the screenshot; do not claim a specific network, auth, D1 or score-validation failure without further live evidence.

## Confirmed client defect

`game/js/profile-client.mjs::unifiedLeaderboard({refresh:true})` calls `syncNow()` before server `/v1/leaderboard/refresh`. On failed profile sync (including conflict), it falls back to authenticated **read-only GET** `/v1/leaderboard`. `game/js/leaderboard-client.mjs::normalize()` previously lost this distinction; Chronicle could therefore say `Нет результата` instead of reporting that the new finished run **was never uploaded**. This is a user-facing error independent of what originally blocked this specific player's upload.

## Potential additional race, confirmed in control flow

`syncNow()` reuses an already in-flight PUT. If the run ends and Chronicle is archived while that earlier PUT is still running, `unifiedLeaderboard({refresh:true})` could await the earlier request and refresh the leaderboard before the newly completed record has been uploaded; the subsequent scheduled save alone does not recalculate the ranking.

`flushLatestChronicleForRanking()` now retries synchronization (at most 3 passes) until the acknowledged server fingerprint matches the **current** local snapshot. Only then may the client call server-side `/v1/leaderboard/refresh`. If progress keeps changing or profile sync fails, only the read-only leaderboard is fetched and the UI reports an unsynced state. This avoids redundant or fabricated scores and preserves conflict safety. Exact incidence in the owner's session remains unproven.

## Safe fix

- Carry a non-sensitive `profileSyncStatus` on leaderboard responses: `ready` on successful server refresh, `offline` or `conflict` on uncommitted profile changes, `read-only` or `unauthenticated` otherwise.
- Chronicle never invents rank. For a local completed best with no `me`, show `Не опубликован` / `Not published`; for failed sync distinguish `Не синхронизировано` / `Not synced` from `Конфликт сохранений` / `Save conflict`.
- Offer `Повторить отправку` / `Retry upload` for an eligible saved Chronicle record. The action reuses the existing authenticated `loadLeaderboard({force:true})` path: local snapshot -> conditional profile PUT -> server-authoritative v3 refresh -> rerender. **No new run** is needed.
- Never overwrite a conflicted save or submit directly to legacy leaderboard Worker. Never send secrets, identity, or claimed rank in request metadata or public diagnostics.
- Extend existing Node and browser regressions by a few assertions; no new permanent suite, no gameplay/score/save schema changes.

## Isolated QA — explicitly synthetic, zero production impact

Workflow: `.github/workflows/chronicle-rank-preview.yml`; branch: `fix/chronicle-rank-sync-retry-20261117`. The Cloudflare static Worker name is `rpchess-chronicle-rank-qa-preview`; production Pages, VK Hosting, Profile API Worker, D1 data, and other Workers are not changed.

- Ordinary preview game (separate localStorage): https://rpchess-chronicle-rank-qa-preview.mobigametim.workers.dev/
- **Synthetic Chronicle demo:** https://rpchess-chronicle-rank-qa-preview.mobigametim.workers.dev/?chronicle_qa=1&rpchess_profile=1&rpchess_api_route=direct
- Test-only `chronicle-rank-preview/demo.js` is injected **into the dist/index.html build artifact only**, never into `game/index.html` or the production bundle. It seeds a fake Web-only local Chronicle with 373 Glory and 898 Power, intercepts its isolated mock Profile API calls, first renders **«Не опубликован»**, and then simulates an authoritative `#1` response after the user presses **«Повторить отправку»**. The fixed banner prominently labels all data as **QA DEMO**.
- QA browser smoke verifies the actual button path and blocks any accidental HTTP requests to the real D1 Profile API. Fake records are NOT inserted into D1 and the synthetic rank is never represented as a real score.
- This preview cannot authenticate as the owner or access their real VK saved game because the origin differs. The real 373-point account's ranking can only be validated in the main VK game **after** explicit release approval and production rollout. Preserve owner save and do not clear browser storage.

## Automated verification and device acceptance

- Run PR Focused Checks and Release Gate only after explicit owner acceptance.
- On real VK, reopen main menu after a completed run, click **Повторить отправку** if the rank is absent, and verify either an actual `#rank` or a specific sync status.
- Reopen the same account and Chronicle; verify the archived score remains unchanged. Test RU and EN.
- If `Не опубликован` persists with verified profile and successful sync, investigate the server v3 candidate eligibility and live worker version **separately**. Do not invent a position or overwrite D1.

**Do not merge/deploy automatically from this bug report.** Owner to inspect QA/CI and approve.
