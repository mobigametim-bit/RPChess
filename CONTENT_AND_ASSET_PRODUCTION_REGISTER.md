# CONTENT_AND_ASSET_PRODUCTION_REGISTER.md

**Status:** Production register v1.1  
**Authority:** this index and its six annexes form one complete production register.  
**Rule:** every P0/P1 item remains open until its acceptance criteria are verified in-game. `PLACEHOLDER` never means complete.

## Register structure

| Annex | Scope | Counts |
|---|---|---|
| [REGISTER_01_FOUNDATIONS.md](register/REGISTER_01_FOUNDATIONS.md) | Style anchors, production profiles, P0 branding/UI/modular board-cell assets, six region kits, seven kings, six doctrines | 6 regions, 7 kings, 6 doctrines |
| [REGISTER_02_HEROES_AND_POLITICS.md](register/REGISTER_02_HEROES_AND_POLITICS.md) | Named heroes and political characters | 36 heroes, 18 political characters |
| [REGISTER_03_RELICS.md](register/REGISTER_03_RELICS.md) | Figure-bound relic production records | 72 relics |
| [REGISTER_04_EVENTS.md](register/REGISTER_04_EVENTS.md) | Authored event content records | 140 events |
| [REGISTER_05_ENCOUNTERS_AND_BOSSES.md](register/REGISTER_05_ENCOUNTERS_AND_BOSSES.md) | Combat scenario modules, logical board configurations and boss kits | 96 encounters, 15 boss kits |
| [REGISTER_06_AUDIO_UI_STEAM.md](register/REGISTER_06_AUDIO_UI_STEAM.md) | Additional visual series, modular board cosmetics, audio, Steam store assets and workflow | release audio/UI/store set |

## Board asset policy

Runtime boards are assembled from modular square cells. Every board theme consists of a paired light-cell texture and dark-cell texture plus separate gameplay overlays and environment objects. The production register does not require complete pre-rendered board images, board frames or underlays. Coordinates, active-cell masks, highlights and non-standard board shapes are rendered by the game.

Complete board illustrations may exist as concept art, promotional art or unique scene art, but they do not replace the required modular runtime cell pair.

## Required fields

Every row either declares or inherits from a named production profile:

- unique ID;
- filename or strict filename series;
- category and purpose;
- screen/system use;
- mandatory status and P0/P1/P2 priority;
- variant count;
- resolution, aspect ratio and format;
- background and safe-field rules;
- animation/frame requirements;
- readability requirements;
- style reference;
- constraints and negative requirements;
- ready-to-use generation/production prompt;
- acceptance criteria;
- production status.

Inherited profile fields are authoritative unless a row explicitly overrides them.

## Mandatory release totals represented

- 6 main regions and factions;
- 2 rare faction directions tracked in secret-content design;
- 7 kings;
- 6 release doctrines;
- 36 named heroes;
- 18 central political figures;
- 72 figure-bound relics;
- 140 authored events;
- 96 combat scenario modules;
- 12 regional primary/alternative bosses plus final and secret bosses;
- kingdom, tutorial, achievement, cosmetic, controller and environment series;
- production music/SFX families;
- Steam capsules and screenshot plan.

## Status legend

- `MISSING` — not produced.
- `PLACEHOLDER` — temporary asset exists but does not satisfy acceptance.
- `IN PRODUCTION` — assigned and being produced.
- `REVIEW` — candidate exists; technical and in-game review pending.
- `APPROVED` — acceptance passed and provenance recorded.
- `EXISTS-VERIFY` — current-project asset exists but license/consistency/technical acceptance remains open.

No P0 or P1 item may remain outside `APPROVED` in the release candidate.
