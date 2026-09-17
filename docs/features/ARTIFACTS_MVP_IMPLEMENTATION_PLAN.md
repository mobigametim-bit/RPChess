# Artifacts MVP — implementation plan

**Branch:** `feature/artifacts-mvp`
**Delivery:** Cloudflare Preview from the feature branch only. `main` and the VK moderation candidate must remain unchanged until manual acceptance.

## Fixed product contract

- Artifacts are a shared, per-run inventory — never bound to an individual chess piece.
- A Settlement presents one deterministic random offer. The offer has one to three charges; the price is 18 gold per charge for the defensive/attack amulets and 30 gold per charge for the great amulet.
- Buying the same artifact again adds charges. A purchase cannot be repeated after the Settlement offer is sold.
- Before every Battle and Skirmish the player chooses one owned artifact, or **No artifact**. A chosen artifact immediately spends one charge and is persisted idempotently for that encounter.
- The three first artifacts only reveal information; they do not alter standard chess movement, check, checkmate, AI, or legal moves.
- Threat fires are placed on occupied squares only and use geometric attackers: 1 = yellow, 2 = orange, 3+ = red. They refresh after every completed move.

## Execution checklist

- [x] Archive the obsolete figure-bound relic concept in `register/REGISTER_03_RELICS.md`.
- [x] Create `feature/artifacts-mvp`; leave `main` unchanged.
- [x] Add canonical catalog of three threat-sense amulets, inventory validation and safe run persistence.
- [x] Add a deterministic one-off Artifact offer to Settlement and a charge-aware purchase action.
- [x] Add an accessible pre-combat modal with up to three owned cards and a **No artifact** card for Battle and Skirmish.
- [x] Add idempotent charge spending and clear active combat selection once the encounter ends.
- [x] Add attacker counting to the chess engine and threat-fire overlays behind the pieces, including Black-side play.
- [x] Add responsive modal/Settlement styles for desktop, tablet and narrow landscape mobile.
- [x] Add six artifact PNGs to the runtime copy, transform cache, max-size/alpha contract and dist verification.
- [x] Add unit/contract coverage for offers, purchases, idempotent selection, attacker counting and asset contract.
- [ ] Run the full local gate after the external Stockfish fetch is available.
- [x] Publish `feature/artifacts-mvp` to GitHub (`90ee63e`); wait for the automatic Cloudflare Preview build.
- [ ] Manual acceptance: Settlement purchase, each combat choice, yellow/orange/red fires, reload/idempotency, white/black player side, 1920×1080 / 1024×768 / 844×390.
- [ ] Only after explicit acceptance: merge to `main`, deploy the already-approved version to VK and mark the feature DONE.

## Asset contract

All files are source assets under `game/assets/artifacts/threat_sense/`, copied to `dist/assets/artifacts/threat_sense/` and compressed by `scripts/runtime-assets-build.cjs` using the `artifacts` cache namespace:

| File | Purpose |
| --- | --- |
| `amulet_defense.png` | Defensive threat sense |
| `amulet_attack.png` | Offensive threat sense |
| `amulet_great.png` | Both sides |
| `threat_fire_1_yellow.png` | One attacker |
| `threat_fire_2_orange.png` | Two attackers |
| `threat_fire_3_plus_red.png` | Three or more attackers |

Runtime budget: square PNG with alpha, maximum 256×256 and 256 KiB per file; 1.5 MiB aggregate. `tests/artifact-asset-runtime.cjs` and the build both enforce it.

## Continuation notes

- The existing current settlement records are intentionally invalidated during hydration once, then regenerated from their route seed with the Artifact offer. This preserves deterministic offers and does not alter unrelated run state.
- `combatArtifactChoice` is transient persistence for a started encounter. It prevents a reload or repeated click from spending another charge and is cleared in both Battle and Skirmish completion paths.
- The local `build:materialized` reached asset optimization successfully; the six runtime assets total 434.4 KiB. The subsequent Stockfish fetch timed out through the restricted proxy. This is an infrastructure retry, not an artifact contract failure.
