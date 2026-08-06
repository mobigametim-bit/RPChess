#!/usr/bin/env python3
"""One-time importer for the remaining supplied REGISTER_04_EVENTS illustrations."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from pathlib import Path

import gdown
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "game/assets/events/register-04"
MANIFEST_PATH = ROOT / "content/manifests/register-04-events.json"
AUDIT_PATH = ROOT / "content/audits/register_04_event_assets.json"
RESOLVER_PATH = ROOT / "game/js/register-04-event-assets.mjs"
TEST_PATH = ROOT / "tests/register-04-event-assets.cjs"
RUNTIME_SIZE = (1600, 900)

# event number, slug/file stem, category folder, Drive file ID
NEW_ASSETS = [
    (37, "tree_that_remembers", "thorn_covenant", "1UnKn5RhyAu34WZ1ZFbhLfPiyB75eMPr2"),
    (38, "knight_between_gates", "thorn_covenant", "1EcD7t3EaN5lMgQfEeqg7_YK53FzIkPHn"),
    (39, "thorn_wedding", "thorn_covenant", "1n6LK1AEepX40efqRY0IBlA3dWTpIabN-"),
    (45, "moss_tribunal", "thorn_covenant", "1uQPGffdXD_VCWvLORk4zI93ouwT7ek-7"),
    (48, "seed_dead_king", "thorn_covenant", "1Xyw7-VOFh5yFqzvrohEfumPH3V0sex6k"),
    (52, "emperors_empty_urn", "ashen_dominion", "113rr4J--O4bPPpJf4Io2f2VyJ8wopzv9"),
    (55, "general_refuses_death", "ashen_dominion", "11Ce9AymMPrby26Xb9kUw79lfvhYzXqYG"),
    (56, "red_succession", "ashen_dominion", "1pmH7AJbH1RRWqbfS454IrqZn7mduYyyW"),
    (57, "unburned_letter", "ashen_dominion", "1qorEYBvtFLUvDdhtID5mwUHQM3tIBbiI"),
    (61, "fallen_sky_banner", "sky_khanate", "1EnYVF3C1izVGMHDCFUx2daGREjYZhM6D"),
    (62, "horse_without_rider", "sky_khanate", "1d23pVEgAoYwzArFkGN26SQ-2nWsaay5z"),
    (63, "cliff_parliament", "sky_khanate", "1jq-xmRBJZ_ezFApZ7GkK4_vJw9JZf00E"),
    (64, "storm_over_caravan", "sky_khanate", "1edoEUndyyrN7QmJd4BDmy1cRKPwannu8"),
    (73, "abandoned_chess_hall", "generic", "15Brq01Orc94_p46j8tqLygT4LncSG-06"),
    (74, "three_roads_at_dawn", "generic", "1XRTmvU-l5NF8ADZjzclDgTmnCq26CtXc"),
    (75, "veterans_map", "generic", "1wf9syPsyBcETW65crhOM4lUPPWSLvxaF"),
    (76, "shrine_to_no_king", "generic", "1aB8PpU_4n2yQznv-_19tAUNgA4b6ve0X"),
    (77, "hungry_company", "generic", "1l7NzgSNqi2VpYotBgVPhuMjz74dG8hB0"),
    (78, "honest_bandit", "generic", "1kJgnLvWTFGjs78XmNo8tmR928df8Z9MW"),
    (79, "village_under_check", "generic", "1gxlsIEfz5ULbW5dGujkuHG164IbviPmd"),
    (88, "refugee_council", "generic", "1vfG7Ldj0kWSZPLGpgtxPa5qSIcLNYR6n"),
    (89, "broken_crownsmith", "generic", "12Y44oVrX5te5g48qxM2y2UGob_LalDDS"),
    (93, "council_six_empty_chairs", "political", "13rhs86sLXW7skvUw4UX-jgPUIaI7ChNf"),
    (95, "treaty_written_in_ash", "political", "1hrg9d3CQ1T3Q2h7CBBAEO4uconvA-nGY"),
    (96, "hostage_exchange", "political", "1ykCvZqHoHOKdGQSohnLnRk9CncaK4PN5"),
    (103, "trial_of_treason", "political", "10gPnkO-XCCHcKslGHzV1J9RR25rv3rMQ"),
    (106, "city_requests_protection", "political", "1QR6m2HPs3-BrWIt93DJuKABINbRzoyxs"),
    (107, "price_of_recognition", "political", "13QxVs5lNAHMjjmRcfPAo5ul6urjpvHcd"),
    (108, "crown_in_escrow", "political", "1BjR4xEEN5yR2Qe-__vfKUJLQI22avAmc"),
    (109, "neutral_ambassador", "political", "1L5c3AosxLkjtSgGy1cZLxHT9xHYgIIBF"),
    (110, "funeral_without_body", "political", "1alWflJvJArofUI9_rFf0wfpyH3dokg59"),
    (111, "rebels_amnesty", "political", "1b1kbzUw0F6RnL3ZrkZFRbX9-AwD7m1gJ"),
    (113, "failed_assassination", "political", "1rNj50ooTC8UxD47xG7nvdf5u7gxijyvd"),
    (115, "divided_army", "political", "116wtfYGVtHmBJtiXcRaza0o6eNTJTGRH"),
    (116, "peoples_petition", "political", "1sx6cwgCX6uI7D-Gp2ak542NoD3-gO_Kh"),
    (122, "banner_of_surrender", "political", "1tO1hy6v26pLyxol5c3NwQSePOfBcFIPx"),
    (123, "aldrics_unfinished_wall", "heroes", "11GUj8r9LtRNMRpxr54UE4HQfRT7pmLVa"),
    (124, "lyras_forbidden_hymn", "heroes", "1XYjYwWI9cOHLFmaZO4zlkXuXhKu4ScOg"),
    (125, "viola_removes_the_mask", "heroes", "1avTMnKJteXH__PSBLgnPFnjtHui1sG72"),
    (126, "roan_returns_to_the_grove", "heroes", "16YNeMMlKbC4AQ9dN6HKWYrqvvoIDeQA1"),
    (127, "nahlas_private_debt", "heroes", "1AuJyYe0N3vzUguzKw14PzQJ-IbDz1zSB"),
    (128, "temurs_last_race", "heroes", "1BuA9AoXzNQoFPvSZelqZCGjt_aV_xQ-d"),
    (129, "mara_names_the_dead", "heroes", "1Np6AMZ88a0KhBGlhb9oUREhIjTvKV0Al"),
    (130, "ivar_breaks_the_lens", "heroes", "1rP6bwtuu4REeLurs3nOkKBarV0Rl3T_h"),
    (131, "tessas_smuggled_passenger", "heroes", "1M_bCF32IWzHyggLLTHwB9nXCJdM6SmKI"),
    (132, "velka_opens_the_urn", "heroes", "1lKE_EmvwT-v7cLlOZ7SCn4BJ9sYCyYZQ"),
    (133, "mirror_speaks_first", "secret", "1uhj6ON7sEpL16ycKsBY1lj3jCw4Ie629"),
    (134, "board_beyond_board", "secret", "1OUP0kS723j2wh2A5VI-rNM8kxblixNlW"),
    (135, "seventh_throne", "secret", "1RstZwygi4br0Vz1l-28TRhX4lW3CAsqs"),
    (136, "hollow_choir_rehearses", "secret", "186-mAfOmHBHooqs-LROMK5jqN6XCcgWJ"),
    (137, "move_never_happened", "secret", "1lbjjXYE7X1RK3ZkuRNGcBdnatofl71wn"),
    (138, "pawn_with_your_face", "secret", "1kT19s0fgylowLC9ZHVCac8i6xqh71-q1"),
    (139, "door_behind_victory", "secret", "1z_LpYiY0ZktM59Fk_Wpd0DWIQFssLS8d"),
    (140, "worlds_missing_square", "secret", "1FQuXf9ZLDQO4QLYv1pTEpPhNtzV9c230"),
]

ALIASES = {
    "event.duel_masons": "duel_of_masons",
    "event.prisoners_pass": "prisoners_of_the_pass",
    "event.contract_in_three_seals": "contract_three_seals",
    "event.knight_lost_between_gates": "knight_between_gates",
    "event.seed_of_a_dead_king": "seed_dead_king",
    "event.general_who_refuses_death": "general_refuses_death",
    "event.horse_without_a_rider": "horse_without_rider",
    "event.storm_over_the_caravan": "storm_over_caravan",
    "event.council_of_six_empty_chairs": "council_six_empty_chairs",
    "event.funeral_without_a_body": "funeral_without_body",
    "event.board_beyond_the_board": "board_beyond_board",
    "event.move_that_never_happened": "move_never_happened",
    "event.door_behind_the_victory": "door_behind_victory",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download_asset(file_id: str, target: Path) -> None:
    result = gdown.download(id=file_id, output=str(target), quiet=False, fuzzy=True)
    if not result or not target.exists() or target.stat().st_size < 1024:
        raise RuntimeError(f"Google Drive download failed for {file_id}")
    if target.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Downloaded file is not PNG: {file_id}")


def normalize(source: Path, destination: Path) -> dict:
    source_bytes = source.read_bytes()
    with Image.open(source) as opened:
        source_size = list(opened.size)
        source_mode = opened.mode
        image = ImageOps.fit(opened.convert("RGB"), RUNTIME_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="PNG", optimize=True, compress_level=7)
    runtime_bytes = destination.read_bytes()
    return {
        "source_size": source_size,
        "source_mode": source_mode,
        "runtime_size": list(RUNTIME_SIZE),
        "runtime_mode": "RGB",
        "source_sha256": sha256(source_bytes),
        "runtime_sha256": sha256(runtime_bytes),
        "bytes": len(runtime_bytes),
    }


def build_resolver(assets: list[dict]) -> str:
    paths = {asset["slug"]: asset["path"].removeprefix("game/assets/events/register-04/") for asset in assets}
    mappings = {f"event.{slug}": path for slug, path in paths.items()}
    for alias, canonical_slug in ALIASES.items():
        if canonical_slug in paths:
            mappings[alias] = paths[canonical_slug]
    lines = [f"  {json.dumps(key)}: {json.dumps(mappings[key])}," for key in sorted(mappings)]
    return """const REGISTER_04_EVENT_ROOT = 'assets/events/register-04';
