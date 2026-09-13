from pathlib import Path

root = Path('.')
game = root / 'game'

(game / 'js/music-catalog.mjs').write_text(
    "const MUSIC_TRACKS = Object.freeze([]);\n\nexport { MUSIC_TRACKS };\n",
    encoding='utf-8',
)

readme = (
    "# RPChess music drop folder\n\n"
    "The current release intentionally ships with no background music.\n\n"
    "To add cleared music later, place audio files anywhere under this folder and run the canonical build. "
    "Supported extensions are `.mp3`, `.ogg` and `.wav`.\n\n"
    "`npm run build` recursively scans `game/music/`, copies the files to `dist/music/`, and generates "
    "`dist/js/music-catalog.mjs`. No track list needs to be edited by hand.\n\n"
    "The checked-in `game/js/music-catalog.mjs` is intentionally an empty source fallback so direct source "
    "launches remain safe before a build. The production build always replaces the dist copy with the generated catalog.\n\n"
    "Only add files whose commercial-use rights are documented for RPChess.\n"
)
(game / 'music/README.md').write_text(readme, encoding='utf-8')

for name in [
    'echoes_iron_throne_01.mp3',
    'echoes_iron_throne_02.mp3',
    'echoes_iron_throne_03.mp3',
    'echoes_iron_throne_04.mp3',
]:
    target = game / 'music' / name
    if target.exists():
        target.unlink()

audio_path = game / 'js/reboot-audio.mjs'
audio = audio_path.read_text(encoding='utf-8')
old_tracks = (
    "const MUSIC_TRACKS = Object.freeze([\n"
    "  'music/echoes_iron_throne_01.mp3',\n"
    "  'music/echoes_iron_throne_02.mp3',\n"
    "  'music/echoes_iron_throne_03.mp3',\n"
    "  'music/echoes_iron_throne_04.mp3'\n"
    "]);\n\n"
)
assert old_tracks in audio, 'hard-coded MUSIC_TRACKS block not found'
audio = audio.replace(old_tracks, "import { MUSIC_TRACKS } from './music-catalog.mjs';\n\n", 1)
old = "this.music = typeof Audio === 'function' ? new Audio() : null;"
assert old in audio
audio = audio.replace(old, "this.music = typeof Audio === 'function' && MUSIC_TRACKS.length > 0 ? new Audio() : null;", 1)
old = "  nextTrack() {\n    this.musicIndex = (this.musicIndex + 1) % MUSIC_TRACKS.length;"
assert old in audio
audio = audio.replace(old, "  nextTrack() {\n    if (!MUSIC_TRACKS.length) return;\n    this.musicIndex = (this.musicIndex + 1) % MUSIC_TRACKS.length;", 1)
audio_path.write_text(audio, encoding='utf-8')

build_path = root / 'scripts/build.cjs'
build = build_path.read_text(encoding='utf-8')
old = "'js/reboot-foundation.mjs','js/reboot-audio.mjs','js/platform.mjs'"
assert old in build
build = build.replace(old, "'js/reboot-foundation.mjs','js/reboot-audio.mjs','js/music-catalog.mjs','js/platform.mjs'", 1)
marker = "function copy(relative){const from=path.join(source,relative),to=path.join(dist,relative);if(!fs.existsSync(from))throw new Error(`missing Reboot build input: ${relative}`);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,force:true});}\n"
assert marker in build, 'copy marker not found'
helpers = (
    "function copy(relative){const from=path.join(source,relative),to=path.join(dist,relative);if(!fs.existsSync(from))throw new Error(`missing Reboot build input: ${relative}`);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,force:true});}\n"
    "const MUSIC_EXTENSIONS=new Set(['.mp3','.ogg','.wav']);\n"
    "function collectMusicTracks(directory=path.join(source,'music')){\n"
    "  if(!fs.existsSync(directory))return [];\n"
    "  const tracks=[];\n"
    "  const visit=(current)=>{\n"
    "    for(const entry of fs.readdirSync(current,{withFileTypes:true})){\n"
    "      const absolute=path.join(current,entry.name);\n"
    "      if(entry.isDirectory()){visit(absolute);continue;}\n"
    "      if(!entry.isFile()||!MUSIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))continue;\n"
    "      const relative=path.relative(directory,absolute).split(path.sep).join('/');\n"
    "      tracks.push(`music/${relative}`);\n"
    "    }\n"
    "  };\n"
    "  visit(directory);\n"
    "  return tracks.sort((left,right)=>left.localeCompare(right,'en'));\n"
    "}\n"
    "function writeMusicCatalog(){\n"
    "  const tracks=collectMusicTracks();\n"
    "  const target=path.join(dist,'js/music-catalog.mjs');\n"
    "  fs.mkdirSync(path.dirname(target),{recursive:true});\n"
    "  fs.writeFileSync(target,`const MUSIC_TRACKS = Object.freeze(${JSON.stringify(tracks,null,2)});\\n\\nexport { MUSIC_TRACKS };\\n`,'utf8');\n"
    "  return tracks;\n"
    "}\n"
)
build = build.replace(marker, helpers, 1)
old = "  ])copy(relative);\n  const runtime=materializeRuntimeAssets(dist);"
assert old in build, 'copy loop marker not found'
build = build.replace(
    old,
    "  ])copy(relative);\n  const musicTracks=writeMusicCatalog();\n  console.log(`Runtime music catalog: ${musicTracks.length} track${musicTracks.length===1?'':'s'}`);\n  const runtime=materializeRuntimeAssets(dist);",
    1,
)
build_path.write_text(build, encoding='utf-8')

