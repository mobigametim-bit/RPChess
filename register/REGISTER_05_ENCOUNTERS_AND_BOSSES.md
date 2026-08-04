# REGISTER 05 — ENCOUNTERS AND BOSSES

Part of `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## Encounter production profile

Each encounter is a schema-validated YAML/JSON module containing:

- stable ID/file;
- board/shape and legal initial position;
- player deployment zone and fixed pieces;
- enemy roster profile and AI objective weights;
- 0–2 readable environment types in ordinary battles;
- explicit victory/failure objectives shown before battle;
- reserve/order-point/inter-phase rules;
- difficulty/reward/region tags;
- deterministic generation parameters;
- validation fixtures and reference-bot completion test.

**Ready-to-use prompt:** “Design the RPChess encounter module **[TITLE]** for **[REGION]**, type **[NORMAL/ELITE/OBJECTIVE/RARE]**, using **[REGIONAL TACTICAL LANGUAGE]**. Specify board, legal starting position, deployment zone, enemy roster, at most two environment types, explicit victory/failure objectives, reserve/order rules, difficulty/reward tags and deterministic validation fixtures. The tactical idea must differ materially from every other module, not merely by numbers, names or color.”

**Negative requirements:** no hidden enemy/attack source; no unannounced unavoidable mate; no inaccessible mandatory object; no HP/damage replacement for chess capture; no random unpreviewed rule; no reskin counted as new module.

**Acceptance:** standard-legality or declared scenario-rules validator passes; objective reachable; no illegal king state; all mandatory objects accessible; first-move threat policy passes; Apprentice/Warlord reference bots meet target bands; manual designer completion replay stored.

## Regional module matrix — 84 records

Each region has 14 exact files:

```text
content/encounters/<region>_normal_01.yaml … normal_08.yaml
content/encounters/<region>_elite_01.yaml … elite_03.yaml
content/encounters/<region>_objective_01.yaml … objective_03.yaml
```

Slots are production categories, not duplicate encounters. The regional implementation must use the unique transformation below.

| Region / ID range | Priority | Tactical transformation required |
|---|---|---|
| Iron Marches `ENCOUNTER-001…014` | P0 for 001–012; P1 for 013–014 | blockers, rook files, fortification, furnace seals; static lines and deliberate breach |
| Luminous Synod `ENCOUNTER-015…028` | P1 | sanctified diagonals, altars, rotating rune mirrors and visible silence rules |
| Free Cities `ENCOUNTER-029…042` | P1 | neutral contract pieces, trade cells, bridges/canals and optional negotiated objectives |
| Thorn Covenant `ENCOUNTER-043…056` | P1 | portals, living blockers, linked rune cells and growth that remains fully previewed |
| Ashen Dominion `ENCOUNTER-057…070` | P1 | pawn formations, voluntary sacrifice seals, ash hazards and succession banners |
| Sky Khanate `ENCOUNTER-071…084` | P1 | edge deployment, mobile reserve, cliff files and race/escort pressure |

### Fourteen slots per region

1. `normal_01` — Crossfire Files: two competing line structures.
2. `normal_02` — Blocked Diagonal: navigation around a regional blocker mechanic.
3. `normal_03` — Broken Formation: scattered deployment and regroup objective.
4. `normal_04` — Forward Outpost: activate/defend a visible object.
5. `normal_05` — Narrow Center: constrained central files with open flanks.
6. `normal_06` — Open King Road: exposed king safety puzzle.
7. `normal_07` — Split Reserve: reserve choices from separated entry zones.
8. `normal_08` — Contested Shrine: hold/activate region-specific cells.
9. `elite_01` — Champion’s Net: elite piece coordination and escape routes.
10. `elite_02` — Fortified Objective: breach a defended object without illegal king exposure.
11. `elite_03` — Three-Stage Assault: three visible objective steps on one board.
12. `objective_01` — Escort through Check: protect and route an escort legally.
13. `objective_02` — Hold Two Cells: simultaneous/alternating zone control.
14. `objective_03` — Evacuate the Vanguard: extract declared pieces.

A slot only counts as a new module when its regional mechanic changes tactical decisions and validation fixtures. A color/material reskin is rejected.

## Twelve generic/rare modules — `ENCOUNTER-085…096`

| ID / file | Priority | Tactical brief | Status |
|---|---|---|---|
| 085 `fractured_board_01.yaml` | P1 | **Fractured Board** — separated legal board components connected by declared passages. | MISSING |
| 086 `mirror_rank_01.yaml` | P1 | **Mirrored Rank** — visible symmetry constraint; no AI information advantage. | MISSING |
| 087 `portal_cross_01.yaml` | P1 | **Four Portals** — four paired, previewed portal endpoints. | MISSING |
| 088 `last_pawn_01.yaml` | P1 | **Last Pawn** — protect/advance a designated pawn to promotion. | MISSING |
| 089 `kingless_escape_01.yaml` | P1 | **Kingless Evacuation** — explicitly declared non-standard escort rules. | MISSING |
| 090 `double_escort_01.yaml` | P1 | **Two Envoys** — route two escorts with different exits. | MISSING |
| 091 `shrinking_field_01.yaml` | P1 | **Shrinking Field** — board contraction previewed at least one round ahead. | MISSING |
| 092 `expanding_field_01.yaml` | P1 | **Expanding Field** — new ranks/files appear at declared phases. | MISSING |
| 093 `seal_break_01.yaml` | P1 | **Break the Seals** — destroy/activate three accessible seals. | MISSING |
| 094 `survive_six_01.yaml` | P1 | **Survive Six Turns** — legal survival objective and reinforcement schedule. | MISSING |
| 095 `promotion_race_01.yaml` | P1 | **Promotion Race** — competing pawn routes with visible future command cost. | MISSING |
| 096 `hidden_route_reward_01.yaml` | P1 | **Hidden Route Guardian** — secret-map reward, never hidden tactical information. | MISSING |

## Boss-kit production profile

Every boss folder contains:

- `portrait.png` 768×768;
- `piece.png` 512×512 RGBA with chess-readable silhouette;
- `arena.jpg` 1600×900;
- `phase_01.png`…`phase_03.png` 512×512 sigils;
- `phase_transition.png` VFX sheet;
- boss data, AI profile, objectives, transitions, RU/EN texts and validation fixtures.

**Ready-to-use prompt:** “Complete RPChess boss kit for **[NAME]** of **[REGION]**: **[PHASE BRIEF]**. Produce portrait, transparent chess-readable boss piece, full 16:9 arena, three phase sigils and concise transition VFX. Heroic dark fantasy, strong silhouette, no text, no HP-bar assumptions. Every phase ends through an announced chess/scenario objective rather than numeric damage.”

**Acceptance:** 2–3 phases; phase rules displayed before activation; no ordinary HP bar; surviving composition/injuries preserved according to explicit transition; reference completion replay; all phase positions legal/reachable; assets consistent and rights recorded.

## Fifteen boss records

| ID / folder | Region | Priority | Phase brief | Status |
|---|---|---|---|---|
| BOSS-01 `iron_regent/` | Iron Marches | P0 | **Железный Регент** — break furnace seals, then legal mate in a collapsing fortress. | MISSING |
| BOSS-02 `widow_general/` | Iron Marches | P0 | **Вдовствующая Генеральша** — escort and duel phases around rook lines. | MISSING |
| BOSS-03 `blue_pontiff/` | Luminous Synod | P1 | **Лазурный Понтифик** — altar activation, visible silence, diagonal mate. | MISSING |
| BOSS-04 `heretic_astronomer/` | Luminous Synod | P1 | **Еретик-Астроном** — rotating rune lines and recruit-or-defeat route. | MISSING |
| BOSS-05 `first_consul/` | Free Cities | P1 | **Первый Консул** — contract objectives and shifting neutral pieces. | MISSING |
| BOSS-06 `guild_of_three/` | Free Cities | P1 | **Гильдия Троих** — three linked leaders and political victory options. | MISSING |
| BOSS-07 `antler_king/` | Thorn Covenant | P1 | **Король Оленьих Рогов** — portal hunt, grove defense, then mate. | MISSING |
| BOSS-08 `thorn_bride/` | Thorn Covenant | P1 | **Терновая Невеста** — escort/choice boss who can become an ally. | MISSING |
| BOSS-09 `cinder_emperor/` | Ashen Dominion | P1 | **Пепельный Император** — formation-sacrifice seals and succession decision. | MISSING |
| BOSS-10 `last_legion/` | Ashen Dominion | P1 | **Последний Легион** — survival and command-banner objective. | MISSING |
| BOSS-11 `sky_khan/` | Sky Khanate | P1 | **Небесный Каган** — mobile reserve waves and cliff-edge files. | MISSING |
| BOSS-12 `storm_sister/` | Sky Khanate | P1 | **Сестра Бури** — race objective and mounted duel. | MISSING |
| BOSS-13 `hollow_sovereign/` | secret/final | P1 | **Пустой Суверен** — reality fracture across two boards. | MISSING |
| BOSS-14 `mirror_self/` | secret | P1 | **Зеркальный Двойник** — copies visible legal patterns without hidden cheating. | MISSING |
| BOSS-15 `war_beyond_crown/` | final | P1 | **Война за Короной** — political coalition determined by faction outcomes. | MISSING |

## Count and release gate

- 84 materially distinct regional modules;
- 12 rare/generic modules;
- 96 recommended total, exceeding the mandatory minimum of 70;
- 12 regional primary/alternative boss kits plus 3 final/secret kits;
- no module enters release count before schema validation, deterministic fixture, automated reachability checks and a designer completion replay;
- the current prototype boss is a reference/placeholder and does not automatically satisfy any P1 boss record.
