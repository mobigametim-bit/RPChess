# Artifacts MVP — implementation plan

**Branch:** `feature/artifacts-mvp` → merged to `main` via PR [#139](https://github.com/mobigametim-bit/RPChess/pull/139) on 2026-09-18.
**Delivery:** Cloudflare Preview was accepted. GitHub Pages release successfully completed on 2026-09-18 (workflow #253, commit `7ecb34b`).

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
- [x] Manual acceptance: Settlement purchase, each combat choice, yellow/orange/red fires, reload/idempotency, white/black player side, 1920×1080 / 1024×768 / 844×390.
- [x] User authorized and feature merged to `main` through PR [#139](https://github.com/mobigametim-bit/RPChess/pull/139), merge commit `1c08034`.
- [x] Manually run **Deploy RPChess to GitHub Pages** on `main` — workflow [#253](https://github.com/mobigametim-bit/RPChess/actions/runs/35339022689) succeeded for commit `7ecb34b`; the existing VK Pages URL is unchanged.

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

### Preview feedback — 2026-09-17

- [x] User opened Cloudflare preview `https://f28745cb-rpchess.mobigametim.workers.dev`; original preview build is available. The previous dashboard-access blocker does not mean the preview failed.
- [x] Compare branch ancestry: `08f5625` is 3 commits ahead / 0 behind `main` (`e7f6ed0`). No stale base or incorrect clone; main/VK candidate remain unchanged.
- [x] Replace mismatched market markup with one framed product-card renderer for supplies and artifacts, using the existing button style and owner-scoped responsive CSS.
- [x] Restore canonical combat presentation through `rpchess:combat-started` after artifact selection. The old Start-click listener ran before asynchronous choice, leaving combat layout/HUD classes unset. Shared combat summary also listens to the actual launch.
- [x] Reconcile fire nodes against actual cells, including same-position re-renders during selection/AI thinking. FEN-only caching left newly created cells without fire. Repeated observer passes now make no DOM changes.
- [x] Verify the missing ×2 is platform gating: ordinary Cloudflare/Web launches intentionally have no VK ads. Monetization code is unchanged; do not spoof VK or award unearned ad rewards for preview tests.
- [x] Run source verification, full materialized tests and new DOM/lifecycle regression tests (cell replacement, both player colors, count updates, clearing overlays, delayed Battle/Skirmish classes).
- [x] Cloudflare build for `534c83c` succeeded (version `82207b82`). Preview: `https://82207b82-rpchess.mobigametim.workers.dev`; stable branch alias: `https://feature-artifacts-mvp-rpchess.mobigametim.workers.dev`.
- [x] Normalize all market product icons: padded amulet art is scaled to the same visible size as supplies on desktop, tablet and narrow landscape.
- [x] Set first-run Music setting to 20%; an existing saved player setting is preserved.
- [x] Localize the artifact offer, purchase receipt and pre-combat choice cards in Russian and English.
- [x] Verify the newly built Cloudflare preview visually at 1920×1080, 1024×768 and 844×390, including card overflow and combat layout.
- [x] User accepted the fixed preview and authorized merge to `main`.

Next agent: confirm the just-published version in VK at the unchanged Pages URL. The feature is merged and released; do not change the VK URL or create a new production publish without user approval.

- The existing current settlement records are intentionally invalidated during hydration once, then regenerated from their route seed with the Artifact offer. This preserves deterministic offers and does not alter unrelated run state.
- `combatArtifactChoice` is transient persistence for a started encounter. It prevents a reload or repeated click from spending another charge and is cleared in both Battle and Skirmish completion paths.
- The local `build:materialized` reached asset optimization successfully; the six runtime assets total 434.4 KiB. The subsequent Stockfish fetch timed out through the restricted proxy. This is an infrastructure retry, not an artifact contract failure.
- Cloudflare is configured to build non-production branches. The feature branch is published, but its dashboard cannot be inspected from this remote browser because Cloudflare presents human verification; obtain the Preview URL from the Cloudflare Deployments tab before manual acceptance.
