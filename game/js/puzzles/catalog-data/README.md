# RPChess curated puzzle dataset

`puzzle-catalog-11498.json.gz` is the committed, offline production source for the current RPChess Puzzle catalog.

## Provenance

- Upstream: **Lichess Open Database Puzzles**, CC0.
- Input subset used for this expansion: the 50,000-puzzle sample from `mcognetta/lichess-combined-puzzle-game-db`, whose README states that the puzzle fields come from the Lichess Puzzle Database and that its puzzle snapshot was pulled in September 2022.
- The original game payload is not shipped by RPChess; only normalized puzzle fields required at runtime are retained.

## Curation

The 50,000 input rows were processed with the RPChess production rules:

- `Popularity >= 80`.
- `RatingDeviation <= 100`.
- Supported objectives only: `mate1`, `mate2`, `mate3`, `material`.
- Mate tasks require exact solution length and finish in checkmate for the puzzle side.
- Material tasks must not be mate lines, must identify exactly one queen/rook/bishop/knight target, and must finish with positive material gain.
- Difficulty must fit the approved ★1–★12 rating band and type mix.

Result: **11,498** accepted tasks.

- mate1: 1,717
- mate2: 2,859
- mate3: 554
- material: 6,368

Star totals: ★1 781; ★2 1,260; ★3 2,218; ★4 1,624; ★5 1,348; ★6 1,148; ★7 972; ★8 717; ★9 551; ★10 427; ★11 303; ★12 149.

## Compact row schema

Each gzip JSON row is an array with exactly ten fields:

`[sourceId, fen, side, solutionUciString, type, rating, difficulty, targetPieceOrEmpty, materialGain, themesString]`

`scripts/materialize-puzzle-catalog.cjs` verifies the committed gzip SHA-256 and exact distributions before deterministically producing the runtime `puzzle-catalog.mjs` module. The regular build performs only this local integrity/materialization step plus lightweight catalog checks; it does **not** replay all 11,498 solutions through the chess engine.

Committed gzip SHA-256: `dc3d10ee765e8e9a76f07bee010c672cb576e8c11a3e191693e9b3f221ac770c`.

## Verification

A one-off exact-head Cloudflare build replayed all **11,498/11,498** curated solution lines through the RPChess `ClassicChessEngine` and completed successfully before the full replay was removed from the regular build gate.

- Full replay build: `5182f356-3ae7-460b-ae7f-5864b76e091b`
- Full replay deployed version: `1653f129-5268-4e8e-87ea-41c0913e96e4`
