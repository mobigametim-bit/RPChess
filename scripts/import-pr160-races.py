#!/usr/bin/env python3
"""Import the nine supplementary race-piece sets from staged PR #160 ZIP parts.

Usage: python scripts/import-pr160-races.py --archive-dir imports/pr160 --game-root game
"""
import argparse
import hashlib
import io
from pathlib import Path
import re
import struct
import zipfile

RACES = {
    'гномы': 'dwarves',
    'гоблины': 'goblins',
    'демоны': 'demons',
    'дракониды': 'dragonborn',
    'животные': 'animals',
    'зверолюди': 'beastfolk',
    'конструкты': 'constructs',
    'темные эльфы': 'dark_elves',
    'эльфы': 'elves',
}
TYPES = {'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'}
COLORS = {'white', 'black'}
EXPECTED_FILES = len(RACES) * len(COLORS) * len(TYPES)
PART_RE = re.compile(r'piece-archive\.part(\d{3})$')


def import_races(archive_dir, game_root):
    parts = sorted(p for p in archive_dir.iterdir() if PART_RE.fullmatch(p.name))
    if len(parts) != 24 or [int(PART_RE.fullmatch(p.name).group(1)) for p in parts] != list(range(24)):
        raise ValueError('Expected exactly 24 ordered PR160 archive parts')
    joined = b''.join(p.read_bytes() for p in parts)
    digest = hashlib.sha256(joined).hexdigest()
    # Check the final ZIP against the exact converted artwork before extraction.
    if digest != 'b9434cec0b520e0b3fd7572f8832630e34dd1e4e276dd179cedb6f9b06eecd8b':
        raise ValueError(f'Converted ZIP SHA256 mismatch: {digest}')
    extracted = {}
    with zipfile.ZipFile(io.BytesIO(joined)) as archive:
        for item in archive.infolist():
            if item.is_dir():
                continue
            if item.file_size > 320 * 1024:
                raise ValueError(f'Unexpected oversized PNG {item.filename}')
            parts_of_path = item.filename.split('/')
            if len(parts_of_path) != 3:
                raise ValueError(f'Unexpected path in archive: {item.filename}')
            race_label, color, filename = parts_of_path
            race = RACES.get(race_label)
            piece = filename.removesuffix('.png')
            if not race or color not in COLORS or piece not in TYPES or filename != f'{piece}.png':
                raise ValueError(f'Unexpected race/color/piece: {item.filename}')
            data = archive.read(item)
            if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (256, 256):
                raise ValueError(f'Not a 256x256 PNG: {item.filename}')
            target = game_root / 'assets' / 'races' / race / 'pieces' / 'board' / color / filename
            if target in extracted:
                raise ValueError(f'Duplicate target: {target}')
            extracted[target] = data
    if len(extracted) != EXPECTED_FILES:
        raise ValueError(f'Expected {EXPECTED_FILES} sprites, got {len(extracted)}')
    for target, data in extracted.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(f'Imported {len(extracted)} complete 256x256 race sprites into {game_root} (sha256: {digest})')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive-dir', type=Path, default=Path('imports/pr160'))
    parser.add_argument('--game-root', type=Path, default=Path('game'))
    args = parser.parse_args()
    import_races(args.archive_dir, args.game_root)
