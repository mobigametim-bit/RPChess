# Technical improvement roadmap — 2026-11-25

Owner accepted the technical improvement plan on 2026-11-25. Baseline main: `29adf2249d08738da3a0392652ef108616915f11`; Pages workflow 45500870106 attempt 2 succeeded. No release authorization for implementation PRs is implied.

## Invariants
Preserve gameplay, chess legality, balance, accepted visual layouts in landscape/portrait, RU/EN, existing saves, platform adapters and server compatibility. No automatic production database/Worker changes. Prefer minimal sufficient regression assertions in existing tests. Each stage is independently reviewable; focused tests, owner acceptance where required, full Release Gate, merge, production verification. No sweeping rewrites or new framework.

## Stages
1. Deep audit and measurable baseline: inventory JS/CSS/assets, lifecycle, storage, network, security and workflows. Record confirmed findings separately from hypotheses.
2. Combat performance and reliability: Stockfish lifecycle, reuse compatible completed analyses, eliminate needless replay/render work, persist rewarded fast-forward, recover safely from failed operations. Start with weekly defenders, then verify other modes.
3. Shared combat components: extract proven common lifecycle, board/journal/input/animation pieces incrementally; mode-specific rules stay in their owners. PvP and Mentor require separate adapters.
4. Kingdom map: profile long runs and mobile; separate rendering, camera, input, routing, economy/markers/inspector where existing ownership does not already suffice.
5. Saves: stress fixtures with 100/500/1000/5000/10000 encounters; measure bytes, timing, cloud limits, quota, conflict, offline recovery. Design compatible archival/compaction only after evidence; preserve existing progress.
6. CSS: inventory overrides and consolidate into owner styles; before/after Chromium screenshots in five accepted viewports, RU/EN.
7. Assets/startup: measure production size, startup requests, lazy content, Stockfish loading, cache behavior; retain editable masters. Offline/PWA only after explicit design review.
8. Server/security: Profile, Tournament and Leaderboard authorization, revisions, idempotency, replay, rate limits, corrupted input, authoritative rankings and cost. Test in isolation, no production mutation.
9. CI: fix observed flaky readiness waits, verify selector coupling, audit obsolete previews and duplicate build/test cost; retain protected main and full acceptance gate.
10. Documentation: update active contracts and distinguish historical receipts. GitHub is the required source of truth.

## Initial register (static inspection, exact baseline)
| ID | Evidence | Status / next proof |
|---|---|---|
| TECH-01 | weekly-defenders-app resumes with skip=false even after completed ad; fast-forward is only in memory | persist per active receipt, verify existing saves/default, completed/failed ad + resume |
| TECH-02 | weekly-defenders-app playMove repeats newEngine(active) after every ply (full history), and analyzes before/after every ply | reuse complete same-FEN depth-10 score when valid; maintain identity/capture state incrementally with existing replay contract; benchmark separately |
| TECH-03 | weekly-defenders-app close/finish calls stop, keeps worker alive until another resume; timer catch lacks retry | release worker on suspend/settlement; handle stale session, failure and bounded recovery |
| TECH-04 | Pages attempt 1 failed in combat-resume-browser.cjs page.goto networkidle at 30s; attempt 2 succeeded | use DOM/game loader readiness rather than global network quiescence; keep assertions |
| TECH-05 | select-pr-tests.cjs has no explicit weekly-defenders group | ensure changes to either weekly module select its browser regression, test selector |
| TECH-06 | run-persistence serializes full run; map productionClaims grows; weekly history up to 20 x 400 plies per hero; Profile Worker MAX_SAVE_BYTES=260000 | actual serialized long-run fixture and CPU/quota/cloud tests required; no size failure proven yet |
| TECH-07 | map app ~96.5 KB, CSS 54 files, workflows 56 | measure before restructuring; size is not itself a defect |
| TECH-08 | CURRENT_STATE.md includes obsolete portrait lock and pre-merge Kingdom description | refresh active summary with production evidence |
| TECH-09 | weekly renderBoard recreates 64 cells and journal replays moves per render | profile; preserve animation, drag, check, grade and skin semantics before incremental renderer |
| TECH-10 | Profile/Leaderboard client result trust and session edge cases | isolated security review; no confirmed exploit claimed |

