#!/usr/bin/env python3
"""Audit canonical Register 02 images without changing production assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "content/assets/register_02_assets.json"
DEFAULT_REPORT = ROOT / "content/assets/register_02_audit.json"
EXPECTED_SIZES = {
    "HERO-PORTRAIT-768": (768, 768),
    "HERO-BADGE-512": (512, 512),
    "ABILITY-ICON-512": (512, 512),
    "POLITICAL-PORTRAIT-768": (768, 768),
}
TRANSPARENT_PROFILES = {"HERO-BADGE-512", "ABILITY-ICON-512"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def entropy(image: Image.Image) -> float:
    histogram = image.convert("L").histogram()
    total = sum(histogram)
    if not total:
        return 0.0
    value = 0.0
    for count in histogram:
        if count:
            probability = count / total
            value -= probability * math.log2(probability)
    return round(value, 4)


def contrast(image: Image.Image) -> float:
    return round(float(ImageStat.Stat(image.convert("L")).stddev[0]), 4)


def difference_hash(image: Image.Image, width: int = 16, height: int = 16) -> str:
    sample = image.convert("L").resize((width + 1, height), Image.Resampling.LANCZOS)
    pixels = list(sample.getdata())
    bits = []
    for y in range(height):
        row = y * (width + 1)
        for x in range(width):
            bits.append(1 if pixels[row + x] > pixels[row + x + 1] else 0)
    value = 0
    for bit in bits:
        value = (value << 1) | bit
    return f"{value:0{width * height // 4}x}"


def hamming_hex(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def alpha_metrics(image: Image.Image) -> dict[str, Any]:
    alpha = image.getchannel("A") if "A" in image.getbands() else Image.new("L", image.size, 255)
    histogram = alpha.histogram()
    total = image.width * image.height
    transparent = sum(histogram[:250])
    visible = total - histogram[0]
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox:
        left, top, right, bottom = bbox
        margin = min(left, top, image.width - right, image.height - bottom) / min(image.size)
    else:
        margin = 0.0
    return {
        "transparentFraction": round(transparent / total, 6),
        "visibleFraction": round(visible / total, 6),
        "safeMarginFraction": round(margin, 6),
        "contentBox": list(bbox) if bbox else None,
    }


def audit_asset(record: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    path = ROOT / record["repositoryPath"]
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    result: dict[str, Any] = {
        "canonicalPath": record["canonicalPath"],
        "repositoryPath": record["repositoryPath"],
        "profile": record["profile"],
    }
    if not path.is_file():
        errors.append({"code": "missing_file", "path": record["repositoryPath"]})
        return result, errors, warnings
    try:
        with Image.open(path) as opened:
            opened.load()
            image = opened.convert("RGBA")
            result.update({
                "size": [opened.width, opened.height],
                "mode": opened.mode,
                "format": opened.format,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
                "dhash": difference_hash(image),
                "alpha": alpha_metrics(image),
                "readability": {
                    "160": {
                        "entropy": entropy(image.resize((160, 160), Image.Resampling.LANCZOS)),
                        "contrast": contrast(image.resize((160, 160), Image.Resampling.LANCZOS)),
                    },
                    "64": {
                        "entropy": entropy(image.resize((64, 64), Image.Resampling.LANCZOS)),
                        "contrast": contrast(image.resize((64, 64), Image.Resampling.LANCZOS)),
                    },
                },
            })
    except Exception as exc:
        errors.append({"code": "decode_failed", "path": record["repositoryPath"], "detail": str(exc)})
        return result, errors, warnings

    expected = EXPECTED_SIZES.get(record["profile"])
    if expected and tuple(result["size"]) != expected:
        errors.append({"code": "wrong_dimensions", "path": record["repositoryPath"], "expected": list(expected), "actual": result["size"]})
    if result["format"] != "PNG":
        errors.append({"code": "wrong_format", "path": record["repositoryPath"], "expected": "PNG", "actual": result["format"]})
    manifest_sha = record.get("sha256")
    if manifest_sha and manifest_sha != result["sha256"]:
        errors.append({"code": "manifest_hash_mismatch", "path": record["repositoryPath"], "expected": manifest_sha, "actual": result["sha256"]})

    if record["profile"] in TRANSPARENT_PROFILES:
        alpha = result["alpha"]
        if alpha["transparentFraction"] < 0.01:
            warnings.append({"code": "effectively_opaque_icon", "path": record["repositoryPath"], "transparentFraction": alpha["transparentFraction"]})
        if alpha["visibleFraction"] < 0.03:
            warnings.append({"code": "very_sparse_icon", "path": record["repositoryPath"], "visibleFraction": alpha["visibleFraction"]})
        if alpha["safeMarginFraction"] < 0.015:
            warnings.append({"code": "content_near_edge", "path": record["repositoryPath"], "safeMarginFraction": alpha["safeMarginFraction"]})

    for size in ("160", "64"):
        metrics = result["readability"][size]
        if metrics["entropy"] < 2.0 or metrics["contrast"] < 12.0:
            warnings.append({"code": "low_thumbnail_readability", "path": record["repositoryPath"], "thumbnail": int(size), **metrics})
    return result, errors, warnings


def build_report(manifest_path: Path) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for record in manifest.get("assets", []):
        result, item_errors, item_warnings = audit_asset(record)
        assets.append(result)
        errors.extend(item_errors)
        warnings.extend(item_warnings)

    by_sha: dict[str, list[str]] = defaultdict(list)
    by_profile_bytes: dict[str, list[int]] = defaultdict(list)
    for asset in assets:
        if asset.get("sha256"):
            by_sha[asset["sha256"]].append(asset["repositoryPath"])
        if asset.get("bytes"):
            by_profile_bytes[asset["profile"]].append(asset["bytes"])
    for digest, paths in sorted(by_sha.items()):
        if len(paths) > 1:
            errors.append({"code": "exact_duplicate", "sha256": digest, "paths": sorted(paths)})

    medians = {profile: statistics.median(values) for profile, values in by_profile_bytes.items() if values}
    for asset in assets:
        median = medians.get(asset.get("profile"))
        size = asset.get("bytes")
        if not median or not size:
            continue
        ratio = size / median
        if ratio > 2.75 or ratio < 0.25:
            warnings.append({"code": "anomalous_file_weight", "path": asset["repositoryPath"], "profile": asset["profile"], "bytes": size, "medianBytes": int(median), "ratio": round(ratio, 4)})

    by_profile: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for asset in assets:
        if asset.get("dhash"):
            by_profile[asset["profile"]].append(asset)
    for profile, group in by_profile.items():
        for index, left in enumerate(group):
            for right in group[index + 1:]:
                distance = hamming_hex(left["dhash"], right["dhash"])
                if distance <= 2 and left.get("sha256") != right.get("sha256"):
                    warnings.append({"code": "possible_near_duplicate", "profile": profile, "distance": distance, "paths": [left["repositoryPath"], right["repositoryPath"]]})

    errors.sort(key=lambda item: (item["code"], json.dumps(item, ensure_ascii=False, sort_keys=True)))
    warnings.sort(key=lambda item: (item["code"], json.dumps(item, ensure_ascii=False, sort_keys=True)))
    assets.sort(key=lambda item: item["canonicalPath"])
    return {
        "schemaVersion": 1,
        "register": manifest.get("register"),
        "manifestAssetCount": manifest.get("assetCount"),
        "auditedAssetCount": len(assets),
        "gate": "PASS" if not errors else "FAIL",
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "profileMedianBytes": {key: int(value) for key, value in sorted(medians.items())},
        "errors": errors,
        "warnings": warnings,
        "assets": assets,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--check", action="store_true", help="Fail when the committed report differs from a fresh audit.")
    args = parser.parse_args()
    report = build_report(args.manifest.resolve())
    serialized = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    if args.check:
        if not args.output.is_file():
            raise SystemExit(f"audit report is missing: {args.output}")
        current = args.output.read_text(encoding="utf-8")
        if current != serialized:
            raise SystemExit("Register 02 audit report is stale; run scripts/audit-register-02-assets.py")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(f"Register 02 audit: {report['gate']} ({report['auditedAssetCount']} assets, {report['errorCount']} errors, {report['warningCount']} warnings)")
    return 0 if report["gate"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
