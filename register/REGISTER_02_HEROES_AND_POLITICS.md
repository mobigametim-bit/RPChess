# REGISTER 02 — NAMED HEROES AND POLITICAL CHARACTERS

Part of `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## Named-hero production series

Every hero record requires:

- `assets/heroes/<slug>/portrait.png` — 768×768 PNG/JPG, safe square/circle crop;
- `assets/heroes/<slug>/piece_badge.png` — 512×512 PNG RGBA, transparent, preserves classic piece silhouette;
- `assets/heroes/<slug>/ability_icon.png` — 512×512 PNG RGBA;
- RU/EN biography, recruitment event, personal event, unique ability and at least six reaction lines in data/localization.

**Shared ready-to-use prompt:** “Portrait of [NAME], RPChess named [PIECE] hero from [FACTION], [MECHANICAL/CHARACTER BRIEF]. Heroic dark fantasy, faction materials and crest, distinct face, strong upper-body silhouette, calm background, no text. Derive a matching transparent board badge that preserves the classic [PIECE] silhouette and a single-object ability icon. Keep identity, age, costume and colors consistent across the three assets.”

**Negative requirements:** no generic MMO armor, no modern objects, no embedded text, no hidden-position symbolism, no duplicate limbs, no cropped head/base, no replacement of chess silhouette by an unrelated humanoid class.

**Acceptance:** portrait/badge/icon match; faction readable; role recognizable at board scale; unique mechanic represented without clutter; commercial rights recorded; all localization and data references valid.

## 36 named heroes

| ID / slug | Faction / piece | Priority | Name and mechanical-character brief | Status |
|---|---|---|---|---|
| HERO-01 `aldric_wall` | Iron Marches / rook | P0 | **Альдрик Стена** — veteran defender who can interpose once per battle. | MISSING |
| HERO-02 `mara_chain` | Iron Marches / pawn | P0 | **Мара Цепь** — former prisoner leading pawn formations. | MISSING |
| HERO-03 `brother_orell` | Iron Marches / bishop | P0 | **Брат Орелл** — forge-priest controlling blocked lines. | MISSING |
| HERO-04 `vael_hammer` | Iron Marches / knight | P0 | **Ваэль Молот** — heavy cavalry with a constrained, clearly previewed charge. | MISSING |
| HERO-05 `lady_sorn` | Iron Marches / queen | P0 | **Леди Сорн** — political hostage and elite tactician. | MISSING |
| HERO-06 `tomas_gate` | Iron Marches / king | P0 | **Томас Вратарь** — temporary escort hero with a gate command. | MISSING |
| HERO-07 `seraph_lyra` | Luminous Synod / bishop | P1 | **Серафима Лира** — healer who sanctifies one diagonal. | MISSING |
| HERO-08 `ivar_lens` | Luminous Synod / rook | P1 | **Ивар Линза** — observatory engineer rotating visible rune mirrors. | MISSING |
| HERO-09 `nemea_quill` | Luminous Synod / pawn | P1 | **Немея Перо** — scholar pawn preserving promotion memory. | MISSING |
| HERO-10 `orion_step` | Luminous Synod / knight | P1 | **Орион Шаг** — astral navigator using marked landing cells. | MISSING |
| HERO-11 `abbess_celene` | Luminous Synod / queen | P1 | **Аббатиса Селена** — strict reformer with a costly silence ability. | MISSING |
| HERO-12 `deacon_mirel` | Luminous Synod / bishop | P1 | **Диакон Мирель** — doubter whose power grows from mercy choices. | MISSING |
| HERO-13 `cassian_coin` | Free Cities / rook | P1 | **Кассиан Монета** — merchant captain converting protected trade cells into orders. | MISSING |
| HERO-14 `viola_mask` | Free Cities / queen | P1 | **Виола Маска** — diplomat with a contract-based ability. | MISSING |
| HERO-15 `renzo_bridge` | Free Cities / pawn | P1 | **Ренцо Мост** — creates a temporary safe route after promotion progress. | MISSING |
| HERO-16 `tessa_gull` | Free Cities / knight | P1 | **Тесса Чайка** — harbor rider with a flank rescue. | MISSING |
| HERO-17 `old_marin` | Free Cities / bishop | P1 | **Старый Марин** — retired judge exposing marked enemies. | MISSING |
| HERO-18 `elio_silk` | Free Cities / pawn | P1 | **Элио Шёлк** — spy whose value is information, never hidden board position. | MISSING |
| HERO-19 `briar_sister` | Thorn Covenant / bishop | P1 | **Сестра Терн** — forest oracle linking two visible rune cells. | MISSING |
| HERO-20 `roan_stag` | Thorn Covenant / knight | P1 | **Роан Олень** — guardian rider using portal exits. | MISSING |
| HERO-21 `maeve_root` | Thorn Covenant / rook | P1 | **Мейв Корень** — living bulwark anchoring a line. | MISSING |
| HERO-22 `puck_ember` | Thorn Covenant / pawn | P1 | **Пак Уголёк** — trickster pawn with deterministic transformation choice. | MISSING |
| HERO-23 `lord_aylen` | Thorn Covenant / king | P1 | **Лорд Айлен** — disputed leader used in escort scenarios. | MISSING |
| HERO-24 `ysra_moss` | Thorn Covenant / queen | P1 | **Исра Мох** — ancient mediator with an environment trade-off. | MISSING |
| HERO-25 `kael_cinder` | Ashen Dominion / pawn | P1 | **Каэль Уголь** — soldier receiving a choice after an ally’s voluntary sacrifice. | MISSING |
| HERO-26 `velka_urn` | Ashen Dominion / bishop | P1 | **Велька Урна** — funerary mage returning memory, not dead bodies. | MISSING |
| HERO-27 `rath_banner` | Ashen Dominion / rook | P1 | **Рат Знамя** — standard bearer strengthening formations. | MISSING |
| HERO-28 `suri_ash` | Ashen Dominion / knight | P1 | **Сури Пепел** — exile rider with a risky rescue leap. | MISSING |
| HERO-29 `empress_nahla` | Ashen Dominion / queen | P1 | **Императрица Нахла** — possible ruler or boss with a debt-based command. | MISSING |
| HERO-30 `daro_last` | Ashen Dominion / pawn | P1 | **Даро Последний** — survivor whose scar alters future events. | MISSING |
| HERO-31 `temur_wind` | Sky Khanate / knight | P1 | **Темур Ветер** — mobile commander with bounded reserve acceleration. | MISSING |
| HERO-32 `altana_bow` | Sky Khanate / bishop | P1 | **Алтана Лук** — diagonal sentinel reading open terrain. | MISSING |
| HERO-33 `batu_cliff` | Sky Khanate / rook | P1 | **Бату Утёс** — cliff-fort keeper controlling edge files. | MISSING |
| HERO-34 `saran_dawn` | Sky Khanate / pawn | P1 | **Саран Рассвет** — young envoy with promotion diplomacy. | MISSING |
| HERO-35 `khulan_star` | Sky Khanate / queen | P1 | **Хулан Звезда** — rival claimant with a tempo command. | MISSING |
| HERO-36 `ergen_cloud` | Sky Khanate / king | P1 | **Эрген Облако** — escort hero visibly changing reserve cells. | MISSING |

## Political portrait production series

Each political record requires `assets/politics/<slug>.png`, 768×768 PNG/JPG; a data record with role, ideology, faction, relationships and possible outcomes; RU/EN dialogue/event keys.

**Shared prompt:** “Political court portrait of [NAME], [ROLE] of [FACTION] in RPChess. Heroic dark fantasy, faction materials and crest, visually authoritative and morally ambiguous rather than villain-coded, calm readable background, no text. Make the face, status and ideology distinct from every other leader in the faction.”

**Acceptance:** distinct face/age/posture; faction relation without interchangeability; safe crop; no absolute-evil coding; at least two credible political routes; rights recorded.

## 18 central political characters

| ID / filename | Faction | Character role | Status |
|---|---|---|---|
| POL-01 `marshal_varn.png` | Iron Marches | Маршал Варн — military continuity candidate. | MISSING |
| POL-02 `heir_elda.png` | Iron Marches | Наследница Эльда — dynastic reform candidate. | MISSING |
| POL-03 `guildmaster_borek.png` | Iron Marches | Цехмейстер Борек — industrial councils and worker power. | MISSING |
| POL-04 `pontiff_aelia.png` | Luminous Synod | Понтифик Элия — orthodox unity. | MISSING |
| POL-05 `archivist_noem.png` | Luminous Synod | Архивист Ноэм — truth, records and controlled reform. | MISSING |
| POL-06 `heretic_salos.png` | Luminous Synod | Еретик Салос — radical doctrinal break. | MISSING |
| POL-07 `consul_marco.png` | Free Cities | Консул Марко — merchant oligarchy. | MISSING |
| POL-08 `speaker_ines.png` | Free Cities | Спикер Инес — civic assembly and contracts. | MISSING |
| POL-09 `admiral_rava.png` | Free Cities | Адмирал Рава — security and maritime expansion. | MISSING |
| POL-10 `warden_roan.png` | Thorn Covenant | Хранитель Роан — traditional border compact. | MISSING |
| POL-11 `bride_melis.png` | Thorn Covenant | Невеста Мелис — living pact and transformation. | MISSING |
| POL-12 `huntsman_orr.png` | Thorn Covenant | Ловчий Орр — militant isolation. | MISSING |
| POL-13 `empress_nahla_p.png` | Ashen Dominion | Императрица Нахла — debt-bound imperial continuity. | MISSING |
| POL-14 `general_dor.png` | Ashen Dominion | Генерал Дор — military reconstruction. | MISSING |
| POL-15 `priestess_velka.png` | Ashen Dominion | Жрица Велька — funerary law and reconciliation. | MISSING |
| POL-16 `khan_temur.png` | Sky Khanate | Каган Темур — confederate war leadership. | MISSING |
| POL-17 `princess_khulan.png` | Sky Khanate | Княжна Хулан — centralizing claimant. | MISSING |
| POL-18 `speaker_batu.png` | Sky Khanate | Говорящий Бату — clan assembly and negotiated rule. | MISSING |

## Production and narrative acceptance gate

- all 54 identities have model sheets and unique stable IDs;
- every named hero has a legal, testable ability that does not secretly alter classic geometry;
- every political character supports at least two coherent outcomes;
- RU/EN text complete and externalized;
- portraits pass 160 px readability and crop tests;
- no permanent lockout of a named hero solely because one recruitment offer was declined;
- all records reach `APPROVED` before release.