const REGISTER_04_UNIQUE_ASSET_COUNT = %d;

const EVENT_FILE_BY_ID = Object.freeze({
%s
});

function normalizeEventId(value) {
  const raw = String(value || '');
  if (!raw) return null;
  return raw.startsWith('event.') ? raw : `event.${raw.replace(/\\.png$/i, '')}`;
}

function register04EventAsset(eventId, fallback = 'generated_assets/scene_event.jpg') {
  const normalized = normalizeEventId(eventId);
  const file = normalized ? EVENT_FILE_BY_ID[normalized] : null;
  return file ? `${REGISTER_04_EVENT_ROOT}/${file}` : fallback;
}

function hasRegister04EventAsset(eventId) {
  const normalized = normalizeEventId(eventId);
  return Boolean(normalized && EVENT_FILE_BY_ID[normalized]);
}

export {
  REGISTER_04_EVENT_ROOT,
  REGISTER_04_UNIQUE_ASSET_COUNT,
  EVENT_FILE_BY_ID,
  normalizeEventId,
  register04EventAsset,
  hasRegister04EventAsset
};
""" % (len(assets), "\n".join(lines))


def build_test() -> str:
    return r"""'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifests/register-04-events.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'content/audits/register_04_event_assets.json'), 'utf8'));

