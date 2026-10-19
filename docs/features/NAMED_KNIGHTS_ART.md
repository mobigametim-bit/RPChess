# Named Knights (PR #160)

Six named knight heroes have unique compressed runtime art for their saved identity:

| Hero ID | Name | Portrait | White | Black |
| --- | --- | --- | --- | --- |
| vael_hammer | Ваэль Молот | portrait_named.webp | pieces/white/knight.webp | pieces/black/knight.webp |
| orion_step | Орион Шаг | portrait_named.webp | pieces/white/knight.webp | pieces/black/knight.webp |
| roan_stag | Роан Олень | portrait_named.webp | pieces/white/knight.webp | pieces/black/knight.webp |
| suri_ash | Сури Пепел | portrait_named.webp | pieces/white/knight.webp | pieces/black/knight.webp |
| temur_wind | Темур Ветер | portrait_named.webp | pieces/white/knight.webp | pieces/black/knight.webp |
| tessa_gull | Тесса Чайка | portrait_named.webp | pieces/white/knight.webp | pieces/black/knight.webp |

- Supplied originals: 37,368,303 bytes across 18 RGBA PNGs (1254×1254).
- Output: 1,032,180 bytes across 18 alpha-preserving WebPs (640×640 portraits and 256×256 chess pieces), **97.24% smaller**.
- Asset paths live under `game/assets/heroes/<id>/`. Originals `portrait.png` and `piece_badge.png` remain for compatibility.
- `heroPortraitArt` and `boardPieceArtForCharacter` resolve named heroes by stable ID, covering Roster, Settlement, both player piece colors, and old saves.
- No chess rules, hero stats, economy, or opponent pieces are changed.
- Acceptance: `node tests/race-board-themes.cjs`, successful build & preview deployment, then user visual review. Keep PR #160 in Draft until acceptance.
