# RPChess generated assets drop zone

Place newly generated game assets in this folder using the exact canonical path defined in the production registers and prompts.

## Path rule

Preserve the complete path from the register underneath `game/generated_assets/`.

Example canonical register path:

```text
assets/regions/iron_marches/tile_light.png
```

Upload it as:

```text
game/generated_assets/assets/regions/iron_marches/tile_light.png
```

The intake tool validates the staged file and copies it to its runtime path:

```text
game/assets/regions/iron_marches/tile_light.png
```

Do not flatten repeated filenames such as `tile_light.png` into the drop-zone root because different biomes use the same basename.

## Rules

1. Keep the exact canonical path, filename, extension, dimensions, transparency and aspect ratio from the register.
2. Use lowercase Latin filenames with underscores; do not add spaces, dates, `final`, `new`, or version suffixes to canonical candidates.
3. Upload only one approved candidate under each canonical path.
4. Put alternatives or rejected variants in `game/generated_assets/_review/` and add `_v01`, `_v02`, etc.
5. Do not overwrite an existing staged canonical asset unless the replacement is intentional.
6. Keep source/licensing documents outside this folder in the appropriate project folders.
7. Runtime board themes contain only `tile_light.png` and `tile_dark.png`; do not add a complete board, frame or underlay as a runtime dependency.

## Commands

Audit staged and integrated board cells without copying:

```text
npm run assets:audit
```

Validate and copy all safe new board-cell candidates into their canonical runtime paths:

```text
npm run assets:intake
```

Existing runtime files are never replaced automatically. A differing staged replacement is reported as `replacement_review` and requires an explicit reviewed replacement operation.

## Integration states

- `missing` — neither staged nor integrated;
- `ready_to_integrate` — valid staged file exists and runtime file is absent;
- `integrated` — valid runtime file exists;
- `duplicate` — staged and runtime files are byte-identical;
- `replacement_review` — staged file differs from an existing runtime file;
- `invalid_staging` — staged file has the wrong format or dimensions;
- `invalid_runtime` — integrated runtime file has become invalid;
- `ready_to_repair` — valid staged file can repair an invalid runtime file.

After intake, the asset still requires an in-game readability review before its register status becomes `APPROVED`.
