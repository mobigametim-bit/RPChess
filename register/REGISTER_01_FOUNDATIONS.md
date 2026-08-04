# REGISTER 01 — FOUNDATIONS, REGIONS, KINGS AND DOCTRINES

Part of `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## Shared style anchors

**STYLE-FANTASY** — heroic dark fantasy for a premium tactical chess roguelite; elegant medieval forms; luminous magic; readable silhouettes; deep navy/charcoal shadows balanced by warm gold and regional accents; painterly detail without grimdark mud; no modern technology, text, watermark or borrowed franchise symbols.

**STYLE-PIECES** — compact stylized chess warrior that is immediately recognizable as pawn, knight, bishop, rook, queen or king at 72 px; centered slight three-quarter view; clear base footprint; restrained ornament; transparent background; no plate, frame or text.

**STYLE-UI** — premium fantasy strategy interface; pale parchment or deep navy surfaces; restrained gold/silver filigree; sapphire accents; decorative corners but a clear center; suitable for nine-slice scaling; no embedded text.

**STYLE-SCENES** — 1600×900 cinematic heroic-dark-fantasy scene; strong focal subject; uncluttered; left 38% calm for header text and focal art weighted right where applicable; full composition must also work with `object-fit: contain`; no text/logo/watermark.

## Inherited production profiles

| Profile | Technical specification | Safe area / animation | Readability and acceptance |
|---|---|---|---|
| ICON-512 | 512×512 PNG RGBA | 12% edge margin; static | One centered object; recognizable at 64 px; clean alpha |
| PORTRAIT-768 | 768×768 PNG/JPG | 8% head/edge margin | Identity stable; face/hands correct; safe square and circle crop |
| PIECE-512 | 512×512 PNG RGBA | 10% around silhouette/base | Classic role recognized in blind test at 72 px; no frame |
| SCENE-1600 | 1600×900 JPG/PNG | 5% global; declared text-safe area | Major shapes readable at 800×450; full art displayable without crop |
| BOARD-2048 | 2048×2048 PNG | outer 6% reserved for frame/coordinates | Exact grid alignment; texture never obscures highlights |
| OBJECT-SHEET | 2048×2048 PNG RGBA, 4×4 | 8% per cell | 16 centered objects with documented collision footprint |
| VFX-SHEET | 2048×2048 PNG RGBA, 8×8 | stable center; declared active frame count | Alpha clean; effect does not hide board or delay input |
| MUSIC | WAV 48 kHz/24-bit master + runtime OGG/MP3 | 2–4 min; loop/crossfade declared | no clipping, no vocals, rights metadata, seam tested |
| SFX | WAV 48 kHz/24-bit + runtime OGG | 0.08–3 sec; 3–6 variants for repeated actions | distinct, mix-safe, no speech, normalized |

All entries inherit: no text unless explicitly requested; no micro-detail clutter; provenance/license recorded; status is not `APPROVED` until dimensions, visual consistency, in-game readability and rights checks pass.

## P0 branding, UI and core-board assets

| ID / filename | Use | Profile | Prompt | Status |
|---|---|---|---|---|
| BRAND-001 `assets/branding/logo_main.png` | Main menu/Steam identity | ICON-512 | RPChess crest combining crown, classic chess motifs and a subtle magical board pattern; premium readable silhouette; isolated. | EXISTS-VERIFY |
| BRAND-002 `assets/branding/title_wordmark.png` | Header/menu wordmark | 1600×400 PNG RGBA | RPChess wordmark, elegant readable medieval-fantasy lettering, horizontal, isolated; avoid illegible blackletter. | EXISTS-VERIFY |
| UI-001 `assets/ui/panel_frame_9slice.png` | Universal panel | BOARD-2048 | Nine-slice border with sapphire corners, restrained gold/silver filigree and transparent clear center. | EXISTS-VERIFY |
| UI-002 `assets/ui/button_primary_9slice.png` | Primary actions | 1600×256 PNG RGBA | Ivory center, gold edge, sapphire corners, large uninterrupted text field. | EXISTS-VERIFY |
| UI-003 `assets/ui/button_secondary_9slice.png` | Secondary actions | 1600×256 PNG RGBA | Deep navy center, silver/gold edge, restrained highlights. | EXISTS-VERIFY |
| UI-004 `assets/ui/button_danger_9slice.png` | Destructive actions | 1600×256 PNG RGBA | Dark ruby center, blackened silver, red crystals; no gore. | EXISTS-VERIFY |
| UI-005 `assets/ui/focus_ring.png` | Controller/keyboard focus | ICON-512 | Gold-blue luminous outline with transparent center, visible on light/dark surfaces. | MISSING |
| BOARD-001 `assets/boards/neutral/board_8x8.png` | Default battle | BOARD-2048 | Exact top-down 8×8 pale stone/blue-gray slate board, subtle wear, no objects or perspective. | MISSING |
| BOARD-002 `assets/boards/neutral/blocked_cell.png` | Blocked overlay | ICON-512 | Top-down cracked stone obstruction constrained to one cell. | MISSING |
| BOARD-003 `assets/boards/neutral/start_zone.png` | Deployment overlay | ICON-512 | Translucent green-gold heraldic boundary, transparent center. | MISSING |
| VFX-001 `assets/vfx/legal_move.png` | Legal move | ICON-512 | Soft cyan circular rune, unobtrusive, transparent. | EXISTS-VERIFY |
| VFX-002 `assets/vfx/capture_move.png` | Capture target | ICON-512 | Magenta-red angular capture rune, no blood. | EXISTS-VERIFY |
| VFX-003 `assets/vfx/check.png` | Check warning | ICON-512 | Sharp gold/red crown warning sigil. | MISSING |
| VFX-004 `assets/vfx/checkmate.png` | Checkmate | VFX-SHEET, 24 active frames | Crown seal forms with gold fractures and dark-red collapse, localized to king cell. | MISSING |
| VFX-005 `assets/vfx/piece_capture.png` | Capture animation | VFX-SHEET, 24–32 frames | Fast magical shatter/dissolve under 0.45 sec; neutral faction use. | MISSING |
| VFX-006 `assets/vfx/promotion.png` | Promotion | VFX-SHEET, 48 frames | Pawn rises through gold-blue crown light and resolves to selected piece; no preselected queen. | MISSING |

## Six main region/faction art kits — P1

Each kit contains exactly: `map_banner.jpg`, `capital.jpg`, `battle.jpg`, `elite.jpg`, `boss_arena.jpg`, `crest.png`, `board_skin.png`, `environment_sheet.png`. Scenes use SCENE-1600; crest ICON-512; board BOARD-2048; objects OBJECT-SHEET. Battle images keep the board area calm. All eight files must share palette/material language.

| ID / folder | Identity and tactical language | Ready-to-use series prompt | Status |
|---|---|---|---|
| REGION-01 `assets/regions/iron_marches/` | Crown of Stone; mountain fortresses, black iron, amber furnaces; rook defense and lines | Create the complete RPChess Iron Marches kit: heroic dark-fantasy mountain citadels, black iron, amber furnace light, disciplined defensive geometry, readable board space; one map banner, capital panorama, battle backdrop, elite backdrop, boss arena, crest, exact top-down board skin and 16-object transparent environment sheet; consistent series, no text. | MISSING |
| REGION-02 `assets/regions/thorn_covenant/` | ancient forest borders, living stone, green-gold thorns; knight portals/ambushes | Create the complete Thorn Covenant kit with ancient forest courts, living stone, green-gold thorn magic and mobile knight/portal motifs; same eight-file specification; readable, beautiful, not cluttered. | MISSING |
| REGION-03 `assets/regions/ashen_dominion/` | volcanic royal roads, ash-red banners, funerary gold; pawn formations/sacrifice | Create the complete Ashen Dominion kit with volcanic roads, ash-red standards and funerary gold; same eight-file specification; tragic but heroic, no gore. | MISSING |
| REGION-04 `assets/regions/sky_khanate/` | high steppe/cliff citadels, turquoise/bronze; cavalry/reserve | Create the complete Sky Khanate kit with high steppe, cliff cities, turquoise cloth and bronze; same eight-file specification; wide open movement language. | MISSING |
| REGION-05 `assets/regions/luminous_synod/` | cathedral cities, pearl/gold/cyan; bishops, altars, sanctified diagonals | Create the complete Luminous Synod kit with luminous cathedrals, pearl stone, gold and cyan sacred geometry; same eight-file specification; solemn rather than sterile. | MISSING |
| REGION-06 `assets/regions/free_cities/` | river trade league, copper/teal/crimson; queens/heroes/contract politics | Create the complete League of Free Cities kit with river ports, guild towers, copper, teal and crimson; same eight-file specification; prosperous, politically divided, readable tactical spaces. | MISSING |

## Two rare faction directions — P1

| ID / folder | Required files | Prompt | Status |
|---|---|---|---|---|
| RARE-01 `assets/regions/mirror_conclave/` | `map_banner`, `battle`, `boss_arena`, `crest`, `board_skin`, `environment_sheet` | Rare Mirror Conclave kit: silver glass, blue-violet reflections, doubled architecture and strictly readable mirror mechanics; no visual duplication that hides actual piece position. | MISSING |
| RARE-02 `assets/regions/verdant_exiles/` | same six files | Rare Verdant Exiles kit: wandering living citadels, mossed ivory, emerald/amber growth and reformist political symbolism; beautiful and hopeful, not generic elves. | MISSING |

## Seven kings — individual P0/P1 records

Each record requires `portrait.png` (PORTRAIT-768), `piece.png` (PIECE-512), `command_icon.png` and `passive_icon.png` (ICON-512). Portrait and piece must clearly match; piece keeps classic king silhouette. Prompts describe mechanics visually without text or generic `+%` symbols.

| ID / folder | Priority | Mechanical/visual brief and prompt | Status |
|---|---|---|---|
| KING-01 `assets/kings/oathkeeper/` | P0 | **Хранитель Клятвы** — balanced law and once-per-battle protection with visible oath cost; dignified blue-gold regalia, sealed chains and an unbroken crown. Produce four required files. | MISSING |
| KING-02 `assets/kings/stone_crown/` | P0 | **Каменная Корона** — fortification/rook coordination, slow scouting and costly repositioning; granite-and-iron monarch with amber seams. Produce four files. | MISSING |
| KING-03 `assets/kings/wanderer_queen/` | P1 | **Странствующая Королева** — hero-focused elite court with reduced cheap recruitment; travel-worn royal mantle, portable crown and star map. Produce four files. | MISSING |
| KING-04 `assets/kings/pilgrim/` | P1 | **Паломник Света** — recovery, sanctified cells and mercy, limited aggression; pearl-gold pilgrim regalia and lantern crown. Produce four files. | MISSING |
| KING-05 `assets/kings/fox_prince/` | P1 | **Лисий Принц** — scouting, route manipulation and feints with fragile economy; copper-red court attire, fox heraldry but human monarch. Produce four files. | MISSING |
| KING-06 `assets/kings/ash_regent/` | P1 | **Пепельный Регент** — voluntary sacrifice/comeback orders with explicit injury risk; ash-black armor, ember crown, restrained funeral symbolism. Produce four files. | MISSING |
| KING-07 `assets/kings/nameless_heir/` | P1 | **Безымянный Наследник** — bounded mirror/reality mechanics; half-restored silver crown, identity concealed but not faceless horror. Produce four files. | MISSING |

## Six release doctrines — P0/P1

Each series: `emblem.png` 512×512 plus `node_01.png`…`node_05.png` 256×256 PNG RGBA. Emblem readable at 64 px; nodes mechanically distinct; no numbering/text baked into art.

| ID / folder | Priority | Prompt | Status |
|---|---|---|---|
| DOCTRINE-01 `assets/doctrines/fortress/` | P0 | Six-icon **Крепость** series: rook defense, king safety, walls, held lines; gold-blue with iron accent. | MISSING |
| DOCTRINE-02 `assets/doctrines/cavalry/` | P0 | Six-icon **Кавалерия** series: knight mobility, flanks and fast reserve deployment; turquoise/bronze accent. | MISSING |
| DOCTRINE-03 `assets/doctrines/sacred_diagonals/` | P1 | Six-icon **Священные диагонали** series: bishops, runes, altars, sanctified cells; pearl/cyan accent. | MISSING |
| DOCTRINE-04 `assets/doctrines/pawn_ascension/` | P1 | Six-icon **Возвышение пешек** series: formations, advance, promotion and collective protection; red/gold accent. | MISSING |
| DOCTRINE-05 `assets/doctrines/royal_court/` | P1 | Six-icon **Королевский двор** series: queen, named heroes and expensive elite army; violet/gold accent. | MISSING |
| DOCTRINE-06 `assets/doctrines/gambit/` | P1 | Six-icon **Гамбит** series: voluntary sacrifice, consequences, return and exchange; ember/blackened silver accent. | MISSING |

## Acceptance gate

This annex is complete only when every P0/P1 record has:

1. exact filename and dimensions;
2. source/provenance and commercial distribution rights;
3. manifest entry and content reference validation;
4. in-game review at target and Steam Deck resolution;
5. no crop, embedded text, unreadable silhouette or frame overflow;
6. status `APPROVED`.
