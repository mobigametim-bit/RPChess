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
