# RPChess music drop folder

The current release intentionally ships with no background music.

To add cleared music later, place audio files anywhere under this folder and run the canonical build. Supported extensions are `.mp3`, `.ogg` and `.wav`.

`npm run build` recursively scans `game/music/`, copies the files to `dist/music/`, and generates `dist/js/music-catalog.mjs`. No track list needs to be edited by hand.

The checked-in `game/js/music-catalog.mjs` is intentionally an empty source fallback so direct source launches remain safe before a build. The production build always replaces the dist copy with the generated catalog.

Only add files whose commercial-use rights are documented for RPChess.
