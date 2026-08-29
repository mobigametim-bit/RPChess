const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const stage = String(process.argv[2] || '').trim();

function run(label, command, args) {
  console.log(`\n[browser probe] ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (result.error) { console.error(result.error); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`[browser probe] ${label}: PASS`);
}

function placeholder(label) {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html><meta charset="utf-8"><title>${label} PASS</title><pre>${label}: PASS</pre>`);
}

if (!['package','chromium','smoke','full'].includes(stage)) {
  console.error(`Unknown browser probe stage: ${stage}`);
  process.exit(2);
}

run('install Playwright package', npm, ['install', '--no-save', '--package-lock=false', '--ignore-scripts', 'playwright@1.54.2']);
if (stage === 'package') { placeholder('playwright-package'); process.exit(0); }

run('install Chromium binary', npx, ['playwright', 'install', 'chromium']);
if (stage === 'chromium') { placeholder('chromium-install'); process.exit(0); }

run('launch Chromium smoke', nodePath(), ['-e', "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({headless:true});const p=await b.newPage();await p.setContent('<title>ok</title>');await b.close();console.log('chromium smoke PASS')})().catch(e=>{console.error(e);process.exit(1)})"]);
if (stage === 'smoke') { placeholder('chromium-smoke'); process.exit(0); }

run('strict local gate', npm, ['run', 'gate:local']);
run('full real Chromium regression', npm, ['run', 'test:browser']);
console.log('\n[browser probe] full: PASS');

function nodePath() { return process.execPath; }
