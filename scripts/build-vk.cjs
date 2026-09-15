const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'dist');
const VK_DIST = path.join(ROOT, 'dist-vk');
const CONFIG = path.join(ROOT, 'vk-hosting-config.json');
const HOSTING_MEDIA = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.mp4', '.webm', '.mov']);

function requireFile(file, message) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(message || `Missing file: ${file}`);
}

function removeHostingMedia(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes:true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      removeHostingMedia(target);
      continue;
    }
    if (HOSTING_MEDIA.has(path.extname(entry.name).toLowerCase())) fs.unlinkSync(target);
  }
}

function assertRelativeRuntimePaths(root) {
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(target);
        continue;
      }
      if (!/\.(?:html|css)$/i.test(entry.name)) continue;
      const source = fs.readFileSync(target, 'utf8');
      if (/\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(source)) throw new Error(`VK build has a root-absolute HTML URL: ${path.relative(root, target)}`);
      if (/url\(\s*["']?\/(?!\/)/i.test(source)) throw new Error(`VK build has a root-absolute CSS URL: ${path.relative(root, target)}`);
    }
  };
  visit(root);
}

function main() {
  requireFile(path.join(WEB_DIST, 'index.html'), 'dist/index.html is missing. Run the canonical Web build first.');
  requireFile(CONFIG, 'vk-hosting-config.json is missing.');
  const hosting = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (hosting.static_path !== 'dist-vk') throw new Error('vk-hosting-config.json static_path must be dist-vk');
  if (!Number.isInteger(Number(hosting.app_id)) || Number(hosting.app_id) <= 0) throw new Error('vk-hosting-config.json app_id must be a positive integer');
  fs.rmSync(VK_DIST, { recursive:true, force:true });
  fs.cpSync(WEB_DIST, VK_DIST, { recursive:true });
  removeHostingMedia(VK_DIST);
  assertRelativeRuntimePaths(VK_DIST);
  fs.writeFileSync(path.join(VK_DIST, 'VK_BUILD_INFO.json'), `${JSON.stringify({ platform:'vk', app_id:Number(hosting.app_id), source:'canonical dist copy', hosting_media_externalized:true }, null, 2)}\n`);
  console.log(`Prepared VK Hosting build in ${VK_DIST}; app_id=${hosting.app_id}`);
}

main();
