const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(label, command, args) {
  console.log(`\n[cloudflare browser gate] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: '1' }
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`[cloudflare browser gate] ${label}: PASS`);
}

run('verify + deterministic tests + production build', npm, ['run', 'gate:local']);
run('install Playwright package', npm, ['install', '--no-save', '--package-lock=false', '--ignore-scripts', 'playwright@1.54.2']);
run('install Chromium', npx, ['playwright', 'install', 'chromium']);
run('real Chromium Foundation through Events', npm, ['run', 'test:browser']);

console.log('\nRPChess Cloudflare real-Chromium gate: PASS');
