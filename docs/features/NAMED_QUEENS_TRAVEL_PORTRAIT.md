# Named Queen Art & Travel Commander Portrait — PR #160

Six named Queen characters are compressed and attached to the existing hero IDs:

| Character | Hero ID |
| --- | --- |
| Аббатиса Селена | `abbess_celene` |
| Виола Маска | `viola_mask` |
| Императрица Нахла | `empress_nahla` |
| Исра Мох | `ysra_moss` |
| Леди Сорн | `lady_sorn` |
| Хулан Звезда | `khulan_star` |

Each hero gets `assets/heroes/<id>/portrait_named.webp` (640×640) and `pieces/white/queen.webp`, `pieces/black/queen.webp` (256×256), all transparent WebP. 18 original RGBA PNGs (32,824,599 bytes) became 18 optimized WebPs (1,000,212 bytes): **96.95% size reduction**.

- Portraits are overridden by stable hero ID using `heroPortraitArt` throughout Roster, Settlement, Caravan and Starvation, including older saved runs.
- Side-aware Queen pieces use `boardPieceArtForCharacter` for white and black, with role `queen` or encoded `q`.
- Original pieces of other named heroes, race chess art, commanders and pawn promotion visuals remain unchanged.
- Production build and source verification include all 18 WebP assets; existing regression/browser test suites were extended, with no new permanent suite.
- **Travel commander bug:** Travel header previously read `activeRun.roster.king.portrait`, which can be stale. It now resolves `commanderPortrait(activeRun.commanderId)` and localized `commanderTitle`, consistent with Roster and Chronicle. The hardcoded initial Oathkeeper portrait is removed to prevent flashing. Existing Travel browser test now checks a non-default commander after save/load and menu return.

PR #160 stays Draft and is not merged to `main` pending user visual acceptance.
