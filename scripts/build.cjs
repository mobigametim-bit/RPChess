const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const applySceneLayoutPatch = require('./scene-layout-patch.cjs');
const applyUiPolishPatch = require('./ui-polish-patch.cjs');
const applyUiHotfix136 = require('./ui-hotfix-1.3.6.cjs');
const applyUiHotfix138 = require('./ui-hotfix-1.3.8.cjs');
const applyUiHotfix139 = require('./ui-hotfix-1.3.9.cjs');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const preferred = 'RPChess_Standalone_1.3.3_Web_Deploy.zip';
const fanfareUrl = 'https://drive.google.com/uc?export=download&id=1rJ5lQdUqJsojUcJXve46Jz59z2WCC21K';

async function downloadFanfare() {
  const response = await fetch(fanfareUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Could not download win_fanfare.mp3: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const looksLikeMp3 = bytes.length > 10000 && (bytes.subarray(0,3).toString('ascii') === 'ID3' || bytes[0] === 0xff);
  if (!looksLikeMp3) throw new Error('Downloaded win_fanfare.mp3 is not a valid MP3 file.');
  const sfxDir = path.join(dist, 'SFX');
  fs.mkdirSync(sfxDir, { recursive: true });
  fs.writeFileSync(path.join(sfxDir, 'win_fanfare.mp3'), bytes);
  console.log(`Downloaded win_fanfare.mp3 (${bytes.length} bytes).`);
}

async function main() {
  const zipFiles = fs.readdirSync(root)
    .filter((name) => /^RPChess_Standalone_.*\.zip$/i.test(name))
    .sort((a, b) => fs.statSync(path.join(root, b)).mtimeMs - fs.statSync(path.join(root, a)).mtimeMs);

  const archive = fs.existsSync(path.join(root, preferred)) ? preferred : zipFiles[0];
  if (!archive) {
    throw new Error('RPChess deployment ZIP was not found in the repository root. Upload RPChess_Standalone_1.3.3_Web_Deploy.zip and retry the build.');
  }

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  const zip = new AdmZip(path.join(root, archive));
  zip.extractAllTo(dist, true);

  const nested = path.join(dist, 'RPChess');
  if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
    for (const name of fs.readdirSync(nested)) {
      fs.renameSync(path.join(nested, name), path.join(dist, name));
    }
    fs.rmSync(nested, { recursive: true, force: true });
  }

  await downloadFanfare();
  applySceneLayoutPatch(dist);
  applyUiPolishPatch(dist);
  applyUiHotfix136(dist);
  applyUiHotfix138(dist);
  applyUiHotfix139(dist);

  const index = path.join(dist, 'index.html');
  if (!fs.existsSync(index)) throw new Error('The extracted build does not contain index.html.');
  if (!fs.existsSync(path.join(dist, 'SFX', 'win_fanfare.mp3'))) throw new Error('The deployed fanfare file is missing.');

  console.log(`Prepared ${archive} in ${dist}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
