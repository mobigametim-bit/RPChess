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
