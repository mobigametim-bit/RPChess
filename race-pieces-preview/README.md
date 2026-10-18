# RPChess acceptance preview

This directory contains the Cloudflare Worker configuration for the playable acceptance build of PR #160.

The exact commit message `deploy: race pieces preview` on this branch publishes the current game build to the existing acceptance Worker, running production build and targeted browser checks before deployment.

Latest QA focus: Training/Puzzle long RU/EN objective titles now scale and wrap within the panel instead of truncating, including compact landscape layouts. Advertising banner layout remains a separate HTML mockup pending owner approval; the live game has no new banner placement from this task.

Never merge PR #160 to `main` before owner manual acceptance.

## Centered combat layout acceptance (2026-10-18)

- Journey Skirmish, Battle, Caravan, Classic and Arena boards centered on whole landscape viewport.
- Battle Journal follows turn summary with no blank stretch and remains internally scrollable.
- Right-side gutter is reserved for optional future sticky ads, without showing an ad or loading GamePush in this iteration.
- Auto mode avoids sticky ads on short landscape phones; it is not yet an SDK integration.
- Existing responsive browser tests now assert the accepted alignment at desktop, tablet and mobile landscape sizes.

Do not merge to main without the owner's manual playtest approval.

Updated acceptance target: symmetric CSS rail calculation for broad Chromium compatibility; re-run browser gates before publishing.

Final classic-toolbar geometry check: local Classic shows three navigation buttons (not two), so the centered-rail CSS must distribute their widths without overlapping the board. The accepted Journey combat keeps its two-button layout.

Diagnostic Chromium run: record computed Classic shell/toolbar/board rectangles in the existing browser test to distinguish a rail-width overflow from stylesheet precedence. Will remove temporary logging after geometry is corrected.

Final viewport diagnosis: the legacy UX consistency stylesheet fixed the inner board to the whole viewport. The new owner stylesheet now makes the inner grid absolute inside its centered square parent; Classic browser test asserts the real Main Menu hit target remains unobstructed.

## Pointer drag acceptance (2026-10-18)

- Mouse and touch drag-to-move coexist with click-to-select/click-to-target.
- Applies to Journey (Skirmish, Battle, Caravan), Classic Chess, Arena and Training.
- The owning chess engine remains authoritative for legal moves, saves, and promotion.
- Built-in tests cover dragging in Classic, Arena, and Training; no change to production main before manual acceptance.

Training drag regression investigation: log persisted move index, objective state and visible selection after pointer release in existing browser acceptance.

Race input acceptance: a three-ply Lichess puzzle exposed a brief forced-reply unlock race; resolved by unlocking before persisting its next player turn. Added Chromium real touch event drag to Classic mobile acceptance; mouse drag remains tested across Classic, Arena and Training.
