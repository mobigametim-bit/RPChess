#!/usr/bin/env python3
"""Import and normalize the public Register 01 Google Drive asset folder.

This script is intentionally strict: the expected source families and canonical
runtime destinations are derived from register/REGISTER_01_FOUNDATIONS.md.
Candidates become REVIEW assets; approval still requires rights and in-game QA.
"""

from __future__ import annotations

import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import gdown
from PIL import Image, ImageOps

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DRIVE_FOLDER_ID = "1YRFz0LfXCBh-uGYoOrny4Ub4BrGmyUUi"
DRIVE_FOLDER_URL = f"https://drive.google.com/drive/folders/{DRIVE_FOLDER_ID}"
DOWNLOAD_ROOT = PROJECT_ROOT / ".asset-import" / "register_01_download"
RUNTIME_ASSET_ROOT = PROJECT_ROOT / "game" / "assets"
REGISTER_PATH = PROJECT_ROOT / "register" / "REGISTER_01_FOUNDATIONS.md"
BOARD_MANIFEST_PATH = PROJECT_ROOT / "content" / "board-themes.json"
ASSET_MANIFEST_PATH = PROJECT_ROOT / "content" / "assets" / "register_01_assets.json"

MAIN_REGIONS = (
    "iron_marches",
    "thorn_covenant",
    "ashen_dominion",
    "sky_khanate",
    "luminous_synod",
    "free_cities",
)
RARE_REGIONS = ("mirror_conclave", "verdant_exiles")
KINGS = (
    "oathkeeper",
    "stone_crown",
    "wanderer_queen",
    "pilgrim",
    "fox_prince",
    "ash_regent",
    "nameless_heir",
)
DOCTRINES = (
    "fortress",
    "cavalry",
    "sacred_diagonals",
    "pawn_ascension",
    "royal_court",
    "gambit",
)

RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS
SOURCE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass(frozen=True)
class AssetSpec:
    source_folder: str
    source_stem: str
    destination: str
    width: int
    height: int
    output_format: str  # PNG or JPEG
    alpha: bool
    profile: str


def png(folder: str, stem: str, destination: str, size: tuple[int, int], profile: str) -> AssetSpec:
    return AssetSpec(folder, stem, destination, size[0], size[1], "PNG", True, profile)


def scene(folder: str, stem: str, destination: str) -> AssetSpec:
    return AssetSpec(folder, stem, destination, 1600, 900, "JPEG", False, "SCENE-1600")


def expected_specs() -> list[AssetSpec]:
    specs: list[AssetSpec] = [
        png("ui", "focus_ring", "ui/focus_ring.png", (512, 512), "ICON-512"),
        png("neutral", "tile_light", "boards/neutral/tile_light.png", (512, 512), "BOARD-TILE-512"),
        png("neutral", "tile_dark", "boards/neutral/tile_dark.png", (512, 512), "BOARD-TILE-512"),
        png("neutral", "blocked_cell", "boards/neutral/blocked_cell.png", (512, 512), "ICON-512"),
        png("neutral", "start_zone", "boards/neutral/start_zone.png", (512, 512), "ICON-512"),
        png("vfx", "check", "vfx/check.png", (512, 512), "ICON-512"),
        png("vfx", "checkmate", "vfx/checkmate.png", (2048, 2048), "VFX-SHEET"),
        png("vfx", "piece_capture", "vfx/piece_capture.png", (2048, 2048), "VFX-SHEET"),
        png("vfx", "promotion", "vfx/promotion.png", (2048, 2048), "VFX-SHEET"),
    ]

    for region in MAIN_REGIONS:
        for stem in ("map_banner", "capital", "battle", "elite", "boss_arena"):
            specs.append(scene(region, stem, f"regions/{region}/{stem}.jpg"))
        specs.extend(
            [
                png(region, "crest", f"regions/{region}/crest.png", (512, 512), "ICON-512"),
                png(region, "tile_light", f"regions/{region}/tile_light.png", (512, 512), "BOARD-TILE-512"),
                png(region, "tile_dark", f"regions/{region}/tile_dark.png", (512, 512), "BOARD-TILE-512"),
                png(region, "environment_sheet", f"regions/{region}/environment_sheet.png", (2048, 2048), "OBJECT-SHEET"),
            ]
        )

    for region in RARE_REGIONS:
        for stem in ("map_banner", "battle", "boss_arena"):
            specs.append(scene(region, stem, f"regions/{region}/{stem}.jpg"))
        specs.extend(
            [
                png(region, "crest", f"regions/{region}/crest.png", (512, 512), "ICON-512"),
                png(region, "tile_light", f"regions/{region}/tile_light.png", (512, 512), "BOARD-TILE-512"),
                png(region, "tile_dark", f"regions/{region}/tile_dark.png", (512, 512), "BOARD-TILE-512"),
                png(region, "environment_sheet", f"regions/{region}/environment_sheet.png", (2048, 2048), "OBJECT-SHEET"),
            ]
        )

    for king in KINGS:
        specs.extend(
            [
                png(king, "portrait", f"kings/{king}/portrait.png", (768, 768), "PORTRAIT-768"),
                png(king, "piece", f"kings/{king}/piece.png", (512, 512), "PIECE-512"),
                png(king, "command_icon", f"kings/{king}/command_icon.png", (512, 512), "ICON-512"),
                png(king, "passive_icon", f"kings/{king}/passive_icon.png", (512, 512), "ICON-512"),
            ]
        )

    for doctrine in DOCTRINES:
        specs.append(png(doctrine, "emblem", f"doctrines/{doctrine}/emblem.png", (512, 512), "ICON-512"))
        for index in range(1, 6):
            stem = f"node_{index:02d}"
            specs.append(png(doctrine, stem, f"doctrines/{doctrine}/{stem}.png", (256, 256), "DOCTRINE-NODE-256"))

    if len(specs) != 141:
        raise RuntimeError(f"internal Register 01 schema error: expected 141 specs, got {len(specs)}")
    destinations = [item.destination for item in specs]
    if len(destinations) != len(set(destinations)):
        raise RuntimeError("internal Register 01 schema contains duplicate destinations")
    return specs


