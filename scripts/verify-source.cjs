const fs = require('fs');
const path = require('path');

function fail(message) {
  throw new Error(`[reboot source verification] ${message}`);
}

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

module.exports = function verifySource(root) {
  const required = [
    'index.html',
    'BUILD_INFO.json',
    'css/reboot-foundation.css',
    'js/reboot-foundation.mjs',
    'fonts/BrahmsGotischCyr.otf',
    'generated_assets/logo_main.png',
    'generated_assets/title_wordmark.png',
    'generated_assets/splash_poster.jpg',
    'generated_assets/scene_campaign.jpg'
  ];

  for (const relative of required) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) fail(`missing required file: ${relative}`);
    if (!fs.statSync(full).isFile()) fail(`required path is not a file: ${relative}`);
  }

  const info = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_INFO.json'), 'utf8'));
  if (!String(info.version || '').startsWith('2.0.0-foundation')) {
    fail(`unexpected reboot version: ${info.version || 'missing'}`);
  }

  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!index.includes('css/reboot-foundation.css') || !index.includes('js/reboot-foundation.mjs')) {
    fail('index.html does not launch the Reboot Foundation shell');
  }

  const forbiddenEntryRefs = [
    'iron-marches-runtime.bundle.js',
    'vertical-slice-app.mjs',
    'ui-approved-campaign.mjs',
    'b10-b13-production-ui.mjs',
    'explicit-run-setup.mjs',
    'commander-selection-final.mjs'
  ];
  for (const forbidden of forbiddenEntryRefs) {
    if (index.includes(forbidden)) fail(`index.html still references legacy runtime: ${forbidden}`);
  }

  const localRefs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of localRefs) {
    if (/^(?:https?:|data:|blob:)/i.test(ref)) continue;
    if (!fs.existsSync(path.join(root, ref))) fail(`index.html references missing local file: ${ref}`);
  }

  const css = fs.readFileSync(path.join(root, 'css/reboot-foundation.css'), 'utf8');
  if (!/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(css) || !/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(css)) {
    fail('global vertical scroll contract is missing');
  }

  const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md']);
  const forbiddenNetworkDependencies = [
    'drive.google.com/uc?export=download',
    'drive.google.com/file/d/',
    'supabase.co/functions/',
    'http://127.0.0.1',
    'http://localhost'
  ];

  for (const file of walk(root)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenNetworkDependencies) {
      if (text.includes(forbidden)) {
        fail(`release source contains network dependency '${forbidden}' in ${path.relative(root, file)}`);
      }
    }
  }

  console.log(`[reboot source verification] ${path.relative(process.cwd(), root) || '.'}: ${walk(root).length} files, build ${info.version}`);
  return true;
};
