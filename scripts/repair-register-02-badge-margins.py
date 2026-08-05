#!/usr/bin/env python3
"""Deterministically inset Register 02 piece badges that touch the canvas edge."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "content/assets/register_02_audit.json"
MANIFEST = ROOT / "content/assets/register_02_assets.json"
TARGET_MARGIN_FRACTION = 0.04
ALPHA_THRESHOLD = 8


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inset_badge(path: Path) -> bool:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    bbox = alpha.getbbox()
    if not bbox:
        return False
    left, top, right, bottom = bbox
    minimum_margin = min(left, top, image.width - right, image.height - bottom)
    required = round(min(image.size) * TARGET_MARGIN_FRACTION)
    if minimum_margin >= required:
        return False
    cropped = image.crop(bbox)
    max_width = image.width - required * 2
    max_height = image.height - required * 2
    scale = min(max_width / cropped.width, max_height / cropped.height, 1.0)
    width = max(1, round(cropped.width * scale))
    height = max(1, round(cropped.height * scale))
    resized = cropped.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((image.width - width) // 2, (image.height - height) // 2))
    canvas.save(path, format="PNG", optimize=True, compress_level=9)
    return True


def main() -> int:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    targets = sorted({
        warning["path"]
        for warning in report.get("warnings", [])
        if warning.get("code") == "content_near_edge" and warning.get("path", "").endswith("/piece_badge.png")
    })
    changed = []
    for repository_path in targets:
        path = ROOT / repository_path
        if inset_badge(path):
            changed.append(repository_path)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    records = {record["repositoryPath"]: record for record in manifest.get("assets", [])}
    for repository_path in changed:
        path = ROOT / repository_path
        record = records[repository_path]
        record["bytes"] = path.stat().st_size
        record["sha256"] = sha256_file(path)
    manifest["totalBytes"] = sum(record["bytes"] for record in manifest.get("assets", []))
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Register 02 badge margin repair: {len(changed)} changed / {len(targets)} flagged")
    for item in changed:
        print(item)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
