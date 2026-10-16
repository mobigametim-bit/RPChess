# Color-specific race chess pieces — first five sets (acceptance)

Status: feature-branch implementation; pending CI and manual playtest. Do not merge into main before user approval.

## Source and delivery
- Source: the user's corrected ZIP `архив_часть_фигур_1_1.zip`.
- Source variant for Humans: `white2` and `black2` only.
- Optimized runtime PNG: 256×256 RGBA, 320 KiB max per file.
- Five complete races: humans, orcs, undead, angels, fae.
- Each race has 6 chess types × two canonical colors (white / black), 60 PNG total.
- Files: `game/assets/races/<race>/pieces/board/<white|black>/<pawn|knight|bishop|rook|queen|king>.png`.

## UX ownership / do not regress
- **Arena selection screens for rivals and available squads keep their current images.** The existing `racePiecePath()` and `OPPONENTS[].art` remain unchanged.
- `boardRacePiecePath()` is used only to render chess-board pieces; no replacements of existing `pieces/*.png` or `pieces/white|black/*.png`.
- New board pieces: no oversized technical glyph in the corner, no decorative white/black aura. Retain check highlight, selected/last-move states, possible moves, artifacts and gameplay overlays.
- Legacy races (the other nine) continue displaying their old board art with the existing technical glyph / aura fallback until their complete color sets arrive.
- Named characters retain their names, identities and portraits on roster/preparation cards; on the board they temporarily use the readable race chess sprite. Future `boardPieceArt` overrides take precedence when individual sprite art is prepared.
- Applied to Arena board, Journey Skirmish/Battle/Caravan boards, standard Classic chess and Puzzle boards.
- Chess rules, game balance, saves, and purchases are not altered.

## Acceptance
1. Arena: compare rival and squad cards against `main`; graphics must be the same.
2. Arena match: verify new piece art for each of the five complete races when white and when black.
3. Arena other nine races: old chess imagery and corner marker remain usable.
4. Journey Skirmish, Battle, Caravan: check board art, animated piece moves, check highlight, artifact indicators and captures.
5. Classic and Puzzle boards: readable human white/black pieces without glyph overlays.
6. Mobile landscape and desktop: confirm board silhouettes remain distinguishable.
7. Verify 60 files inside production `dist` and old Arena catalog PNGs remain present.


## Follow-up polish (2026-10-16): automatic deployment and asset loading

- All Journey combat route cards (Skirmish / Battle / Caravan) **skip manual formation/preparation screens**. The next intentional decision is the existing artifact-choice modal; the selected chess board then opens directly.
- Deployment is always King-inclusive. Healthy heroes enter automatically; wounded non-King heroes and dead heroes stay out; the wounded Run King remains eligible by existing gameplay rules.
- Battle / Caravan: preserve the canonical 1 King, 1 Queen, 2 Rooks, 2 Bishops, 2 Knights, 8 Pawns slots. All eligible named fighters take those slots when there is space. When a role has more candidates than slots, draw a reproducible random subset seeded by the encounter.
- Skirmish: keep 2–16 pieces, ≤39 points, ≤8 pawns. Use all eligible when they fit; on overflow draw a reproducible, legal seeded subset. Mandatory King and enough healthy companions retain existing eligibility rules.
- Save/resume: Battle and Skirmish continue to checkpoint the chosen IDs; Caravan persists selected IDs and its Chess960 plan. A renewed artifact-phase Caravan route does not create another random team or consume supplies twice.
- The traveling scene remains visible underneath the artifact-choice dialog, and is hidden once the chess board is created. Old preparation screen DOM is not entered during the normal gameplay flow; existing aftermath, rewards, forfeit and game-over screens remain.
- The localized black loading mask is **conditional on pending visible assets**. Arena has explicit loading gates on catalog entry, returning to rivals, entering/resuming the Arena board and rival-dialog images. Dynamically mounted artifact dialogs are included in media/style readiness. Cached scenes must not flash the mask, and failed assets must not trap players.
- Keep `main` unchanged until acceptance. Preview: https://rpchess-race-pieces-preview.mobigametim.workers.dev/ (redeploy branch changes before requesting user verification).