def download_drive_folder() -> Path:
    shutil.rmtree(DOWNLOAD_ROOT, ignore_errors=True)
    DOWNLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    result = gdown.download_folder(
        url=DRIVE_FOLDER_URL,
        output=str(DOWNLOAD_ROOT),
        quiet=False,
        use_cookies=False,
        remaining_ok=True,
    )
    if not result:
        raise RuntimeError("Google Drive Register 01 folder returned no files")
    return locate_asset_root(DOWNLOAD_ROOT)


def locate_asset_root(root: Path) -> Path:
    expected_folders = set(MAIN_REGIONS + RARE_REGIONS + KINGS + DOCTRINES + ("ui", "neutral", "vfx"))
    candidates = [root]
    candidates.extend(path for path in root.rglob("*") if path.is_dir())
    scored = sorted(
        ((sum((candidate / name).is_dir() for name in expected_folders), candidate) for candidate in candidates),
        key=lambda value: (value[0], -len(value[1].parts)),
        reverse=True,
    )
    score, candidate = scored[0]
    if score != len(expected_folders):
        missing = sorted(name for name in expected_folders if not (candidate / name).is_dir())
        raise RuntimeError(f"could not locate complete register_01 root; missing folders: {missing}")
    return candidate


def find_source(asset_root: Path, spec: AssetSpec) -> Path:
    folder = asset_root / spec.source_folder
    matches = [
        item
        for item in folder.iterdir()
        if item.is_file() and item.suffix.lower() in SOURCE_EXTENSIONS and item.stem.lower() == spec.source_stem.lower()
    ]
    if len(matches) != 1:
        names = sorted(item.name for item in folder.iterdir() if item.is_file())
        raise RuntimeError(
            f"{spec.source_folder}/{spec.source_stem}: expected one source image, found {len(matches)}; folder contains {names}"
        )
    return matches[0]


def normalized_image(source: Path, spec: AssetSpec) -> tuple[Image.Image, tuple[int, int], str]:
    with Image.open(source) as opened:
        opened.load()
        source_size = opened.size
        source_mode = opened.mode
        image = opened.convert("RGBA")

    target_size = (spec.width, spec.height)
    if image.size != target_size:
        image = ImageOps.fit(image, target_size, method=RESAMPLE, centering=(0.5, 0.5))

    if spec.output_format == "JPEG":
        background = Image.new("RGB", target_size, (8, 13, 22))
        background.paste(image, mask=image.getchannel("A"))
        image = background
    else:
        image = image.convert("RGBA")
    return image, source_size, source_mode