## Acceptance and reporting
No claim of performance improvement without before/after measurements. Distinguish CI pass from real mobile measurements and live VK ad acceptance. Report actual commits, checks, blockers and next actions. No merge until separately accepted.

## Second implementation batch
- TECH-11 (confirmed data loss on transfer): cloud-save compactCharacter/expandCharacter previously retained only ID/status for known heroes. Both VK and D1 use this compact payload, so mastery level/XP/source, weekly lock, statistics and battle history were discarded. Preserve the existing mutable fields while still deriving static art/copy from templates. Legacy snapshots without these fields remain readable. Already discarded cloud-only history cannot be reconstructed. Extended the existing cloud-save regression for trained starter and recruited wounded commander through the real mock VK envelope roundtrip.
- First focused CI 45603045697 on head 520e9f6 passed. Release Gate 45603045853 stopped at owner-acceptance guard, not a failed gameplay test.
- Added opt-in scripts/audit-save-growth.cjs: production route generation, validation, write/read and cloud payload measurement on synthetic 100/500/1000/5000/10000 completed sites; no real data or network. Reports exact UTF-8 size, D1 limit fit, VK chunk fit and Node read/write median. Also isolates legal chess replay vs incremental engine move cost. These are synthetic fixtures, not real playthroughs or mobile device measurements. Omitted fog, roads, conquests, production receipts and weekly histories, so do not infer a guaranteed encounter threshold. Run from a materialized checkout: node scripts/audit-save-growth.cjs. Focused CI runs the measurement only if the audit script changes.
- Next: inspect new focused CI and measured results; design preservation-safe save budget mitigation before changing any server limit or format. No production deployment or schema migration.

