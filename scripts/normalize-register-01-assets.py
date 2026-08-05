#!/usr/bin/env python3
"""Normalize a previously downloaded Register 01 directory.

The downloader is intentionally separated from normalization so CI may fetch each
Google Drive subfolder on an independent runner and then merge the artifacts.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMPORTER_PATH = PROJECT_ROOT / "scripts" / "import-register-01-assets.py"


def load_importer():
    spec = importlib.util.spec_from_file_location("rpchess_register_01_importer", IMPORTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load Register 01 importer")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, help="Merged directory containing all 24 source folders")
    args = parser.parse_args()

    importer = load_importer()
    asset_root = importer.locate_asset_root(Path(args.source_root).resolve())
    specs = importer.expected_specs()
    importer.RUNTIME_ASSET_ROOT.mkdir(parents=True, exist_ok=True)

    records = []
    consumed = []
    for number, spec in enumerate(specs, start=1):
        source = importer.find_source(asset_root, spec)
        consumed.append(source)
        record = importer.write_asset(source, spec)
        record["index"] = number
        records.append(record)
        print(f"[{number:03d}/141] {source.relative_to(asset_root)} -> game/assets/{spec.destination}")

    register_records = importer.update_register_status()
    board_themes = importer.update_board_manifest()
    extras = importer.list_extra_images(asset_root, consumed)
    total_bytes = sum(int(record["bytes"]) for record in records)

    manifest = {
        "schemaVersion": 1,
        "register": "register/REGISTER_01_FOUNDATIONS.md",
        "source": {
            "provider": "Google Drive",
            "folderId": importer.DRIVE_FOLDER_ID,
            "folderUrl": importer.DRIVE_FOLDER_URL,
            "providedBy": "project owner",
            "downloadMode": "sharded-folder-artifacts",
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
    importer.ASSET_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    importer.ASSET_MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if extras:
        print(f"NOTICE: {len(extras)} additional source image(s) were not part of Register 01: {extras}")
    print(f"Imported {len(records)} Register 01 assets ({total_bytes} bytes after normalization).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
