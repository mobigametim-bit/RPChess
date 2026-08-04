# CONTENT_GAP_SUMMARY.md

**Status:** Production gap summary v1  
**Baseline:** RPChess 1.3.3 source package and deployed patch chain through 1.3.9.

## 1. Summary

The current prototype has enough material to demonstrate visual direction and a short gameplay loop, but less than one tenth of the authored gameplay content required for a premium replayable release. The largest gaps are not isolated images: they are complete data-driven systems and coherent authored content families.

## 2. Current versus release target

| Category | Current | Mandatory minimum | Recommended release target | Gap to recommended |
|---|---:|---:|---:|---:|
| Full narrative events | 4 | 100 | 140 | 136 |
| Figure-bound relics | 12 global artifacts | 50 | 72 | 60 plus redesign of current 12 |
| Named heroes | 0 | 30 | 36 | 36 |
| Combat scenario modules | 1 procedural family | 70 | 96 | about 95 |
| Main factions | 0 complete | 6 | 6 | 6 |
| Rare factions | 0 | 2 | 2 | 2 |
| Main regions | 0 complete | 6 | 6 | 6 |
| Political characters | 0 | 15–18 | 18 | 18 |
| Kings | 0 independent | 7 | 7 | 7; current commanders are not equivalent |
| Release doctrines | 0 independent | 6 | 6 | 6 |
| Experimental doctrines | 0 | optional 3 | 3 post-core | 3 |
| Regional primary bosses | 1 generic boss | 6 | 6 | 6 |
| Regional alternative bosses | 0 | 6 | 6 | 6 |
| Final/secret bosses | 0 | design-dependent | 3 | 3 |
| Ending models | 0 | 4 | 4 | 4 |
| Modular epilogue records | 0 | consequence-complete | 80–120 | 80–120 |
| Tutorials | 0 interactive | 2 tracks | 2 tracks / 18–24 chapters | all |
| Internal achievements | 20 prototype | design-dependent | 45–60 | redesign and expansion |
| Music tracks | 4 | no fixed number | 12–16 | 8–12 |
| Production SFX | mostly synthesized + fanfare | no fixed number | 80–120 files/variations | about 75–115 |

## 3. Why the recommended numbers exceed the minimum

### Events — 140 recommended

A three-act run should encounter roughly 6–9 events. At 100 events, a player completing 15–20 runs can see a substantial portion of the library, especially if generic events have broad conditions. A 140-event target allows:

- 12 regional events per main region = 72;
- 5 faction/political events per main faction = 30;
- 20 generic kingdom/travel events;
- 10 hero-personal events;
- 8 rare/secret events.

This reduces repetition while preserving production feasibility.

### Relics — 72 recommended

Fifty is a viable minimum, but compatibility filtering by piece type, slots and doctrine can make offers repetitive. Seventy-two supports:

- 8–10 useful options per classic piece family;
- king/hero-specific relics;
- environment and order-point builds;
- rare cross-doctrine effects;
- adequate offer diversity after exclusions.

### Heroes — 36 recommended

Thirty is sufficient, but 36 distributes cleanly as six heroes per primary faction and gives each classic piece family multiple personalities and mechanical roles.

### Combat modules — 96 recommended

At 4–6 battles per act, a complete run uses about 15–20 combat encounters including elites and bosses. Seventy modules can repeat visibly after several runs. Ninety-six supports:

- 8 ordinary modules per region = 48;
- 3 elite modules per region = 18;
- 3 alternative-objective modules per region = 18;
- 12 generic/rare modules.

Boss phases are tracked separately.

## 4. Asset gap by production family

### P0 — vertical-slice blockers

- normalized source asset manifest;
- standard 8×8 board and coordinates;
- classic piece set with unmistakable silhouettes;
- legal-move/check/mate VFX;
- deployment/reserve/order-point UI;
- one complete region art kit;
- one primary and one alternative boss kit;
- 2 kings and 2 doctrines;
- 6 named heroes;
- 12 figure-bound relic icons;
- 16 events;
- 12 combat modules;
- tutorial chapter art and input prompts;
- production UI/gameplay SFX channels.

### P1 — release blockers

- all six region kits;
- all faction visual identities;
- 7 kings;
- 6 doctrines and doctrine-tree icons;
- 36 hero portraits/piece identifiers;
- 72 relic icons;
- 140 event records and reusable scene illustration library;
- 96 encounter modules;
- 12 regional boss kits plus final/secret bosses;
- kingdom buildings and Chronicle art;
- achievements/cosmetic rewards;
- controller/Steam Deck glyphs;
- complete audio library;
- Steam store capsules and screenshots.

### P2 — post-release polish or expansion

- experimental doctrine art;
- additional regional board skins;
- extended hero personal-event illustrations;
- animated portraits;
- additional cosmetic piece sets;
- advanced ambience layers;
- community spotlight branding.

## 5. Reuse policy

Reuse is permitted when it is intentional and does not misrepresent content:

- one regional scene can support several related events;
- one environment object sheet can serve multiple encounter modules;
- standard piece silhouettes can use material/ornament variants;
- UI frames are reused globally;
- VFX are reusable by effect category.

Reuse does **not** count as new authored content when only color, names or numbers change.

## 6. Production dependencies

Before high-volume production begins:

1. approve faction/region identities;
2. approve seven king mechanics;
3. approve six doctrine mechanics;
4. approve content schemas and effect vocabulary;
5. approve visual style anchors and safe areas;
6. establish naming and asset-manifest rules;
7. create automated acceptance checks for dimensions, alpha and missing files.

## 7. Current assets that can remain

The following can remain as vertical-slice assets, subject to provenance and rights review:

- RPChess logo and wordmark;
- fantasy UI frame/button family;
- current standard piece images as a provisional neutral set;
- node and reward icon family;
- 14 scene images as provisional generic scenes;
- four music tracks;
- supplied victory fanfare;
- Cyrillic display font if distribution rights permit.

They are not automatically final P1 assets. Each must receive provenance, license and consistency status in the asset manifest.