## Measured baseline and third batch
Focused run [45605031360](https://github.com/mobigametim-bit/RPChess/actions/runs/45605031360) succeeded on 14872a5b. Existing cloud roundtrip, battle and portrait acceptance passed. Release Gate remains owner-gated.

| Synthetic completed encounters | local bytes | D1 profile bytes | VK chunks | median read/write ms |
|---:|---:|---:|---:|---:|
|100|84174|81726|37|0.62 / 1.01|
|500|393713|391265|174|1.40 / 2.81|
|1000|781002|778554|347|2.99 / 5.58|
|5000|3897635|3895187|1732|15.92 / 34.33|
|10000|7797663|7795215|3465|31.97 / 79.82|

Profile limit 260000 bytes, VK limit 128 chunks. Route-only fixture already fails both budgets by 500 encounters; not a universal real-game threshold. Node memory storage is not browser quota. Replay microbenchmark, 200 legal plies: 20100 move calls / 2003.05 ms vs 200 calls / 17.82 ms. This isolates replay, not end-to-end performance.

TECH-12: UCI bestmove lines have no operation ID. Previously stop/timeout left an old worker alive; a delayed legal bestmove could resolve a newer search. Retire worker on cancellation/timeout/error, initialize fresh on next operation, keep existing legal fallback and normal strength profiles. Extend existing adapter regression with delayed old bestmove that is legal in the new search and a timeout followed by a fresh search.

Save format design: measure gzip/base64url lossless roundtrip before migration. Do not ship a client-only compressed map: unified-board.mjs computes Glory and territory data from snapshot.run.kingdomMap; profile import and rollback clients expect normal JSON. Any new protocol needs version negotiation, old-reader compatibility, bounded decompression, exact readback, retention of last working snapshot and rollback plan. Compression alone does not make a finite storage budget infinite; investigate segmented persistent storage for truly long journeys. No server/DB mutation in this PR. Updated diagnostic records compression sizes and CPU timings only, with no production encoding changes.


## Fourth batch — focused CI recovery and save design (2026-11-25)

Evidence on head 7cdbfedb: [focused run 45607447046](https://github.com/mobigametim-bit/RPChess/actions/runs/45607447046) passed the build, audit, all selected Node tests (including the late-bestmove/timeout adapter contract), Arena browser and Battle browser. Classic Chess stopped at the initial page.goto(networkidle) timeout (tests/classic-chess-browser.cjs:56); later browser suites did not run. This is evidence of navigation timeout, not proof of a gameplay regression or of full browser correctness. [Release Gate 45607446928](https://github.com/mobigametim-bit/RPChess/actions/runs/45607446928) stopped at the explicit owner-acceptance guard before running tests.

Commit 8ee25a5b replaces all three Classic Chess page navigation waits (desktop, mouse mobile, touch mobile) with DOMContentLoaded, initialized Classic/AI owners, initialized loader and hidden mask, and visible menu. Existing gameplay assertions remain unchanged. Recheck focused CI before proceeding. Static review found similar networkidle waits in Arena, Battle, Skirmish, Skirmish artifact, Cloud Continue, Roster, portrait scenes, Foundation and responsive viewport tests. Do not bulk-replace these without preserving their specific cloud, asset and interaction readiness contracts. Fix further demonstrated failures narrowly.

### Lossless compression evidence

Exact results of SAVE_GROWTH_AUDIT in focused run 45607447046 (bytes, medians in ms):
| Encounters | Profile JSON | GZIP bytes | GZIP base64url bytes | GZIP VK chunks | GZIP / gunzip ms |
|---:|---:|---:|---:|---:|---:|
|100|81726|7141|9522|4|0.82 / 0.26|
|500|391265|26211|34948|12|3.37 / 0.63|
|1000|778554|50358|67144|23|6.60 / 1.12|
|5000|3895187|250163|333551|112|33.26 / 6.98|
|10000|7795215|500019|666692|223|67.10 / 7.05|

Exact UTF-8 roundtrip succeeded for both profile JSON and VK envelope. Replay rerun: 2000.71 ms vs 18.96 ms / 20100 vs 200 move calls. Synthetic route-only data excludes fog, roads and hero histories; timings are Node CI, not mobile browsers. GZIP sizes exclude protocol metadata. D1's existing 260000-byte application cap applies to ordinary JSON, not compressed transport: a gzip binary size below that cap is not evidence the current server accepts the save. A base64url budget of 260000 would still be exceeded by the 5000 fixture. VK existing 128-chunk budget would fit the compressed 5000 fixture but not 10000; no actual VK quota/transport claim.

### Proposed save architecture — design only; no schema or deployment changes

Verified current contracts:
- `run-persistence.mjs` synchronously stores the full validated run under a single key; local quota is independent of either cloud budget. Do not make asynchronous storage a drop-in change to this API.
- `cloud-save.mjs` uses legacy JSON/base64url manifests, alternating slots, checksum and verified readback before switching the active manifest. Unknown encodings are rejected. Replacing that manifest with gzip would break old readers.
- `profile-client.mjs` PUTs an ordinary snapshot to /v1/profile using a revision; it advances the local marker only after acknowledgment. Server save uses revision CAS. The Worker profile response, legacy VK import, leaderboard refresh and tournament binding all read snapshot_json, and unified-board directly reads the active kingdom map to compute Glory.
- Never send a truncated active run, omit claimed territory/receipts, or treat a failed cloud write as synced. A stale v1 mirror must not silently override a newer v2 revision.

Proposed sequence for separate reviewable implementation:
1. Extend synthetic fixtures with actual populated map/fog/roads, production receipts, named hero histories and active combat. Measure real UTF-8 sizes, compression CPU and peak memory on representative mobile browsers, local storage failures and offline recovery. Add a soft budget warning with RU/EN and preserve last acknowledged revision; no automatic pruning.
2. Prototype a bounded codec in isolation: versioned encoding, decoded length and checksum, fatal UTF-8, streaming byte cap before JSON parse, shape validation, exact roundtrip, malformed/truncated/oversized decode rejection. Choose gzip only when smaller and supported; no production writes. Establish byte/time caps from measurements, not guesswork.
3. D1: add a versioned capability/endpoint and additive storage (not in-place reinterpretation of snapshot_json); stage immutable chunks scoped by authenticated profile and generation, verify completeness, then publish a manifest/revision using CAS. Keep one logical revision across versions, reject stale writes, and do not return a silently stale v1 run after a v2-only save. Define a client-upgrade response for old readers once v1 can no longer represent the full run. Keep v1 compatibility until explicit migration approval. Preserve a last verified generation and test rollback, interruption, concurrent devices, idempotent retries and garbage collection. Update Glory, tournament binding and legacy import to use the same authoritative decoded state before enabling writes. No schema migration on production without a separately approved rollout.
4. For local storage, prototype IndexedDB-backed immutable segments with an atomic commit pointer and legacy import. Keep the last usable local state until durable readback and ensure callers do not proceed as if a failed save succeeded. Audit synchronous consumers before integration.
5. VK: keep the existing manifest readable; compression/segmentation in VK alone is not an unlimited archive. For accounts using D1, retain existing legacy import/rollback behavior and designate one authoritative active run. Never dual-write incompatible active snapshots. Test live VK storage only in approved preview.
6. Release only after full restore/reconciliation evidence, Glory equivalence, older-client behavior, interrupted-write recovery and owner playtest. Until then ordinary saves and deployed Worker are unchanged.

Next implementation gate: focused browser CI on the Classic readiness change, then combat ownership audit and the isolated storage fixtures/codec. Do not merge or deploy without the previously agreed acceptance gate.

## Fifth batch — shared combat ownership, first extraction
Focused run [45611150323](https://github.com/mobigametim-bit/RPChess/actions/runs/45611150323) passed all selected Node and real Chromium regressions after the Classic Chess readiness fix. Full Release Gate remains explicitly owner-gated.

Static audit: Battle and Skirmish already share Classic Chess for board/AI, checkpoint serialization, artifact overlay and piece assets. Both duplicate deterministic encounter seed hashing, Event-vs-Travel override consumption and theme assembly; Caravan duplicates combat move serialization. Extract those identical contracts without changing seeds, IDs, difficulty, army selection, render ownership or persistence schema. Keep distinct army eligibility (Skirmish excludes army recruits), obstacle rules, identity maps, wound/outcome logic and Caravan settlement in their existing owners. Arena and weekly defenders have separate board and worker lifecycles; do not merge them with Classic until their contracts are individually proven. Extend existing event-combat-race test with three assertions for override consumption and cross-mode isolation. No new permanent suite. Pending focused CI for this extraction.

### Isolated codec experiment
Added Node-only scripts/audit-save-codec.cjs and reused the existing opt-in audit. Versioned gzip+base64url envelope carries exact decoded byte length and SHA-256; decode enforces explicit encoded budget before base64 decode and decoded budget during inflate, canonical base64url, fatal UTF-8, JSON parsing and the existing Worker snapshot shape contract (or VK outer envelope plus payload shape). Checks exact original JSON for all five fixture sizes and rejects unknown codec, bad checksum, truncated payload, forged short output length, over-budget input/output and wrong JSON/shape. Report actual envelope bytes including metadata. Audit-only budgets 16 MiB decoded / 2 MiB encoded are experimental and not proposed production limits. Digest is integrity, not authentication. Node implementation is not a browser/Worker codec; no runtime imports, storage writes, migration, production changes or new permanent suite. Realistic map/hero fixtures, browser/Worker streaming prototype and atomic storage/revision integration remain open. Pending CI.
