# Piece Asset Runtime Budget

## Goal

Keep high-resolution source art in `game/` for editing while preventing oversized board-piece textures from reaching production builds.

## Runtime contract

Production board-piece assets are generated during `npm run build` and must satisfy both limits:

- maximum side: **256 px**;
- maximum encoded PNG size: **320 KiB**.

The budget applies to:

- `assets/heroes/*/piece_badge.png`;
- every PNG below `assets/races/**/pieces/`;
- `assets/kings/oathkeeper/piece.png`;
- generic `generated_assets/unit_{piece}_{player|enemy}.png` files.

## Build flow

`game/` remains the source/master tree. `scripts/build.cjs` copies it into `dist/`, then `scripts/piece-asset-runtime.cjs` downsizes only oversized piece textures in `dist/` and re-encodes them as transparent RGBA PNGs. Source files are never mutated by the production build.

After conversion, `assertPieceAssetBudget(dist)` is mandatory. Any production piece that is still larger than 256 px on either side or 320 KiB aborts the build.

Therefore a 1024×1024 / 2–3 MiB source image may remain in the repository, but it cannot be shipped unchanged by Cloudflare/VK/Steam builds using the canonical `npm run build` pipeline.

## Commands

- `npm run assets:pieces:report` — dry-run against `game/`; reports projected production savings without changing source files.
- `npm run build` — creates `dist/`, automatically optimizes board-piece assets, then enforces the hard budget.
- `npm run assets:pieces:verify` — verifies the already-built `dist/` budget.

## Quality

Downscaling uses premultiplied-alpha bilinear sampling to avoid dark fringes around transparent silhouettes. PNG encoding remains lossless after the resize. Files already within the runtime budget are copied unchanged.

## Safety

- No gameplay paths or asset URLs change.
- No source/master PNG is overwritten.
- Only the production copy in `dist/` is transformed.
- A synthetic unit test covers PNG decode/resize/encode and the fail-closed budget gate.
