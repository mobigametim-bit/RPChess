# RPChess generated assets drop zone

Place newly generated game assets in this folder using the exact filenames defined in the production registers and asset prompts.

Rules:

1. Keep the exact filename, extension, dimensions, transparency and aspect ratio from the register.
2. Use lowercase Latin filenames with underscores; do not add spaces, dates, `final`, `new`, or version suffixes.
3. Upload only one approved candidate under the canonical filename.
4. Put alternative or rejected variants in `game/generated_assets/_review/` and add `_v01`, `_v02`, etc.
5. Do not overwrite an existing canonical asset unless the replacement is intentional.
6. Keep source/licensing documents outside this folder in the appropriate project folders.

Integration workflow:

- uploaded: file exists in this drop zone;
- validated: dimensions, format, transparency and naming checked;
- integrated: asset connected to game data/UI;
- verified: asset reviewed in the running game and covered by automated asset checks.

The integration pass may later move assets into their final runtime subfolders while preserving the canonical filenames and updating all references automatically.
