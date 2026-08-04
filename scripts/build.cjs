const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const applySceneLayoutPatch = require('./scene-layout-patch.cjs');
const applyUiPolishPatch = require('./ui-polish-patch.cjs');
const applyUiHotfix136 = require('./ui-hotfix-1.3.6.cjs');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const preferred = 'RPChess_Standalone_1.3.3_Web_Deploy.zip';

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

applySceneLayoutPatch(dist);
applyUiPolishPatch(dist);
applyUiHotfix136(dist);

const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) {
  throw new Error('The extracted build does not contain index.html.');
}

console.log(`Prepared ${archive} in ${dist}`);
