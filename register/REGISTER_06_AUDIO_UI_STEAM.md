# REGISTER 06 — UI SERIES, AUDIO AND STEAM PUBLICATION

Part of `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## Additional P1 visual series

| ID / exact series | Quantity/spec | Ready-to-use prompt | Acceptance | Status |
|---|---|---|---|---|
| KINGDOM-001 `assets/kingdom/buildings/{throne,training,barracks,forge,infirmary,archive,embassy,trials}.jpg` | 8 × 1600×900 | Eight RPChess kingdom building scenes with distinct functions and one shared capital architecture; heroic dark fantasy, strong right-side focal subject, calm text-safe zones, no text. | series consistency; function recognizable; full image displayable; manifest/rights pass | MISSING |
| STATUS-001 `assets/ui/statuses/{ward,marked,bound,silenced,cursed,provoked,injured_light,injured_heavy,injured_critical}.png` | 9 × 512×512 RGBA | Consistent status icon family using shape plus color; one centered symbol; readable at 32 px; transparent. | grayscale distinction; no color-only meaning; clean alpha | MISSING |
| OBJECT-REGIONS `assets/regions/<region>/objects.png` | 6 sheets, each 2048×2048 4×4 | Region-specific top-down obstacles, portals, traps, altars, hazards and objectives; exact cell footprints; transparent. | 96 objects total; no overlap/crop; collision metadata | MISSING |
| TUTORIAL-001 `assets/tutorial/chapters/chapter_01.jpg`…`chapter_24.jpg` | 24 × 1600×900 | Clean instructional chess scenes, one concept per image, large readable pieces, uncluttered board, no embedded text/arrows that require localization. | concept readable; RU/EN overlays fit; no false legal position | MISSING |
| INPUT-001 `assets/ui/input_glyphs/<device>/<action>.png` | keyboard, mouse, Xbox, PlayStation, Steam Deck | Monochrome high-contrast input glyph family, transparent, consistent stroke and optical size. | automatic switching; legal platform symbols; readable at 24 px | MISSING |
| ACHIEVEMENT-001 `assets/achievements/achievement_001.png`…`060.png` | 60 × 512×512 | Achievement medal family with chess/kingdom motifs and cosmetic accents; readable silhouette at 64 px; no text. | every icon distinct; locked/unlocked treatment; Steam import ready | MISSING |
| COSMETIC-001 `assets/cosmetics/{boards,pieces,banners,frames}/` | release reward set | Cosmetic-only fantasy variants preserving classic silhouettes, cell contrast and legal-state readability. | no gameplay advantage; board highlights pass contrast tests | MISSING |
| CHRONICLE-001 `assets/chronicle/{victory,defeat,alliance,betrayal,hero,secret}.png` | 6 reusable illustrations, 1600×900 | Illustrated illuminated-manuscript Chronicle scenes with calm text areas and no baked text. | supports modular epilogues; full-art display; no misleading unique event reuse | MISSING |
| EDITOR-001 `assets/editor/{tools,objects,objectives,validation}.png` | 4 sheets × 16 icons | Clear visual editor icon family for board, pieces, objects, portals, objectives, phases, validation and test play. | understandable at 32 px; controller focus states | MISSING |

## Music production register

Masters: WAV 48 kHz/24-bit; runtime OGG plus optional MP3 fallback. Target −16 to −14 LUFS integrated, no clipping, no vocals or recognizable borrowed melody. Track metadata, composer/generator provenance and commercial rights are mandatory.

Playlist behavior: randomized shuffled queue; no immediate repeat; complete queue before reshuffle where possible; crossfade; architecture supports later per-context playlists.

| ID / runtime file | Use | Duration/brief | Priority | Status |
|---|---|---|---|---|
| MUSIC-001 `assets/audio/music/menu_theme.ogg` | menu/capital | ~3:00, majestic restrained fantasy, harp/low strings/wordless texture | P1 | MISSING |
| MUSIC-002 `campaign_01.ogg` | campaign | ~3:00, travel and political uncertainty, loopable | P1 | EXISTS-VERIFY candidate |
| MUSIC-003 `battle_01.ogg` | ordinary battle | ~2:30, tactical pulse without trailer booms | P1 | EXISTS-VERIFY candidate |
| MUSIC-004 `elite_01.ogg` | elite | ~2:30, asymmetric tension, clean loop | P1 | EXISTS-VERIFY candidate |
| MUSIC-005 `boss_01.ogg` | boss | ~3:30, multi-phase arc without constant maximum intensity | P1 | EXISTS-VERIFY candidate |
| MUSIC-006 `ending_01.ogg` | victory/epilogue | ~2:40, hopeful bittersweet resolution | P1 | MISSING |
| MUSIC-007…012 `regional_<region>.ogg` | six regions | 2:30–3:30 each; faction instruments/palette without stereotypes | P2/P1 polish | MISSING |

The current four “Echoes of the Iron Throne” tracks may fill MUSIC-002…005 only after rights, loop, loudness and context review.

## SFX production register

Masters: WAV 48 kHz/24-bit; runtime OGG. Repeated actions require 3–6 perceptibly different variants. No spoken words, pain voices or excessive sub-bass. Route to independent UI, ambience and gameplay buses.

| ID / exact file series | Use | Duration/ready production brief | Priority | Status |
|---|---|---|---|---|
| SFX-001 `ui_hover_01.ogg`…`04.ogg` | hover/focus | 0.08 s soft parchment-metal ticks | P0 | MISSING |
| SFX-002 `ui_confirm_01.ogg`…`03.ogg` | confirm | 0.15 s warm crystal/wood | P0 | MISSING |
| SFX-003 `ui_cancel_01.ogg`…`03.ogg` | back/cancel | 0.15 s muted descending metal/wood | P0 | MISSING |
| SFX-004 `piece_select_<material>_01.ogg`… | select | 0.12 s contact plus restrained shimmer | P0 | MISSING |
| SFX-005 `piece_move_{stone,metal,wood}_01.ogg`…`04.ogg` | movement | ~0.25 s grounded slide/step; no impact boom | P0 | MISSING |
| SFX-006 `piece_capture_01.ogg`…`06.ogg` | capture | ~0.35 s magical material break/removal, no gore | P0 | MISSING |
| SFX-007 `check.ogg` | check | ~0.5 s urgent crown chime, restrained low hit | P0 | MISSING |
| SFX-008 `checkmate.ogg` | checkmate | ~1.2 s decisive crown seal/harmonic resolution | P0 | MISSING |
| SFX-009 `promotion.ogg` | promotion | ~1.0 s ascending transformation | P0 | MISSING |
| SFX-010 `order_gain.ogg` | order point gain | ~0.25 s banner/rune pulse | P1 | MISSING |
| SFX-011 `order_spend.ogg` | order point spend | ~0.25 s command stamp, no voice | P1 | MISSING |
| SFX-012 `status_<status>_apply.ogg` | nine statuses | ~0.3 s consistent but distinguishable family | P1 | MISSING |
| SFX-013 `environment_<type>_01.ogg`… | portal/fire/ice/altar/trap/object/seal | 0.3–1.5 s; 3 variants where repeated | P1 | MISSING |
| SFX-014 `injury_{light,heavy,critical}.ogg` | post-battle injury | ~0.7 s somber cloth/armor, no voice | P1 | MISSING |
| SFX-015 `reward_reveal.ogg` | reward cards | ~0.8 s three-card shimmer/parchment | P1 | MISSING |
| SFX-016 `assets/audio/sfx/win_fanfare.mp3` | battle reward and final victory | supplied file; trigger once after every won battle and on final victory | P0 | EXISTS-VERIFY |
| SFX-017 `defeat.ogg` | defeat screen | ~1.4 s restrained fall, no melodramatic blast | P1 | MISSING |
| SFX-018 `relic_activate_01.ogg`…`06.ogg` | active relics | 0.4–0.9 s magical object family | P1 | MISSING |
| SFX-019 `boss_phase.ogg` | boss transition | ~1.2 s readable escalation without masking board | P1 | MISSING |
| SFX-020 `save_checkpoint.ogg` | optional save cue | 0.12 s very subtle; toggleable | P2 | MISSING |

Fanfare acceptance additionally requires packaging locally in the release source/artifact; release builds must not depend on downloading it from Google Drive.

## Steam store and library assets — P1

Sizes must be rechecked against the current Steamworks graphical-asset specification at production time. Store images must depict final truthful gameplay, not concept UI.

| ID / exact file | Size/use | Ready-to-use prompt/brief | Status |
|---|---|---|---|
| STEAM-001 `steam/capsule_header_460x215.png` | 460×215 header | RPChess logo and one high-contrast chess-fantasy confrontation; minimal detail, title fully safe. | MISSING |
| STEAM-002 `steam/capsule_small_231x87.png` | 231×87 small | Logo plus iconic crown/board silhouette, extremely simple. | MISSING |
| STEAM-003 `steam/capsule_main_616x353.png` | 616×353 main | Heroic dark-fantasy chess confrontation, readable title, no tiny copy. | MISSING |
| STEAM-004 `steam/capsule_vertical_374x448.png` | 374×448 vertical | Crown above tactical board, two political/faction figures, safe title. | MISSING |
| STEAM-005 `steam/library_hero_3840x1240.jpg` | library hero | Wide kingdom/battle panorama, focal center/right and logo-safe area. | MISSING |
| STEAM-006 `steam/library_logo_1280x720.png` | transparent logo | RPChess wordmark/crest only, generous margin. | EXISTS-VERIFY derivative |
| STEAM-007 `steam/library_capsule_600x900.jpg` | library capsule | Vertical key art with crown, board and six subtle faction hints. | MISSING |
| STEAM-008 `steam/screenshots/01.jpg`…`12.jpg` | 1920×1080 | Final truthful screens: campaign, deployment, ordinary battle, boss, event, kingdom, hero, relic, tutorial, editor, endless and Steam Deck layout. | MISSING |
| STEAM-009 `steam/trailer_shotlist.md` | 60–90 s trailer plan | Opening identity, legal chess hook, roguelite choices, factions, bosses, kingdom, modes, final CTA; no feature not present in build. | MISSING |

## Workflow/status gate

Statuses: `MISSING`, `PLACEHOLDER`, `IN PRODUCTION`, `REVIEW`, `EXISTS-VERIFY`, `APPROVED`.

No P0/P1 record may remain outside `APPROVED` in the release candidate. Approval requires exact dimensions/format, manifest reference, in-game review, accessibility/readability check, RU/EN text independence and commercial provenance.