verify_path = root / 'scripts/verify-source.cjs'
verify = verify_path.read_text(encoding='utf-8')
old_music_required = "'music/echoes_iron_throne_01.mp3','music/echoes_iron_throne_02.mp3','music/echoes_iron_throne_03.mp3','music/echoes_iron_throne_04.mp3',"
assert old_music_required in verify, 'verify-source hard-coded music requirements not found'
verify = verify.replace(old_music_required, "'js/music-catalog.mjs','music/README.md',", 1)
verify_path.write_text(verify, encoding='utf-8')

test_path = root / 'tests/reboot-foundation.cjs'
test = test_path.read_text(encoding='utf-8')
old = "audio=fs.readFileSync(path.join(game,'js/reboot-audio.mjs'),'utf8'),platform="
assert old in test
test = test.replace(old, "audio=fs.readFileSync(path.join(game,'js/reboot-audio.mjs'),'utf8'),musicCatalog=fs.readFileSync(path.join(game,'js/music-catalog.mjs'),'utf8'),platform=", 1)
old_music_test = "for(const track of ['echoes_iron_throne_01.mp3','echoes_iron_throne_02.mp3','echoes_iron_throne_03.mp3','echoes_iron_throne_04.mp3']){assert(audio.includes(`music/${track}`));assert(fs.existsSync(path.join(game,'music',track)));}"
assert old_music_test in test, 'legacy hard-coded music test block not found'
replacement = (
    "assert(audio.includes(\"import { MUSIC_TRACKS } from './music-catalog.mjs'\"),'Audio must consume the generated music catalog');"
    "assert(audio.includes('MUSIC_TRACKS.length > 0'),'Audio must tolerate an empty music catalog');"
    "assert(audio.includes('if (!MUSIC_TRACKS.length) return;'),'Track advance must be safe when no music is shipped');"
    "assert(musicCatalog.includes('Object.freeze([])'),'Source music catalog must remain an empty fallback');"
    "assert(build.includes('collectMusicTracks')&&build.includes('writeMusicCatalog'),'Production build must auto-generate the music catalog from game/music');"
    "const sourceMusicFiles=fs.readdirSync(path.join(game,'music')).filter(name=>/\\.(?:mp3|ogg|wav)$/i.test(name));"
    "assert.deepStrictEqual(sourceMusicFiles,[],'Current source release must ship no background music until cleared tracks are added');"
)
test = test.replace(old_music_test, replacement, 1)
test_path.write_text(test, encoding='utf-8')

audit_path = root / 'docs/platforms/VK_LICENSE_AUDIT_2026-09-13.md'
audit = audit_path.read_text(encoding='utf-8')
audit = audit.replace(
    "| Music: `echoes_iron_throne_01..04.mp3` | OPEN — owner confirmation needed | Runtime use is clear, but no music-specific license/provenance record was found in the repository. |",
    "| Background music | PASS for current candidate | The four Suno Free tracks were removed. The current release intentionally ships with no background music; future tracks must be commercially cleared before being added to `game/music/`. |",
)
start = audit.index('## 4. Audio — OPEN')
end = audit.index('## 5. Visual assets')
section = (
    "## 4. Audio — PARTIAL PASS\n\n"
    "The four previously shipped `echoes_iron_throne_01..04.mp3` files were generated under a Suno Free plan and have been removed from the release source. The current candidate intentionally contains no background music.\n\n"
    "The music runtime no longer hard-codes filenames. `npm run build` scans supported files under `game/music/` and generates the production catalog automatically. This means future commercially cleared tracks can be added without editing gameplay/audio code.\n\n"
    "The production tree still contains game SFX, including `game/SFX/win_fanfare.mp3`. Its provenance/commercial-use basis remains unresolved in repository evidence.\n\n"
    "**Pre-moderation action:** background music is cleared by absence for the current candidate. Before adding future music, record source/tool/author/date and the commercial-use basis. Separately resolve or replace `win_fanfare.mp3` before the final moderation candidate is frozen.\n\n"
)
audit = audit[:start] + section + audit[end:]
audit = audit.replace('- [ ] resolve music provenance;', '- [x] confirm current candidate ships no background music;')
audit = audit.replace(
    'The repository has clear license handling for **Stockfish, the Brahms font and Lichess puzzles**. The concrete unresolved provenance items found in this pass are **music and `win_fanfare.mp3`**. Visual assets need a centralized provenance statement, but no specific contradictory license was found in the current repository audit.',
    'The repository has clear license handling for **Stockfish, the Brahms font and Lichess puzzles**. The previous Suno Free background music has been removed, so it is no longer a current-candidate blocker. The concrete unresolved audio provenance item remaining in this pass is **`win_fanfare.mp3`**. Visual assets still need a centralized provenance statement, but no specific contradictory license was found in the current repository audit.'
)
audit_path.write_text(audit, encoding='utf-8')

checklist_path = root / 'docs/platforms/VK_MODERATION_CHECKLIST.md'
checklist = checklist_path.read_text(encoding='utf-8')
checklist = checklist.replace('- [ ] Check Settings, RU/EN, music and SFX.', '- [ ] Check Settings, RU/EN and SFX; current candidate intentionally has no background music.')
checklist = checklist.replace('- [ ] Confirm provenance/commercial-use basis for all four `echoes_iron_throne_0N.mp3` tracks.', '- [x] Remove the four Suno Free background-music tracks from the release candidate; no background music currently ships.')
checklist = checklist.replace(
    'Current repository-side blocker: audio provenance is not documented sufficiently to mark it cleared from repository evidence alone.',
    'Current repository-side audio blocker: `game/SFX/win_fanfare.mp3` provenance/commercial-use basis is still unresolved. Background music is no longer a blocker because none ships in the current candidate.'
)
checklist_path.write_text(checklist, encoding='utf-8')
