const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const approvedSlices = Object.freeze({
  ashen_dominion: [2, 8, 10, 11, 12, 14, 15, 16],
  free_cities: [5, 9, 11, 13],
  iron_marches: [2, 5, 6, 9, 10, 13, 14],
  mirror_conclave: [3, 5, 11, 15],
  sky_khanate: [2, 3, 5, 8, 10, 12],
  verdant_exiles: [5, 7]
});
for (const [region, approved] of Object.entries(approvedSlices)) {
  const source = path.join(root, 'game/assets/regions', region, 'environment_sheet.png');
  if (!fs.existsSync(source)) throw new Error(`Missing environment sheet: ${source}`);
  const target = path.join(root, 'game/assets/boards/obstacles', region);
  fs.mkdirSync(target, { recursive: true });
  for (const index of approved) {
    const row = Math.floor((index - 1) / 4), column = (index - 1) % 4;
    const output = path.join(target, `obstacle_${String(index).padStart(2, '0')}.png`);
    childProcess.execFileSync('convert', [source, '-crop', `512x512+${column * 512}+${row * 512}`, '+repage', '-resize', '256x256', output], { stdio: 'inherit' });
  }
}
console.log('Skirmish obstacles: 31 audited transparent regional props sliced.');
