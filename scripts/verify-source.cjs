const fs = require('fs');
const path = require('path');

function fail(message) { throw new Error(`[reboot source verification] ${message}`); }
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
    'index.html', 'BUILD_INFO.json',
    'css/reboot-foundation.css', 'css/classic-chess.css', 'css/chess-ai-polish.css', 'css/roster.css', 'css/skirmish.css', 'css/battle.css', 'css/travel-choice.css', 'css/resources.css',
    'js/reboot-foundation.mjs', 'js/reboot-audio.mjs',
    'js/classic-chess-engine.mjs', 'js/classic-chess-app.mjs', 'js/chess-ai-adapter.mjs',
    'js/roster-data.mjs', 'js/run-persistence.mjs', 'js/roster-app.mjs',
    'js/skirmish-core.mjs', 'js/skirmish-app.mjs',
    'js/battle-core.mjs', 'js/battle-app.mjs', 'js/battle-route.mjs',
    'js/travel-choice-core.mjs', 'js/travel-choice-app.mjs',
    'js/resources-core.mjs', 'js/resources-app.mjs',
    'fonts/BrahmsGotischCyr.otf',
    'generated_assets/title_wordmark.png', 'generated_assets/splash_poster.jpg', 'generated_assets/scene_battle.jpg',
    'generated_assets/node_battle.png', 'generated_assets/node_elite.png', 'generated_assets/reward_gold.png',
    'music/echoes_iron_throne_01.mp3', 'music/echoes_iron_throne_02.mp3',
    'music/echoes_iron_throne_03.mp3', 'music/echoes_iron_throne_04.mp3',
    'assets/kings/oathkeeper/portrait.png', 'assets/kings/oathkeeper/piece.png',
    'assets/heroes/aldric_wall/portrait.png', 'assets/heroes/aldric_wall/piece_badge.png',
    'assets/heroes/mara_chain/portrait.png', 'assets/heroes/mara_chain/piece_badge.png',
    'assets/heroes/nemea_quill/portrait.png', 'assets/heroes/nemea_quill/piece_badge.png',
    'assets/heroes/brother_orell/portrait.png', 'assets/heroes/brother_orell/piece_badge.png',
    'assets/heroes/vael_hammer/portrait.png', 'assets/heroes/vael_hammer/piece_badge.png'
  ];
  for (const side of ['player', 'enemy']) {
    for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) required.push(`generated_assets/unit_${piece}_${side}.png`);
  }

  for (const relative of required) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) fail(`missing required file: ${relative}`);
    if (!fs.statSync(full).isFile()) fail(`required path is not a file: ${relative}`);
  }

  const info = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_INFO.json'), 'utf8'));
  if (!String(info.version || '').startsWith('2.7.0-resources')) fail(`unexpected Resources version: ${info.version || 'missing'}`);

  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const requiredRef of [
    'css/reboot-foundation.css', 'css/classic-chess.css', 'css/chess-ai-polish.css', 'css/roster.css', 'css/skirmish.css',
    'js/reboot-foundation.mjs', 'js/roster-app.mjs', 'js/classic-chess-app.mjs', 'js/skirmish-app.mjs',
    'data-game-setup-modal', 'data-ai-elo', 'data-captured-by-white', 'data-captured-by-black',
    'data-roster-screen', 'data-continue-run', 'data-roster-detail', 'data-roster-list', 'data-roster-filter="dead"',
    'data-skirmish-screen', 'data-skirmish-available', 'data-skirmish-selected', 'data-skirmish-piece-count', 'data-skirmish-point-count',
    'data-skirmish-start', 'data-skirmish-aftermath', 'data-aftermath-result', 'data-aftermath-continue',
    'ui-panel-safe'
  ]) if (!index.includes(requiredRef)) fail(`index.html is missing active Reboot reference: ${requiredRef}`);

  for (const forbidden of ['iron-marches-runtime.bundle.js', 'vertical-slice-app.mjs', 'ui-approved-campaign.mjs', 'b10-b13-production-ui.mjs', 'explicit-run-setup.mjs', 'commander-selection-final.mjs']) {
    if (index.includes(forbidden)) fail(`index.html still references legacy runtime: ${forbidden}`);
  }

  const localRefs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of localRefs) {
    if (/^(?:https?:|data:|blob:)/i.test(ref)) continue;
    const target = path.join(root, ref);
    if (!fs.existsSync(target)) {
      const isBuildVendorRef = ref.startsWith('vendor/stockfish/') && !fs.existsSync(path.join(root, 'vendor'));
      if (!isBuildVendorRef) fail(`index.html references missing local file: ${ref}`);
    }
  }

  const foundationCss = fs.readFileSync(path.join(root, 'css/reboot-foundation.css'), 'utf8');
  if (!/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss) || !/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss)) fail('global vertical scroll contract is missing');
  for (const contract of ['--ui-panel-safe-left', '--ui-panel-safe-right', '.ui-panel-safe', '.ui-panel-surface', '--ui-panel-border', '--ui-panel-bg']) {
    if (!foundationCss.includes(contract)) fail(`global frameless panel contract missing: ${contract}`);
  }

  const engine = fs.readFileSync(path.join(root, 'js/classic-chess-engine.mjs'), 'utf8');
  for (const contract of ['castling', 'enPassant', 'draw_50_move', 'draw_threefold', 'draw_insufficient', 'promotion_required', 'checkmate', 'stalemate']) {
    if (!engine.includes(contract)) fail(`Classic Chess engine contract missing: ${contract}`);
  }
  const app = fs.readFileSync(path.join(root, 'js/classic-chess-app.mjs'), 'utf8');
  if (!app.includes("from './classic-chess-engine.mjs'")) fail('Classic Chess UI does not import the standalone engine');
  if (!app.includes("from './chess-ai-adapter.mjs'")) fail('Classic Chess UI does not import the AI adapter boundary');
  if (!app.includes('unit_${PIECE_ASSETS[piece.type]}_')) fail('Classic Chess UI does not use production piece assets');
  for (const aiContract of ['maybeScheduleAI', 'aiThinking', 'data-game-setup-modal', 'Stockfish 18 lite']) {
    if (!app.includes(aiContract) && !index.includes(aiContract)) fail(`Chess AI UI contract missing: ${aiContract}`);
  }
  for (const polishContract of ['sanNotation', 'classic-piece-marker', 'renderMaterial', 'animateCommittedMove', 'PIECE_GLYPHS']) {
    if (!app.includes(polishContract)) fail(`Chess AI polish runtime contract missing: ${polishContract}`);
  }

  const polishCss = fs.readFileSync(path.join(root, 'css/chess-ai-polish.css'), 'utf8');
  for (const polishContract of ['ui_button_primary.png', '.classic-piece-marker', '.classic-san-figurine', '.classic-captured-piece', '.classic-piece-flyer', '.classic-thinking', 'var(--ui-panel-border)', 'var(--ui-panel-bg)']) {
    if (!polishCss.includes(polishContract)) fail(`Chess AI polish CSS contract missing: ${polishContract}`);
  }

  const adapter = fs.readFileSync(path.join(root, 'js/chess-ai-adapter.mjs'), 'utf8');
  for (const aiContract of ['class ChessAIAdapter', 'UCI_LimitStrength', 'UCI_Elo', 'MultiPV', 'chooseMove', 'ELO_LEVELS']) {
    if (!adapter.includes(aiContract)) fail(`Chess AI adapter contract missing: ${aiContract}`);
  }

  const runtime = fs.readFileSync(path.join(root, 'js/reboot-foundation.mjs'), 'utf8');
  if (!runtime.includes("from './reboot-audio.mjs'")) fail('Reboot runtime does not load audio');
  if (!runtime.includes("import './battle-route.mjs'")) fail('Reboot runtime does not load Battle/Travel route bootstrap');
  if (!runtime.includes("CustomEvent('rpchess:run-new')")) fail('main New Game is not routed into new-run Roster flow');
  if (!runtime.includes("CustomEvent('rpchess:run-continue')")) fail('Continue is not routed into persistent Roster flow');

  const rosterData = fs.readFileSync(path.join(root, 'js/roster-data.mjs'), 'utf8');
  const persistence = fs.readFileSync(path.join(root, 'js/run-persistence.mjs'), 'utf8');
  const rosterApp = fs.readFileSync(path.join(root, 'js/roster-app.mjs'), 'utf8');
  const rosterCss = fs.readFileSync(path.join(root, 'css/roster.css'), 'utf8');
  for (const contract of ['king.oathkeeper', 'hero.aldric_wall', 'hero.mara_chain', 'hero.nemea_quill', 'hero.brother_orell', 'hero.vael_hammer', 'createStarterRoster']) {
    if (!rosterData.includes(contract)) fail(`Roster data contract missing: ${contract}`);
  }
  for (const contract of ['rpchess.reboot.v1.run', 'createRun', 'readRun', 'writeRun', 'schemaVersion', 'skirmishCount', 'lastSkirmish', 'battleCount', 'lastBattle', 'journeyStep', 'currentTravelChoices', 'activeTravelChoice', 'ended', 'gold', 'supplies', 'resourceRewards']) {
    if (!persistence.includes(contract)) fail(`run persistence contract missing: ${contract}`);
  }
  for (const contract of ['rpchess:run-new', 'rpchess:run-continue', 'rpchess:travel-open', 'dataset.rosterCard', 'selectedCharacterId', '[data-roster-filter]']) {
    if (!rosterApp.includes(contract)) fail(`Roster runtime contract missing: ${contract}`);
  }
  if (rosterApp.includes("CustomEvent('rpchess:skirmish-open'")) fail('Roster still bypasses Travel Choice and opens Skirmish directly');
  for (const contract of ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.roster-card', '.roster-detail', '.roster-grid']) {
    if (!rosterCss.includes(contract)) fail(`Roster CSS contract missing: ${contract}`);
  }

  const skirmishCore = fs.readFileSync(path.join(root, 'js/skirmish-core.mjs'), 'utf8');
  const skirmishApp = fs.readFileSync(path.join(root, 'js/skirmish-app.mjs'), 'utf8');
  const skirmishCss = fs.readFileSync(path.join(root, 'css/skirmish.css'), 'utf8');
  for (const contract of ['MAX_SKIRMISH_PIECES', 'MAX_SKIRMISH_POINTS', 'defaultCombatSelection', 'validateSelection', 'generateEnemyArmy', 'createBattlePlan', 'applyBattleOutcome', 'king_dead', 'RPChessTravelEncounterOverride']) {
    if (!skirmishCore.includes(contract)) fail(`Skirmish core contract missing: ${contract}`);
  }
  for (const contract of ['rpchess:skirmish-open', 'MutationObserver', 'RPChessClassicChess', 'writeRun', 'data-skirmish-start', 'finishBattle']) {
    if (!skirmishApp.includes(contract)) fail(`Skirmish runtime contract missing: ${contract}`);
  }
  for (const contract of ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.skirmish-card', '.skirmish-actionbar', '.skirmish-aftermath-panel']) {
    if (!skirmishCss.includes(contract)) fail(`Skirmish CSS contract missing: ${contract}`);
  }

  const battleCore = fs.readFileSync(path.join(root, 'js/battle-core.mjs'), 'utf8');
  const battleApp = fs.readFileSync(path.join(root, 'js/battle-app.mjs'), 'utf8');
  const battleRoute = fs.readFileSync(path.join(root, 'js/battle-route.mjs'), 'utf8');
  const battleCss = fs.readFileSync(path.join(root, 'css/battle.css'), 'utf8');
  for (const contract of ['BATTLE_PIECE_COUNT', 'BATTLE_ARMY_POINTS', 'STANDARD_FEN', 'SLOT_CAPACITY', 'defaultBattleSelection', 'validateBattleSelection', 'formationFor', 'createBattlePlan', 'applyBattleOutcome', 'participants', 'king_dead', 'RPChessTravelEncounterOverride']) {
    if (!battleCore.includes(contract)) fail(`Battle core contract missing: ${contract}`);
  }
  for (const contract of ['RPChessClassicChess', 'dataset.battleScreen', 'data-battle-start', 'dataset.battleAftermath', 'dataset.battleRunEnd', 'battleCount', 'lastBattle', 'finishBattle', 'MutationObserver']) {
    if (!battleApp.includes(contract)) fail(`Battle runtime contract missing: ${contract}`);
  }
  for (const contract of ["import './resources-app.mjs'", "import './battle-app.mjs'", "import './travel-choice-app.mjs'", 'travel-choice.css']) {
    if (!battleRoute.includes(contract)) fail(`Battle/Travel/Resources route bootstrap contract missing: ${contract}`);
  }
  if (battleRoute.includes('dataRosterBattle') || battleRoute.includes('Начать битву')) fail('temporary direct Battle shortcut must be removed after Travel Choice integration');
  for (const contract of ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.battle-card', '.battle-actionbar', '.battle-aftermath-panel', '@media(max-width:900px)']) {
    if (!battleCss.includes(contract)) fail(`Battle CSS contract missing: ${contract}`);
  }

  const travelCore = fs.readFileSync(path.join(root, 'js/travel-choice-core.mjs'), 'utf8');
  const travelApp = fs.readFileSync(path.join(root, 'js/travel-choice-app.mjs'), 'utf8');
  const travelCss = fs.readFileSync(path.join(root, 'css/travel-choice.css'), 'utf8');
  for (const contract of ['TRAVEL_CHOICE_COUNT', 'PLAYABLE_TRAVEL_TYPES', 'FLAVOR_POOLS', 'createTravelChoices', 'isTravelChoice', 'skirmish', 'battle', 'event', 'settlement', 'puzzle']) {
    if (!travelCore.includes(contract)) fail(`Travel Choice core contract missing: ${contract}`);
  }
  for (const contract of ['dataset.travelChoiceScreen', 'data-travel-choice', 'rpchess:travel-open', 'rpchess:skirmish-open', 'rpchess:battle-open', 'currentTravelChoices', 'activeTravelChoice', 'RPChessTravelEncounterOverride', 'Продолжить путь', 'applyTravelSupplyCost', 'supplyPaid', 'СТОИМОСТЬ ПУТИ']) {
    if (!travelApp.includes(contract)) fail(`Travel Choice runtime contract missing: ${contract}`);
  }
  if (travelApp.includes('Отправиться')) fail('Travel Choice must select immediately on card click without a second CTA');
  for (const contract of ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.travel-choice-card', '.travel-choice-routes', '@media(max-width:900px)']) {
    if (!travelCss.includes(contract)) fail(`Travel Choice CSS contract missing: ${contract}`);
  }

  const resourcesCore = fs.readFileSync(path.join(root, 'js/resources-core.mjs'), 'utf8');
  const resourcesApp = fs.readFileSync(path.join(root, 'js/resources-app.mjs'), 'utf8');
  const resourcesCss = fs.readFileSync(path.join(root, 'css/resources.css'), 'utf8');
  for (const contract of ['STARTING_GOLD', 'STARTING_SUPPLIES', 'TRAVEL_SUPPLY_COST', 'hydrateResources', 'applyTravelSupplyCost', 'combatGoldReward', 'applyGoldReward']) {
    if (!resourcesCore.includes(contract)) fail(`Resources core contract missing: ${contract}`);
  }
  for (const contract of ['dataset.resourceHud', 'data-resource-gold', 'data-resource-supplies', 'resourceRewards', 'goldReward', 'settleCombatRewards', 'renderCombatReward', 'rpchess:resources-updated']) {
    if (!resourcesApp.includes(contract)) fail(`Resources runtime contract missing: ${contract}`);
  }
  for (const contract of ['.resource-hud', '.resource-chip', '.resource-combat-reward', '.travel-choice-card__cost', '@media (max-width: 700px)']) {
    if (!resourcesCss.includes(contract)) fail(`Resources CSS contract missing: ${contract}`);
  }

  for (const [name, source] of [
    ['foundation', foundationCss],
    ['classic', fs.readFileSync(path.join(root, 'css/classic-chess.css'), 'utf8')],
    ['polish', polishCss],
    ['roster', rosterCss],
    ['skirmish', skirmishCss],
    ['battle', battleCss],
    ['travel', travelCss],
    ['resources', resourcesCss]
  ]) {
    if (source.includes('ui_panel_frame.png') || source.includes('ui_panel_wide.png')) fail(`${name} CSS still uses forbidden ornate panel frame assets`);
  }

  if (fs.existsSync(path.join(root, 'vendor', 'stockfish'))) {
    for (const relative of [
      'vendor/stockfish/stockfish-18-lite-single.js',
      'vendor/stockfish/stockfish-18-lite-single.wasm',
      'vendor/stockfish/COPYING.txt',
      'vendor/stockfish/SOURCE.txt'
    ]) if (!fs.existsSync(path.join(root, relative))) fail(`Stockfish distribution file missing: ${relative}`);
  }

  const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt']);
  const forbiddenNetworkDependencies = ['drive.google.com/uc?export=download', 'drive.google.com/file/d/', 'supabase.co/functions/', 'http://127.0.0.1', 'http://localhost'];
  for (const file of walk(root)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenNetworkDependencies) if (text.includes(forbidden)) fail(`release source contains network dependency '${forbidden}' in ${path.relative(root, file)}`);
  }

  console.log(`[reboot source verification] ${path.relative(process.cwd(), root) || '.'}: ${walk(root).length} files, build ${info.version}`);
  return true;
};