function pngSize(buffer) {
  assert.strictEqual(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

(async () => {
  assert.strictEqual(manifest.register, 'REGISTER_04_EVENTS');
  assert.strictEqual(manifest.count, 74);
  assert.strictEqual(audit.importedCount, 74);
  assert.strictEqual(audit.uniqueIllustrationCount, 74);
  assert.strictEqual(audit.eventRecordCount, 140);
  assert.strictEqual(audit.status, 'SUPPLIED_ART_COMPLETE');
  assert.strictEqual(new Set(manifest.assets.map((entry) => entry.slug)).size, 74);
  assert.strictEqual(new Set(manifest.assets.map((entry) => entry.path)).size, 74);
  for (const asset of manifest.assets) {
    const absolute = path.join(root, asset.path);
    assert(fs.existsSync(absolute), `missing ${asset.path}`);
    const bytes = fs.readFileSync(absolute);
    assert.deepStrictEqual(pngSize(bytes), [1600, 900], asset.path);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), asset.runtime_sha256);
    assert.strictEqual(asset.status, 'IMPORTED');
  }
  const resolver = await import(pathToFileURL(path.join(root, 'game/js/register-04-event-assets.mjs')).href);
  assert.strictEqual(resolver.REGISTER_04_UNIQUE_ASSET_COUNT, 74);
  for (const asset of manifest.assets) {
    assert.strictEqual(resolver.hasRegister04EventAsset(`event.${asset.slug}`), true, asset.slug);
    assert.strictEqual(resolver.register04EventAsset(`event.${asset.slug}`).endsWith(asset.path.replace(/^game\//, '')), true, asset.slug);
  }
  assert.strictEqual(resolver.register04EventAsset('event.prisoners_pass'), 'assets/events/register-04/prisoners_of_the_pass.png');
  assert.strictEqual(resolver.register04EventAsset('event.knight_lost_between_gates'), 'assets/events/register-04/thorn_covenant/knight_between_gates.png');
  assert.strictEqual(resolver.register04EventAsset('event.move_that_never_happened'), 'assets/events/register-04/secret/move_never_happened.png');
  assert.strictEqual(resolver.hasRegister04EventAsset('event.not_supplied'), false);
  assert.strictEqual(resolver.register04EventAsset('event.not_supplied'), 'generated_assets/scene_event.jpg');
  console.log('Register 04 event assets: 74/74 supplied illustrations imported, audited and resolved.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
"""


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    existing = {entry["slug"]: entry for entry in manifest.get("assets", [])}
    if len(existing) != 20:
        raise RuntimeError(f"Expected 20 existing Register 04 assets, found {len(existing)}")

    with tempfile.TemporaryDirectory(prefix="register04-") as temp_dir:
        temp = Path(temp_dir)
        for number, slug, category, drive_id in NEW_ASSETS:
            source = temp / f"{slug}.png"
            destination = ASSET_ROOT / category / f"{slug}.png"
            print(f"Importing EVENT-{number:03d} {slug}")
            download_asset(drive_id, source)
            metadata = normalize(source, destination)
            existing[slug] = {
                "id": f"EVENT-{number:03d}",
                "slug": slug,
                "region": category,
                "path": destination.relative_to(ROOT).as_posix(),
                "source_drive_id": drive_id,
                "source_drive_name": f"{slug}.png",
                **metadata,
                "status": "IMPORTED",
            }

    assets = sorted(existing.values(), key=lambda entry: (int(entry["id"].split("-")[1]), entry["slug"]))
    if len(assets) != 74:
        raise RuntimeError(f"Expected 74 supplied illustrations, found {len(assets)}")

    manifest.update({
        "schemaVersion": 2,
        "register": "REGISTER_04_EVENTS",
        "assetRoot": "game/assets/events/register-04",
        "count": len(assets),
        "assets": assets,
    })
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    audit = {
        "schemaVersion": 2,
        "register": "REGISTER_04_EVENTS",
        "status": "SUPPLIED_ART_COMPLETE",
        "eventRecordCount": 140,
        "uniqueIllustrationCount": len(assets),
        "importedCount": len(assets),
        "technicalRequirements": {"format": "PNG", "size": list(RUNTIME_SIZE), "mode": "RGB"},
        "assets": assets,
    }
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    RESOLVER_PATH.write_text(build_resolver(assets), encoding="utf-8")
    TEST_PATH.write_text(build_test(), encoding="utf-8")

    print(f"Imported {len(NEW_ASSETS)} new files; Register 04 now resolves {len(assets)} supplied illustrations.")


if __name__ == "__main__":
    main()
