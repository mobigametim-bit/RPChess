const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const STOCKFISH_VERSION = '18.0.0';
const BASE = `https://github.com/nmrugg/stockfish.js/releases/download/v${STOCKFISH_VERSION}`;
const ASSETS = Object.freeze([
  {
    name: 'stockfish-18-lite-single.js',
    url: `${BASE}/stockfish-18-lite-single.js`,
    sha256: '2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe'
  },
  {
    name: 'stockfish-18-lite-single.wasm',
    url: `${BASE}/stockfish-18-lite-single.wasm`,
    sha256: 'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1'
  }
]);

const LICENSE_URL = `https://raw.githubusercontent.com/nmrugg/stockfish.js/v${STOCKFISH_VERSION}/Copying.txt`;
const LICENSE_GIT_BLOB_SHA1 = '818433ecc0e094a4db1023c68b33f24344643ad8';

function requestBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error(`too many redirects while downloading ${url}`));
    https.get(url, {
      headers: {
        'User-Agent': 'RPChess-build/2.x',
        Accept: '*/*'
      }
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        return resolve(requestBuffer(new URL(response.headers.location, url).toString(), redirects + 1));
      }
      if (status < 200 || status >= 300) {
        response.resume();
        return reject(new Error(`download failed ${status}: ${url}`));
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function gitBlobSha1(buffer) {
  const prefix = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(prefix).update(buffer).digest('hex');
}

async function prepareStockfishAssets(distRoot) {
  const target = path.join(distRoot, 'vendor', 'stockfish');
  fs.mkdirSync(target, { recursive: true });

  for (const asset of ASSETS) {
    const bytes = await requestBuffer(asset.url);
    const digest = sha256(bytes);
    if (digest !== asset.sha256) throw new Error(`Stockfish integrity mismatch for ${asset.name}: ${digest}`);
    fs.writeFileSync(path.join(target, asset.name), bytes);
  }

  const license = await requestBuffer(LICENSE_URL);
  const licenseBlob = gitBlobSha1(license);
  if (licenseBlob !== LICENSE_GIT_BLOB_SHA1) throw new Error(`Stockfish license integrity mismatch: ${licenseBlob}`);
  fs.writeFileSync(path.join(target, 'COPYING.txt'), license);
  fs.writeFileSync(path.join(target, 'SOURCE.txt'), [
    'Stockfish.js / Stockfish 18',
    `Version: ${STOCKFISH_VERSION}`,
    `Corresponding source: https://github.com/nmrugg/stockfish.js/tree/v${STOCKFISH_VERSION}`,
    'License: GNU GPL v3 (see COPYING.txt)',
    '',
    'RPChess distributes the unmodified Stockfish.js lite single-threaded browser build as a separate Web Worker/WASM engine.',
    ...ASSETS.map((asset) => `${asset.name} sha256 ${asset.sha256}`),
    ''
  ].join('\n'));

  return {
    version: STOCKFISH_VERSION,
    directory: target,
    files: [...ASSETS.map((asset) => asset.name), 'COPYING.txt', 'SOURCE.txt']
  };
}

module.exports = { ASSETS, STOCKFISH_VERSION, prepareStockfishAssets, requestBuffer, sha256 };
