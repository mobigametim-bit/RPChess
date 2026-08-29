const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = Object.freeze([
  'tests/travel-choice.cjs',
  'tests/resources.cjs',
  'tests/settlement.cjs',
  'tests/starvation.cjs',
  'tests/events.cjs',
  'tests/events-visual.cjs',
  'tests/puzzle-importer.cjs',
  'tests/puzzles.cjs'
]);

const requested = Number.parseInt(process.env.RPCHESS_TEST_CONCURRENCY || '2', 10);
const CONCURRENCY = Math.max(1, Math.min(TESTS.length, Number.isFinite(requested) ? requested : 2));

function runTest(relative) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [relative], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ relative, code: 1, duration: Date.now() - startedAt, stdout, stderr: `${stderr}${error.stack || error}` }));
    child.on('close', (code, signal) => resolve({ relative, code: code == null ? 1 : code, signal: signal || null, duration: Date.now() - startedAt, stdout, stderr }));
  });
}

(async () => {
  console.log(`RPChess deterministic Node suite shard: ${TESTS.length} programs, concurrency ${CONCURRENCY}`);
  const results = new Array(TESTS.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= TESTS.length) return;
      results[index] = await runTest(TESTS[index]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  let failed = false;
  for (const result of results) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    console.log(`\n--- ${result.relative} (${result.duration} ms) ---`);
    if (output) console.log(output);
    if (result.code !== 0) {
      failed = true;
      console.error(`FAIL: ${result.relative} exited ${result.code}${result.signal ? ` (${result.signal})` : ''}`);
    }
  }
  if (failed) process.exitCode = 1;
  else console.log(`\nRPChess deterministic Node suite shard: PASS (${TESTS.length}/${TESTS.length})`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
