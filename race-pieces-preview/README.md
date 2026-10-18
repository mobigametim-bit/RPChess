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

Touch test isolation: the 844x390 mouse regression uses the usual page; a second touch-enabled Chromium page tests real finger pointer events separately. Production drag behavior unchanged.

Final quick-follow-up regression: a newly pressed chess square clears the preceding drag's synthetic-click guard; the guard lasts only 90 ms. This preserves drag then click on the same square in multi-ply Training puzzles.

Touch stability: highlighting a dragged piece now modifies existing cells instead of rebuilding the touched DOM subtree; all three board owners restore selection on abandoned drops. Preserve both touch and mouse pointer streams.


## Approved death-screen centering polish (2026-10-18)
- The Starvation outcome for a companion or King now omits its corner logo and centers the portrait/text panel on the viewport.
- Mercenary nonpayment deaths center the Battle aftermath and hide its logo, while ordinary Battle aftermath retains its original branding.
- The Battle run-end fallback for King death has no logo and centers the outcome frame.
- Existing browser regressions exercise death screens and compact landscape viewports.
- GitHub Pages CI also includes touch-drag emulation; pace physical touch events in Chromium rather than coalescing them.
- No changes to gameplay rules or production main until owner approves.


## Hero art regression & pawn portrait acceptance (2026-10-18)
- Eight user-supplied PNG pawn portraits from the `пешки_портреты.zip` upload converted to 512x512 WebP (approx. 0.713 MB total instead of 19.29 MB).
- Stored as `assets/heroes/<slug>/portrait_named.webp`, keeping original PNG portraits for backwards compatibility.
- Old runs and temporary battle objects without current `pieceArt` must still resolve non-pawn named pieces to the hero's own `piece_badge.png`, not an ordinary race sprite. Those older figures keep their aura and glyph.
- Named pawn/promotion art from PR #160 remains unchanged (80 white/black chess pieces).
- Roster details, healing/recruitment in Settlement, Caravan healing/new-hero rewards, and Starvation portraits use the new portrait resolver.
- Acceptance tests assert personal badge retention, promotion artwork, and new pawn rewards on stale saved-run objects.

Mobile drag reliability: after actual drag threshold the board captures the pointer and releases it after drop/cancel; ordinary tap-to-select still uses the square click. The existing desktop/mobile browser scenario waits for the actual dragged-piece preview and releases after paced movement, with no artificial move injection or bypassed assertions.


## Full-viewport Training centering and selected King portrait (2026-10-18)
- Training's old landscape right-anchored 100dvh chessboard is replaced with the same symmetric viewport-centered geometry as Combat/Arena; task and Settings occupy the left rail, with responsive rail widths.
- Existing click/touch puzzle interaction and objectives remain unchanged.
- The Power badge in Battle and Skirmish outcomes binds the current saved run's commanderId to the compressed commander portrait (no hardcoded Oathkeeper PNG).
- Tests assert the Training board center and nonoverlap on 844x390 and 667x300, plus an Ash Regent portrait in Battle results.
- No production main merge before owner visual confirmation.

Training-centered final CI follow-up: static Puzzle owner regression updated to require the new stylesheet cache key and the three-column viewport-centered geometry. The run uses the actual selected Ash Regent commander portrait in the Battle Power badge regression.

Square Training board follow-up: both the Training board and its wrapper now use the identical computed viewport dimension, with border-box sizing, instead of percentage-based height. Browser assertion reports full geometry if there is any remaining mismatch.

Fix after browser repro: ux-consistency.css fixed BOTH Training board layers to the viewport right with !important. Puzzle owner now positions the board wrapper relative in the centered grid column and its inner board absolute to that square. The Battle regression selects Ash Regent before constructing the Battle's cached active run, and verifies its portrait in the Power result.

Chromium mobile touch diagnostic: on any failed drag assertion, log captured pointer/touch event sequence, target square, ghost presence and committed moveLog; do not bypass move validation or drop coverage.

Verified touch race via CDP diagnostics: transient [data-game-loading] fullscreen overlay intercepted pointerdown before its fade completed; tests now await loading overlay hidden before sending raw touch input, as Playwright's ordinary click already does. Temporary trace logging removed; real move assertion retained.

Training viewport follow-up: remove legacy padding that shifted its newly centered board vertically and cap the task card to the available landscape height with internal scrolling; report exact board/task rectangles on any browser regression.

Desktop Training fix (owner screenshot 1919x907): the legacy compact UI stylesheet recreated a nested puzzle-layout grid for widths >=901px, displacing the board left inside its subgrid. The Training stylesheet now forces display:contents on that nested layout, allowing the centered board square to participate directly in the full-viewport shell grid. The existing puzzles browser regression now checks 1919x907, 1440x900, 1280x720 and 1024x768, in addition to phone landscapes, with overlap and exact viewport-center assertions.

## Seven named Bishop portraits and pieces — 2026-10-19
- Added original user-provided art for Altana Bow, Brother Orell, Velka Urn, Deacon Mirel, Seraph Lyra, Briar Sister and Old Marin.
- 7 transparent 512x512 WebP portraits and 14 transparent 256x256 white/black bishop WebP pieces: total 968822 bytes (97.58% smaller than the supplied PNGs).
- Named bishop identity resolves board art by actual hero ID and side, independent of outdated portrait/pieceArt paths in saved runs; other named figure artwork is unaffected.
- Existing Roster, Settlement, Caravan, Skirmish and Battle portrait/board resolver paths reuse the new art. Old PNG files remain in the repository for compatibility.
- Source validation checks every bishop WebP asset and its byte budget; the extended Battle regression checks all seven named bishops for both colors, old-save portraits, and non-bishop fallback.
- No merge into main. PR #160 remains acceptance-only.

CI follow-up 2026-10-19: in the existing classic-chess-browser landscape case, wait for the scene-loading mask to become hidden before starting the real mouse drag; no fake move injection, and the move assertion remains required.

Regression follow-up: the Battle black-side enemy is now a white-color dark_elves board rook at assets/races/dark_elves/pieces/board/white/rook.png; its older art assertion has been replaced, while the real chess-board render assertion remains.
