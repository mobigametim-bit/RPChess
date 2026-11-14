# RPChess production release — weekly Puzzle + Events polish (PR #206)

**Date:** 2026-11-15  
**Feature PR:** https://github.com/mobigametim-bit/RPChess/pull/206  
**Accepted feature HEAD:** `3141b445d9bf82df5a9ad7f2c3507b935bf85c64`  
**Merged feature commit:** `0dce7884c3953a041b823c05c4d4082ef5bb5e37`  
**Full Release Gate:** https://github.com/mobigametim-bit/RPChess/actions/runs/43645050301 — SUCCESS  
**PR Focused Checks:** https://github.com/mobigametim-bit/RPChess/actions/runs/43645050344 — SUCCESS  
**QA:** https://github.com/mobigametim-bit/RPChess/actions/runs/43644005834 — SUCCESS

## Owner-approved changes

- Weekly Honor shards from an owned completed Puzzle site require a fresh same-star chess puzzle. Three mistakes or leaving forfeits that week's shards; mistakes do not shrink the amount. Award only Honor shards, no Gold.
- Weekly success grants Power according to the **road point's displayed I–V level**, not its 1–12-star chess difficulty (example: ★4 road point = II, +2 Power). Normal puzzles retain their Elo gain.
- Weekly tasks use the same board and buttons as original tasks. The result shows +N with the Honor shard icon and mistake count, without accuracy-based payout copy.
- Events layout has vertically centered story, larger legible text and responsive buttons. Read-aloud controls speak title, story and choices using Mentor-style text-to-speech.

## GitHub Pages release

The main-branch push for PR #206 was intentionally skipped by `.github/workflows/pages.yml` because its merge title lacked an allow-listed release prefix. The repository protects `main` against direct commits. This **docs-only follow-up PR** uses an existing allowed release prefix when merged to start the normal GitHub Pages production workflow. No game implementation, assets, persistent state or Worker configuration is changed by this follow-up PR.

Production entry point: https://mobigametim-bit.github.io/RPChess/
