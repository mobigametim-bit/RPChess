const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const regions = ['ashen_dominion', 'free_cities', 'iron_marches', 'luminous_synod', 'mirror_conclave', 'sky_khanate', 'thorn_covenant', 'verdant_exiles'];
for (const region of regions) {
  const source = path.join(root, 'game/assets/regions', region, 'environment_sheet.png');
  if (!fs.existsSync(source)) throw new Error(`Missing environment sheet: ${source}`);
  const target = path.join(root, 'game/assets/boards/obstacles', region);
  fs.mkdirSync(target, { recursive: true });
  for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) {
    const index = row * 4 + column + 1;
    const output = path.join(target, `obstacle_${String(index).padStart(2, '0')}.png`);
    childProcess.execFileSync('convert', [source, '-crop', `512x512+${column * 512}+${row * 512}`, '+repage', '-resize', '256x256', output], { stdio: 'inherit' });
  }
}
console.log('Skirmish obstacles: 128 transparent regional props sliced.');
