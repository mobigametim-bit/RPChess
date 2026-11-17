# Chronicle: safe rank recovery after D1 save conflict (17.11.2026)

**Branch:** `fix/chronicle-conflict-safe-rank-recovery-20261117`.
**Status:** implementation, QA and owner approval required; do not merge automatically.
**Incident:** VK player completed Journey (373 Glory, day 72, Power 898). Best Journey remains locally visible, while `Ваше место` shows **`Конфликт сохранений`** and TOP-10 is empty.

## Confirmed technical cause

The earlier PR #215 correctly identified a D1 profile conflict rather than treating an authenticated but uncommitted save as ranked. In `profile-client.mjs`, the `conflict` state **intentionally blocks full `syncNow()`**. It can be triggered when an offline-modified local snapshot diverges from a newer D1 revision, or when local progress lacks server achievements. `player-identity-chronicle.mjs` intentionally hid the generic Retry button during conflict. Therefore the player could not publish the completed local record through the existing UI.

**The actual conflicting records are private and were not accessed.** The screenshot alone cannot establish which exact conflict branch fired. The local best still displaying is evidence that the current device's Chronicle has not been overwritten.

## Minimal safe opt-in action

On the Chronicle with an authenticated profile conflict and a locally archived completed V2 record, show a separate **`Отправить лучший поход` / `Publish best journey`** action. Explain that other save data will not be modified.

`recoverCompletedChronicleRanking()` is called **only by explicit button click** and:
1. Reads `bestChronicleRun(readChronicle())`; rejects a record ineligible under the existing server score / run ID / day / Power validation rules.
2. Fetches `GET /v1/profile` with the existing authenticated bearer; strictly matches current `profileId` and provider.
3. Preserves the remote snapshot's run, rating/Power, Arena, tutorial, purchases and any other fields **unchanged**. If the completed `runId` is absent and remote Chronicle has capacity, append only this normalized finished record. If the record already exists, skip the write; if remote history has 20 records, stop without eviction.
4. Performs CAS `PUT /v1/profile` with the **fresh remote revision**, never the conflicted local revision. On HTTP 409, re-GET the newest server copy, then retry at most once. On an ambiguous network failure, do **not** blindly replay the PUT; next manual click begins with a GET.
5. Calls existing `POST /v1/leaderboard/refresh`. The server alone derives and assigns any rank. Never submit a claimed place, raw leaderboard row, authentication secret or arbitrary local save.
6. Keep `status='conflict'`, local markers, full local Journey, and other cross-device conflicts **unchanged**, even if rank is recovered. Full progress reconciliation is a separate decision.

No Profile Worker changes, D1 migrations, old leaderboard writes, Tournament redeploys or production configuration changes.

## Regression coverage

- Extend the existing `tests/player-identity-chronicle.cjs` with a few assertions for the recovery control and RU/EN parity.
- Extend `tests/yandex-gateway-browser.cjs`'s existing **synthetic VK conflict scenario**: check local 373 record and remote D1 rating/history; inject concurrent remote revision change causing a real HTTP 409; verify bounded re-GET/CAS, remote fields and local Chronicle preserved, no duplicate on retry, rank assigned by fake server and no overwrite when remote Chronicle has 20 records.
- Trigger isolated VK profile mock browser workflow `.github/workflows/yandex-gateway-browser.yml` on the feature branch. All API requests in the test are intercepted and synthetic, not sent to real D1.
- PR Focused Checks plus full Release Gate only after explicit human approval.

## Owner acceptance

Before production: code review and green synthetic Chromium/PR tests. Separate QA preview may show the recovery control, but cannot access the owner's genuine signed VK data and cannot prove that the user's real 373 record will be accepted.

After explicit merge and production deploy: open the original VK game without clearing storage. On the local Chronicle with `Конфликт сохранений`, click **`Отправить лучший поход`**. Verify a server-issued `#место` or specific error. The page may **still** report a general save conflict elsewhere because this feature deliberately does not merge active runs, Power or Arena between devices.
