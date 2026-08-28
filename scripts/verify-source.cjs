const fs = require('fs');
const path = require('path');

function fail(message) { throw new Error(`[reboot source verification] ${message}`); }
function read(root, relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }
function requireFile(root, relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) fail(`missing required file: ${relative}`);
  if (!fs.statSync(full).isFile()) fail(`required path is not a file: ${relative}`);
}
function requireTokens(source, tokens, label) {
  for (const token of tokens) if (!source.includes(token)) fail(`${label} contract missing: ${token}`);
}

module.exports = function verifySource(root) {
  const required = [
    'index.html', 'BUILD_INFO.json',
    'css/reboot-foundation.css', 'css/classic-chess.css', 'css/chess-ai-polish.css', 'css/roster.css',
    'css/skirmish.css', 'css/battle.css', 'css/travel-choice.css', 'css/resources.css', 'css/settlement.css', 'css/starvation.css',
    'js/reboot-foundation.mjs', 'js/reboot-audio.mjs', 'js/classic-chess-engine.mjs', 'js/classic-chess-app.mjs',
    'js/chess-ai-adapter.mjs', 'js/roster-data.mjs', 'js/run-persistence.mjs', 'js/roster-app.mjs',
    'js/skirmish-core.mjs', 'js/skirmish-app.mjs', 'js/battle-core.mjs', 'js/battle-app.mjs', 'js/battle-route.mjs',
    'js/travel-choice-core.mjs', 'js/travel-choice-app.mjs', 'js/resources-core.mjs', 'js/resources-app.mjs',
    'js/settlement-core.mjs', 'js/settlement-app.mjs', 'js/starvation-core.mjs', 'js/starvation-app.mjs',
    'fonts/BrahmsGotischCyr.otf',
    'generated_assets/title_wordmark.png', 'generated_assets/splash_poster.jpg', 'generated_assets/scene_battle.jpg',
    'generated_assets/node_battle.png', 'generated_assets/node_elite.png', 'generated_assets/node_shop.png', 'generated_assets/reward_gold.png',
    'music/echoes_iron_throne_01.mp3', 'music/echoes_iron_throne_02.mp3',
    'music/echoes_iron_throne_03.mp3', 'music/echoes_iron_throne_04.mp3',
    'assets/kings/oathkeeper/portrait.png', 'assets/kings/oathkeeper/piece.png',
    'assets/heroes/aldric_wall/portrait.png', 'assets/heroes/aldric_wall/piece_badge.png',
    'assets/heroes/mara_chain/portrait.png', 'assets/heroes/mara_chain/piece_badge.png',
    'assets/heroes/nemea_quill/portrait.png', 'assets/heroes/nemea_quill/piece_badge.png',
    'assets/heroes/brother_orell/portrait.png', 'assets/heroes/brother_orell/piece_badge.png',
    'assets/heroes/vael_hammer/portrait.png', 'assets/heroes/vael_hammer/piece_badge.png',
    'assets/heroes/lady_sorn/portrait.png', 'assets/heroes/lady_sorn/piece_badge.png',
    'assets/heroes/khulan_star/portrait.png', 'assets/heroes/khulan_star/piece_badge.png'
  ];
  for (const side of ['player', 'enemy']) {
    for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) required.push(`generated_assets/unit_${piece}_${side}.png`);
  }
  required.forEach((relative) => requireFile(root, relative));

  const info = JSON.parse(read(root, 'BUILD_INFO.json'));
  if (!String(info.version || '').startsWith('2.9.0-starvation')) fail(`unexpected Starvation version: ${info.version || 'missing'}`);
  if (info.active_feature_branch !== 'feature/starvation') fail(`unexpected active feature branch: ${info.active_feature_branch || 'missing'}`);

  const index = read(root, 'index.html');
  requireTokens(index, [
    'css/reboot-foundation.css', 'css/classic-chess.css', 'css/chess-ai-polish.css', 'css/roster.css', 'css/skirmish.css',
    'js/reboot-foundation.mjs', 'js/roster-app.mjs', 'js/classic-chess-app.mjs', 'js/skirmish-app.mjs',
    'data-game-setup-modal', 'data-ai-elo', 'data-roster-screen', 'data-continue-run', 'data-roster-list',
    'data-skirmish-screen', 'data-skirmish-start', 'data-skirmish-aftermath', 'data-aftermath-continue', 'ui-panel-safe'
  ], 'index.html');
  for (const forbidden of ['iron-marches-runtime.bundle.js', 'vertical-slice-app.mjs', 'ui-approved-campaign.mjs', 'explicit-run-setup.mjs', 'commander-selection-final.mjs']) {
    if (index.includes(forbidden)) fail(`index.html still references legacy runtime: ${forbidden}`);
  }

  const localRefs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of localRefs) {
    if (/^(?:https?:|data:|blob:)/i.test(ref)) continue;
    if (fs.existsSync(path.join(root, ref))) continue;
    const vendorBuiltLater = ref.startsWith('vendor/stockfish/') && !fs.existsSync(path.join(root, 'vendor'));
    if (!vendorBuiltLater) fail(`index.html references missing local file: ${ref}`);
  }

  const foundationCss = read(root, 'css/reboot-foundation.css');
  requireTokens(foundationCss, ['--ui-panel-safe-left', '--ui-panel-safe-right', '.ui-panel-safe', '.ui-panel-surface', '--ui-panel-border', '--ui-panel-bg'], 'global frameless panel');
  if (!/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss) || !/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss)) fail('global vertical scroll contract is missing');

  const engine = read(root, 'js/classic-chess-engine.mjs');
  requireTokens(engine, ['castling', 'enPassant', 'draw_50_move', 'draw_threefold', 'draw_insufficient', 'promotion_required', 'checkmate', 'stalemate'], 'Classic Chess engine');
  const chessApp = read(root, 'js/classic-chess-app.mjs');
  requireTokens(chessApp, ["from './classic-chess-engine.mjs'", "from './chess-ai-adapter.mjs'", 'maybeScheduleAI', 'PIECE_GLYPHS', 'sanNotation', 'renderMaterial'], 'Classic Chess app');
  const ai = read(root, 'js/chess-ai-adapter.mjs');
  requireTokens(ai, ['class ChessAIAdapter', 'UCI_LimitStrength', 'UCI_Elo', 'MultiPV', 'chooseMove', 'ELO_LEVELS'], 'Chess AI');

  const runtime = read(root, 'js/reboot-foundation.mjs');
  requireTokens(runtime, ["from './reboot-audio.mjs'", "import './battle-route.mjs'", "CustomEvent('rpchess:run-new')", "CustomEvent('rpchess:run-continue')"], 'Foundation runtime');

  const rosterData = read(root, 'js/roster-data.mjs');
  requireTokens(rosterData, ['king.oathkeeper', 'hero.aldric_wall', 'hero.mara_chain', 'hero.nemea_quill', 'hero.brother_orell', 'hero.vael_hammer', 'createStarterRoster'], 'Roster data');
  const persistence = read(root, 'js/run-persistence.mjs');
  requireTokens(persistence, ['rpchess.reboot.v1.run', 'createRun', 'readRun', 'writeRun', 'currentTravelChoices', 'activeTravelChoice', 'gold', 'supplies', 'resourceRewards', 'currentSettlement', 'isSettlementState'], 'run persistence');
  const rosterApp = read(root, 'js/roster-app.mjs');
  requireTokens(rosterApp, ['rpchess:run-new', 'rpchess:run-continue', 'rpchess:travel-open', 'selectedCharacterId', 'Вернуться в поселение'], 'Roster runtime');
  if (rosterApp.includes("CustomEvent('rpchess:skirmish-open'")) fail('Roster still bypasses Travel Choice and opens Skirmish directly');

  const skirmishCore = read(root, 'js/skirmish-core.mjs');
  requireTokens(skirmishCore, ['MAX_SKIRMISH_PIECES', 'MAX_SKIRMISH_POINTS', 'createBattlePlan', 'applyBattleOutcome', 'king_dead', 'RPChessTravelEncounterOverride'], 'Skirmish core');
  const skirmishApp = read(root, 'js/skirmish-app.mjs');
  requireTokens(skirmishApp, ['rpchess:skirmish-open', 'RPChessClassicChess', 'writeRun', 'finishBattle'], 'Skirmish runtime');

  const battleCore = read(root, 'js/battle-core.mjs');
  requireTokens(battleCore, ['BATTLE_PIECE_COUNT', 'BATTLE_ARMY_POINTS', 'STANDARD_FEN', 'createBattlePlan', 'applyBattleOutcome', 'participants', 'king_dead', 'RPChessTravelEncounterOverride'], 'Battle core');
  const battleApp = read(root, 'js/battle-app.mjs');
  requireTokens(battleApp, ['RPChessClassicChess', 'dataset.battleScreen', 'battleCount', 'lastBattle', 'finishBattle'], 'Battle runtime');
  const route = read(root, 'js/battle-route.mjs');
  requireTokens(route, ["import './resources-app.mjs'", "import './battle-app.mjs'", "import './settlement-app.mjs'", "import './starvation-app.mjs'", "import './travel-choice-app.mjs'"], 'shared route bootstrap');
  if (route.includes('dataRosterBattle') || route.includes('Начать битву')) fail('temporary direct Battle shortcut must remain removed');

  const travelCore = read(root, 'js/travel-choice-core.mjs');
  requireTokens(travelCore, ["Object.freeze(['skirmish', 'battle', 'settlement'])", 'TRAVEL_CHOICE_COUNT', 'FLAVOR_POOLS', 'createTravelChoices', 'isTravelChoice'], 'Travel Choice core');
  const travelApp = read(root, 'js/travel-choice-app.mjs');
  requireTokens(travelApp, ['dataset.travelChoiceScreen', 'rpchess:skirmish-open', 'rpchess:battle-open', 'rpchess:settlement-open', 'currentTravelChoices', 'activeTravelChoice', 'applyTravelSupplyCost', 'supplyPaid', 'resolveStarvation', 'hasPendingStarvation', 'СЛУЧАЙНЫЙ БОЕЦ ПОГИБНЕТ', 'БЕЗОПАСНОЕ МЕСТО'], 'Travel Choice runtime');
  if (travelApp.includes('Отправиться')) fail('Travel Choice must select immediately on card click without a second CTA');
  const travelCss = read(root, 'css/travel-choice.css');
  requireTokens(travelCss, ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.travel-choice-card', '.travel-choice-card__safe', '.travel-choice-card--settlement'], 'Travel Choice CSS');

  const resourcesCore = read(root, 'js/resources-core.mjs');
  requireTokens(resourcesCore, ['STARTING_GOLD', 'STARTING_SUPPLIES', 'TRAVEL_SUPPLY_COST', 'hydrateResources', 'applyTravelSupplyCost', 'combatGoldReward', 'applyGoldReward'], 'Resources core');
  const resourcesApp = read(root, 'js/resources-app.mjs');
  requireTokens(resourcesApp, ['dataset.resourceHud', 'resourceRewards', 'settleCombatRewards', 'renderCombatReward'], 'Resources runtime');

  const settlementCore = read(root, 'js/settlement-core.mjs');
  requireTokens(settlementCore, ['SETTLEMENT_OFFER_COUNT', 'SETTLEMENT_SUPPLY_PRICE', 'SETTLEMENT_SUPPLY_STOCK', 'HEAL_COSTS', 'RECRUIT_COSTS', 'RECRUIT_LIBRARY', 'deterministicRecruitOffers', 'createSettlementState', 'applyHealing', 'applyRecruitment', 'applySupplyPurchase', 'completeSettlement'], 'Settlement core');
  const settlementApp = read(root, 'js/settlement-app.mjs');
  requireTokens(settlementApp, ['dataset.settlementScreen', 'rpchess:settlement-open', 'ЗНАХАРКА', 'ТАВЕРНА', 'СНАБЖЕНИЕ', 'data-settlement-roster', 'data-settlement-continue', 'Продолжить путь'], 'Settlement runtime');
  const settlementCss = read(root, 'css/settlement.css');
  requireTokens(settlementCss, ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.settlement-services', '.settlement-recruits', '@media(max-width:760px)'], 'Settlement CSS');

  const starvationCore = read(root, 'js/starvation-core.mjs');
  requireTokens(starvationCore, ['livingStarvationCandidates', 'deterministicStarvationVictim', 'resolveStarvation', 'hasPendingStarvation', 'acknowledgeStarvation', 'starvation_king'], 'Starvation core');
  const starvationApp = read(root, 'js/starvation-app.mjs');
  requireTokens(starvationApp, ['dataset.starvationScreen', 'КОРОЛЬ ПОГИБ ОТ ГОЛОДА', 'data-starvation-continue', 'rpchess:starvation-continue', 'RPChessStarvation'], 'Starvation runtime');
  const starvationCss = read(root, 'css/starvation.css');
  requireTokens(starvationCss, ['var(--ui-panel-border)', 'var(--ui-panel-bg)', '.starvation-panel', '@media (max-width: 520px)'], 'Starvation CSS');

  for (const cssPath of ['css/roster.css', 'css/skirmish.css', 'css/battle.css', 'css/travel-choice.css', 'css/resources.css', 'css/settlement.css', 'css/starvation.css']) {
    const css = read(root, cssPath);
    if (css.includes('ui_panel_frame.png') || css.includes('ui_panel_wide.png')) fail(`${cssPath} violates the frameless panel invariant`);
  }
};
