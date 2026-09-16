# RPChess music drop folder

Four Freesound-derived files were added on 2026-09-16. `epic_music1.mp3`, `epic_music2.mp3` and `epic_music4.mp3` are cleared under CC BY 4.0 with attribution. `epic_music3.mp3` is published under CC BY-NC 4.0 and is **not approved for a commercial/moderation candidate** unless RPChess obtains a separate commercial license.

To add cleared music later, place audio files anywhere under this folder and run the canonical build. Supported extensions are `.mp3`, `.ogg` and `.wav`.

`npm run build` recursively scans `game/music/`, copies the files to `dist/music/`, and generates `dist/js/music-catalog.mjs`. No track list needs to be edited by hand.

The checked-in `game/js/music-catalog.mjs` is intentionally an empty source fallback so direct source launches remain safe before a build. The production build always replaces the dist copy with the generated catalog.

Only add files whose commercial-use rights are documented for RPChess.

Exact titles, authors, sources and licenses are recorded in `ATTRIBUTION.md`, `../../THIRD_PARTY_NOTICES.md` and `../../CREDITS.md`.
