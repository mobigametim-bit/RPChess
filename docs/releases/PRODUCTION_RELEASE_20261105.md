# RPChess production publish authorization — 2026-11-05

The owner asked to verify and provide a working deploy link after accepting the GamePush ad run and merging PRs #172–#175.

- Verified release code main SHA before deploying: `ba1c35fcf1528cb774df0cf9f2a52bc9294d8310`.
- Full main build/Playwright gate: https://github.com/mobigametim-bit/RPChess/actions/runs/42060639611 — SUCCESS; Pages deploy in that **push validation** run was skipped by design.
- Release source: https://github.com/mobigametim-bit/RPChess/blob/main/docs/features/RPCHESS_ID_GAMEPUSH_RELEASE_20261105.md
- Production URL: https://mobigametim-bit.github.io/RPChess/
- Rollback options: `?rpchess_gamepush=0` (native VK ads with D1), or `?rpchess_profile=0&rpchess_gamepush=0` (legacy saves and native VK ads).
- Preflight: GamePush developer trusted-site allowlist must include `https://mobigametim-bit.github.io` for GamePush ad calls from the production origin. If not enabled, native VK Bridge remains a fallback when SDK initialization cannot complete.

This audit-only commit intentionally uses the repository workflow's existing special deployment trigger subject `deploy: active Glory menu sync`, while the production source code is unchanged from the green tested release. Do not remove this historical trigger without updating Pages workflow / release contract.