def write_asset(source: Path, spec: AssetSpec) -> dict[str, object]:
    destination = RUNTIME_ASSET_ROOT / spec.destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    image, source_size, source_mode = normalized_image(source, spec)
    if spec.output_format == "JPEG":
        image.save(destination, "JPEG", quality=90, optimize=True, progressive=True, subsampling=1)
    else:
        image.save(destination, "PNG", optimize=True, compress_level=9)

    with Image.open(destination) as check:
        check.load()
        if check.size != (spec.width, spec.height):
            raise RuntimeError(f"output dimension verification failed for {destination}")
        output_mode = check.mode

    return {
        "canonicalPath": f"assets/{spec.destination}",
        "repositoryPath": destination.relative_to(PROJECT_ROOT).as_posix(),
        "sourceFolder": spec.source_folder,
        "sourceFile": source.name,
        "sourceSize": {"width": source_size[0], "height": source_size[1]},
        "sourceMode": source_mode,
        "outputSize": {"width": spec.width, "height": spec.height},
        "outputMode": output_mode,
        "format": spec.output_format,
        "profile": spec.profile,
        "status": "REVIEW",
        "bytes": destination.stat().st_size,
    }


def list_extra_images(asset_root: Path, consumed: Iterable[Path]) -> list[str]:
    consumed_set = {path.resolve() for path in consumed}
    extras = []
    for path in asset_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in SOURCE_EXTENSIONS and path.resolve() not in consumed_set:
            extras.append(path.relative_to(asset_root).as_posix())
    return sorted(extras)


def update_register_status() -> int:
    text = REGISTER_PATH.read_text(encoding="utf-8")
    missing_count = text.count("| MISSING |")
    if missing_count != 30:
        raise RuntimeError(f"Register 01 changed unexpectedly: expected 30 MISSING records, found {missing_count}")
    REGISTER_PATH.write_text(text.replace("| MISSING |", "| REVIEW |"), encoding="utf-8")
    return missing_count


def update_board_manifest() -> int:
    data = json.loads(BOARD_MANIFEST_PATH.read_text(encoding="utf-8"))
    updated = 0
    for theme in data.get("themes", []):
        if theme.get("status") == "MISSING":
            theme["status"] = "REVIEW"
            updated += 1
    if updated != 9:
        raise RuntimeError(f"board theme manifest changed unexpectedly: expected 9 MISSING themes, updated {updated}")
    BOARD_MANIFEST_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return updated


def main() -> int:
    specs = expected_specs()
    asset_root = download_drive_folder()
    RUNTIME_ASSET_ROOT.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, object]] = []
    consumed: list[Path] = []
    for number, spec in enumerate(specs, start=1):
        source = find_source(asset_root, spec)
        consumed.append(source)
        record = write_asset(source, spec)
        record["index"] = number
        records.append(record)
        print(f"[{number:03d}/141] {source.relative_to(asset_root)} -> game/assets/{spec.destination}")

    register_records = update_register_status()
    board_themes = update_board_manifest()
    extras = list_extra_images(asset_root, consumed)

    total_bytes = sum(int(record["bytes"]) for record in records)
    manifest = {
        "schemaVersion": 1,
        "register": "register/REGISTER_01_FOUNDATIONS.md",
        "source": {
            "provider": "Google Drive",
            "folderId": DRIVE_FOLDER_ID,
            "folderUrl": DRIVE_FOLDER_URL,
            "providedBy": "project owner",
        },
        "status": "REVIEW",
        "approvalNote": "Dimensions and canonical paths are normalized. Rights metadata, visual consistency and in-game/Steam Deck acceptance remain required before APPROVED.",
        "assetCount": len(records),
        "totalBytes": total_bytes,
        "registerRecordsUpdated": register_records,
        "boardThemesUpdated": board_themes,
        "unmappedSourceImages": extras,
        "assets": records,
    }
    ASSET_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    ASSET_MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if extras:
        print(f"NOTICE: {len(extras)} additional source image(s) were not part of Register 01: {extras}")
    print(f"Imported {len(records)} Register 01 assets ({total_bytes} bytes after normalization).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - emit a concise CI failure boundary
        print(f"REGISTER 01 IMPORT FAILED: {error}", file=sys.stderr)
        raise
