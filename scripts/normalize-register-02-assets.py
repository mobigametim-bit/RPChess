#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps

HERO_SLUGS = [
    'aldric_wall', 'mara_chain', 'brother_orell', 'vael_hammer', 'lady_sorn', 'tomas_gate',
    'seraph_lyra', 'ivar_lens', 'nemea_quill', 'orion_step', 'abbess_celene', 'deacon_mirel',
    'cassian_coin', 'viola_mask', 'renzo_bridge', 'tessa_gull', 'old_marin', 'elio_silk',
    'briar_sister', 'roan_stag', 'maeve_root', 'puck_ember', 'lord_aylen', 'ysra_moss',
    'kael_cinder', 'velka_urn', 'rath_banner', 'suri_ash', 'empress_nahla', 'daro_last',
    'temur_wind', 'altana_bow', 'batu_cliff', 'saran_dawn', 'khulan_star', 'ergen_cloud',
]
HERO_FILES = {
    'portrait.png': (768, 768, 'HERO-PORTRAIT-768'),
    'piece_badge.png': (512, 512, 'HERO-BADGE-512'),
    'ability_icon.png': (512, 512, 'ABILITY-ICON-512'),
}
POLITICAL_FILES = [
    'marshal_varn.png', 'heir_elda.png', 'guildmaster_borek.png',
    'pontiff_aelia.png', 'archivist_noem.png', 'heretic_salos.png',
    'consul_marco.png', 'speaker_ines.png', 'admiral_rava.png',
    'warden_roan.png', 'bride_melis.png', 'huntsman_orr.png',
    'empress_nahla_p.png', 'general_dor.png', 'priestess_velka.png',
    'khan_temur.png', 'princess_khulan.png', 'speaker_batu.png',
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Normalize REGISTER 02 hero and political assets.')
    parser.add_argument('--source-root', required=True, type=Path)
    parser.add_argument('--repository-root', default=Path('.'), type=Path)
    return parser.parse_args()


def locate_source_folder(source_root: Path, name: str) -> Path:
    direct = source_root / name
    if direct.is_dir():
        return direct
    matches = [path for path in source_root.rglob(name) if path.is_dir()]
    if len(matches) != 1:
        raise RuntimeError(f'{name}: expected one source folder, found {len(matches)}')
    return matches[0]


def normalize_png(source: Path, destination: Path, size: tuple[int, int]) -> dict:
    if not source.is_file():
        raise RuntimeError(f'missing source image: {source}')
    with Image.open(source) as image:
        source_size = {'width': image.width, 'height': image.height}
        source_mode = image.mode
        image.load()
        converted = image.convert('RGBA')
        if converted.size != size:
            converted = ImageOps.fit(converted, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        destination.parent.mkdir(parents=True, exist_ok=True)
        converted.save(destination, format='PNG', optimize=True, compress_level=9)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    return {
        'sourceSize': source_size,
        'sourceMode': source_mode,
        'outputSize': {'width': size[0], 'height': size[1]},
        'outputMode': 'RGBA',
        'format': 'PNG',
        'bytes': destination.stat().st_size,
        'sha256': digest,
    }


def update_register(repository_root: Path) -> str:
    matches = list(repository_root.rglob('REGISTER_02_HEROES_AND_POLITICS.md'))
    if len(matches) != 1:
        raise RuntimeError(f'expected one REGISTER_02_HEROES_AND_POLITICS.md, found {len(matches)}')
    register_path = matches[0]
    text = register_path.read_text(encoding='utf-8')
    changed = 0
    updated_lines = []
    for line in text.splitlines():
        if (line.startswith('| HERO-') or line.startswith('| POL-')) and line.rstrip().endswith('| MISSING |'):
            line = line.rsplit('| MISSING |', 1)[0] + '| REVIEW |'
            changed += 1
        updated_lines.append(line)
    if changed != 54:
        raise RuntimeError(f'expected to update 54 Register 02 records, updated {changed}')
    register_path.write_text('\n'.join(updated_lines) + '\n', encoding='utf-8')
    return register_path.relative_to(repository_root).as_posix()


def main() -> None:
    args = parse_args()
    source_root = args.source_root.resolve()
    repository_root = args.repository_root.resolve()
    if not source_root.is_dir():
        raise RuntimeError(f'source root does not exist: {source_root}')

    expected_folders = set(HERO_SLUGS + ['politics'])
    actual_folders = {path.name for path in source_root.rglob('*') if path.is_dir() and path.name in expected_folders}
    missing_folders = sorted(expected_folders - actual_folders)
    if missing_folders:
        raise RuntimeError(f'missing source folders: {missing_folders}')

    manifest_assets = []
    index = 0
    for slug in HERO_SLUGS:
        folder = locate_source_folder(source_root, slug)
        actual_files = {path.name for path in folder.iterdir() if path.is_file()}
        if actual_files != set(HERO_FILES):
            raise RuntimeError(f'{slug}: expected {sorted(HERO_FILES)}, found {sorted(actual_files)}')
        for filename, (width, height, profile) in HERO_FILES.items():
            index += 1
            source = folder / filename
            repository_path = Path('game/assets/heroes') / slug / filename
            details = normalize_png(source, repository_root / repository_path, (width, height))
            manifest_assets.append({
                'canonicalPath': (Path('assets/heroes') / slug / filename).as_posix(),
                'repositoryPath': repository_path.as_posix(),
                'sourceFolder': slug,
                'sourceFile': filename,
                **details,
                'profile': profile,
                'status': 'REVIEW',
                'index': index,
            })

    politics_folder = locate_source_folder(source_root, 'politics')
    actual_politics = {path.name for path in politics_folder.iterdir() if path.is_file()}
    if actual_politics != set(POLITICAL_FILES):
        missing = sorted(set(POLITICAL_FILES) - actual_politics)
        extra = sorted(actual_politics - set(POLITICAL_FILES))
        raise RuntimeError(f'politics: missing={missing}; extra={extra}')
    for filename in POLITICAL_FILES:
        index += 1
        source = politics_folder / filename
        repository_path = Path('game/assets/politics') / filename
        details = normalize_png(source, repository_root / repository_path, (768, 768))
        manifest_assets.append({
            'canonicalPath': (Path('assets/politics') / filename).as_posix(),
            'repositoryPath': repository_path.as_posix(),
            'sourceFolder': 'politics',
            'sourceFile': filename,
            **details,
            'profile': 'POLITICAL-PORTRAIT-768',
            'status': 'REVIEW',
            'index': index,
        })

    if len(manifest_assets) != 126:
        raise RuntimeError(f'expected 126 assets, normalized {len(manifest_assets)}')

    register_path = update_register(repository_root)
    manifest = {
        'schemaVersion': 1,
        'register': register_path,
        'source': {
            'provider': 'Google Drive',
            'folderId': '1JzJyNu52MD7hS3F_xFi71klXF9oJG_VB',
            'folderUrl': 'https://drive.google.com/drive/folders/1JzJyNu52MD7hS3F_xFi71klXF9oJG_VB',
            'providedBy': 'project owner',
            'downloadMode': 'sharded-folder-artifacts',
        },
        'status': 'REVIEW',
        'approvalNote': 'Canonical paths and dimensions are normalized. Rights metadata, visual consistency and in-game readability remain required before APPROVED.',
        'assetCount': len(manifest_assets),
        'heroCount': len(HERO_SLUGS),
        'politicalCharacterCount': len(POLITICAL_FILES),
        'registerRecordsUpdated': 54,
        'totalBytes': sum(asset['bytes'] for asset in manifest_assets),
        'unmappedSourceImages': [],
        'assets': manifest_assets,
    }
    manifest_path = repository_root / 'content/assets/register_02_assets.json'
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Normalized {manifest['assetCount']} Register 02 assets ({manifest['totalBytes']} bytes)")
    print(f'Updated register: {register_path}')


if __name__ == '__main__':
    main()
