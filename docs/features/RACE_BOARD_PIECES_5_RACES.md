# Color-specific race chess pieces — all 14 sets (PR #160)

Status: implemented in the PR160 acceptance branch, awaiting full QA and user's manual approval. No merge to main until accepted.

## Source and size

- First 5 races (humans, orcs, undead, angels, fae): approved `архив_часть_фигур_1_1.zip`; humans use the corrected `white2`/`black2` source.
- Additional 9 races: `архив_часть_фигур_2.zip` (elves, dark_elves, dwarves, demons, dragonborn, beastfolk, constructs, animals, goblins).
- Each race has white and black versions of pawn, knight, bishop, rook, queen, and king: **14 × 2 × 6 = 168 independent PNG sprites**.
- Each delivered runtime file is **256×256 RGBA PNG**, no more than 320 KiB.
- Canonical paths: `game/assets/races/<race>/pieces/board/<white|black>/<pawn|knight|bishop|rook|queen|king>.png`.
- The supplementary source sprites varied from 1024×1024 to 1254×1254, with one non-square original. The converted images have transparent 256px canvases and consistent centering.
- An additive PR-only GitHub Actions importer verified a checksum and all 108 supplementary files before committing separate PNG files. The temporary ZIP transport segments are removed from the final import commit.

## Updated Arena decision (supersedes original first-five plan)

- **Do not retain the old chess piece art in Arena selection screens.** Squad king thumbnails and all 84 opponent thumbnails, including the opponent-details dialog, now use the matching new race sprite.
- `racePiecePath()` and `boardRacePiecePath()` resolve to the same canonical 256px sprite for all 14 races and white/black colors. The `mixed` fallback safely uses humans.
- This applies to Arena matches, Journey Skirmish/Battle/Caravan, Classic chess and Puzzles. All race sets are complete; no obsolete race fallback remains.
- Chess-board decorative color auras and corner role glyphs remain suppressed for the new art. Functional check indicators, selected squares, last move, legal-move hints, artifact overlays and animations remain intact.
- **Named roster heroes and the Run King are excluded from generic race-sprite replacement:** until their dedicated new board art arrives, the King uses `assets/kings/oathkeeper/piece.png`, and named companions use their own `assets/heroes/*/piece_badge.png` on Battle/Skirmish/Caravan boards. Their legacy corner role glyphs and white/black side auras remain visible (check may override with red). The identity follows moves, capture feedback and resume; explicit `boardPieceArt` still overrides the personal `pieceArt` if supplied later.
- Character names, portraits, biographies, purchases, saves, core chess rules and game balance remain unchanged.

## Manual acceptance

1. Arena selection: inspect the new king art on all 14 squad cards, plus all 84 opponent cards and dialog portraits. It should be the same artwork family as the board.
2. Arena matches: inspect all 14 race themes with white and black chess sprites.
3. Journey Battle, Skirmish, Caravan: inspect sprite readability, captures, animation, check, legal moves and artifacts.
4. Classic/Puzzles: the new human sprites appear without white/black decorative aura or role markers.
5. Desktop and mobile landscape: check sprite outlines, contrast and that all assets load without placeholders.
6. Verify 168 dedicated files in the production build and successful browser CI before requesting a merge.

## Follow-up polish (2026-10-16): automatic deployment and asset loading

- All Journey combat route cards (Skirmish / Battle / Caravan) **skip manual formation/preparation screens**. The next intentional decision is the existing artifact-choice modal; the selected chess board then opens directly.
- Deployment is always King-inclusive. Healthy heroes enter automatically; wounded non-King heroes and dead heroes stay out; the wounded Run King remains eligible by existing gameplay rules.
- Battle / Caravan: preserve the canonical 1 King, 1 Queen, 2 Rooks, 2 Bishops, 2 Knights, 8 Pawns slots. All eligible named fighters take those slots when there is space. When a role has more candidates than slots, draw a reproducible random subset seeded by the encounter.
- Skirmish: keep 2–16 pieces, ≤39 points, ≤8 pawns. Use all eligible when they fit; on overflow draw a reproducible, legal seeded subset. Mandatory King and enough healthy companions retain existing eligibility rules.
- Save/resume: Battle and Skirmish continue to checkpoint the chosen IDs; Caravan persists selected IDs and its Chess960 plan. A renewed artifact-phase Caravan route does not create another random team or consume supplies twice.
- The traveling scene remains visible underneath the artifact-choice dialog, and is hidden once the chess board is created. Old preparation screen DOM is not entered during the normal gameplay flow; existing aftermath, rewards, forfeit and game-over screens remain.
- The localized black loading mask is **conditional on pending visible assets**. Arena has explicit loading gates on catalog entry, returning to rivals, entering/resuming the Arena board and rival-dialog images. Dynamically mounted artifact dialogs are included in media/style readiness. Cached scenes must not flash the mask, and failed assets must not trap players.
- Keep `main` unchanged until acceptance. Preview: https://rpchess-race-pieces-preview.mobigametim.workers.dev/ (redeploy branch changes before requesting user verification).
