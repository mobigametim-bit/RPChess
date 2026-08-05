'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content, 'utf8');
}

function replaceOnce(content, needle, replacement, label) {
  const index = content.indexOf(needle);
  if (index < 0) throw new Error(`${label}: patch needle not found`);
  if (content.indexOf(needle, index + needle.length) >= 0) throw new Error(`${label}: patch needle is ambiguous`);
  return content.slice(0, index) + replacement + content.slice(index + needle.length);
}

function replaceRange(content, startNeedle, endNeedle, replacement, label) {
  const start = content.indexOf(startNeedle);
  if (start < 0) throw new Error(`${label}: start needle not found`);
  const end = content.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) throw new Error(`${label}: end needle not found`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function patchPresenterBridge() {
  const file = 'src/runtime/presenter-bridge.cjs';
  let source = read(file);
  const helpers = `function orderPoolSnapshot(pool) {
  return Object.freeze({
    current: Number.isInteger(pool?.current) ? pool.current : 0,
    max: Number.isInteger(pool?.max) ? pool.max : 0
  });
}

function reserveSnapshot(battle, legalCommands, localization) {
  const legalSquaresByEntry = new Map();
  for (const command of legalCommands) {
    if (command.type !== 'DeployReserve') continue;
    const entryId = command.payload.entryId;
    if (!legalSquaresByEntry.has(entryId)) legalSquaresByEntry.set(entryId, []);
    legalSquaresByEntry.get(entryId).push(command.payload.square);
  }
  return freezeArray((battle.reserve || []).map((entry) => {
    const metadata = entry.metadata || {};
    const legalSquares = [...new Set(legalSquaresByEntry.get(entry.id) || [])].sort();
    const pool = battle.orderPoints?.[entry.side];
    return Object.freeze({
      id: entry.id,
      entryId: entry.id,
      side: entry.side,
      type: entry.type,
      orderCost: entry.orderCost,
      heroId: metadata.heroId || null,
      nameKey: metadata.nameKey || null,
      label: localizationValue(localization, metadata.nameKey, metadata.heroId || entry.id),
      affordable: Boolean(pool && pool.current >= entry.orderCost),
      activeTurn: battle.position.sideToMove === entry.side,
      legalSquares: freezeArray(legalSquares)
    });
  }));
}

`;
  source = replaceOnce(source, 'function scenarioSnapshot(state, dependencies = {}) {', `${helpers}function scenarioSnapshot(state, dependencies = {}) {`, 'presenter bridge helpers');
  source = replaceOnce(
    source,
    '  const localization = dependencies.localization || null;\n  const pieces = Object.entries(battle.identities.bySquare)',
    `  const localization = dependencies.localization || null;
  const reserve = reserveSnapshot(battle, legalCommands, localization);
  const opponentSide = state.playerSide === 'w' ? 'b' : 'w';
  const orderPoints = Object.freeze({
    w: orderPoolSnapshot(battle.orderPoints?.w),
    b: orderPoolSnapshot(battle.orderPoints?.b),
    player: Object.freeze({ side: state.playerSide, ...orderPoolSnapshot(battle.orderPoints?.[state.playerSide]) }),
    opponent: Object.freeze({ side: opponentSide, ...orderPoolSnapshot(battle.orderPoints?.[opponentSide]) })
  });
  const reserveCells = Object.freeze({
    w: freezeArray(battle.reserveCells?.w || []),
    b: freezeArray(battle.reserveCells?.b || [])
  });
  const pieces = Object.entries(battle.identities.bySquare)`,
    'presenter bridge reserve projection'
  );
  source = replaceOnce(
    source,
    '    legalCommands: freezeArray(legalCommands),\n    objectives: freezeArray(objectives),',
    `    legalCommands: freezeArray(legalCommands),
    orderPoints,
    reserve,
    reserveCells,
    objectives: freezeArray(objectives),`,
    'presenter bridge scenario payload'
  );
  write(file, source);
}

function patchBrowserPresenter() {
  const file = 'game/js/vertical-slice-presenter.mjs';
  let source = read(file);
  source = replaceOnce(
    source,
    'function sceneStyle(source, extra = \'\') {',
    `function reserveTargets(scenario, selectedReserveEntryId) {
  if (!scenario || !selectedReserveEntryId) return new Map();
  const targets = new Map();
  for (const command of scenario.legalCommands || []) {
    if (command.type === 'DeployReserve' && command.payload.entryId === selectedReserveEntryId) {
      targets.set(command.payload.square, command);
    }
  }
  return targets;
}

function sceneStyle(source, extra = '') {`,
    'browser reserve target helper'
  );
  source = replaceOnce(
    source,
    '    .rpvs__commands{display:grid;gap:7px;max-height:320px;overflow:auto}.rpvs__action,.rpvs__choice{padding:10px 12px;border:1px solid #6b7d99;border-radius:9px;background:rgba(24,38,58,.94);color:#f4ead6;cursor:pointer;text-align:left}.rpvs__action:hover,.rpvs__choice:hover{border-color:#79c9ff}.rpvs__primary{width:100%;padding:13px;border:1px solid #d2ab52;border-radius:10px;background:linear-gradient(#6b5220,#47340f);color:#fff2c7;font-weight:700;cursor:pointer}\n',
    `    .rpvs__commands{display:grid;gap:7px;max-height:320px;overflow:auto}.rpvs__action,.rpvs__choice{padding:10px 12px;border:1px solid #6b7d99;border-radius:9px;background:rgba(24,38,58,.94);color:#f4ead6;cursor:pointer;text-align:left}.rpvs__action:hover,.rpvs__choice:hover{border-color:#79c9ff}.rpvs__primary{width:100%;padding:13px;border:1px solid #d2ab52;border-radius:10px;background:linear-gradient(#6b5220,#47340f);color:#fff2c7;font-weight:700;cursor:pointer}
    .rpvs__order{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:9px 11px;border:1px solid #8d7745;border-radius:10px;background:#111d30}.rpvs__order strong{color:#f2cf76;font-size:20px}.rpvs__reserve{display:grid;gap:8px}.rpvs__reserve-card{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;width:100%;padding:9px;border:1px solid #526885;border-radius:10px;background:#142239;color:#f4ead6;text-align:left;cursor:pointer}.rpvs__reserve-card[disabled]{opacity:.48;cursor:not-allowed}.rpvs__reserve-card[aria-pressed=true]{border-color:#f2cf76;box-shadow:0 0 0 2px rgba(242,207,118,.22) inset}.rpvs__reserve-piece{display:grid;place-items:center;width:42px;height:42px;border-radius:8px;background:#08111f;font:30px Georgia,serif}.rpvs__reserve-meta{display:grid}.rpvs__reserve-cost{color:#f2cf76;font-weight:800}.rpvs__reserve-hint{margin-top:8px;color:#9fca9f;font-size:13px}
`,
    'browser reserve styles'
  );
  source = replaceOnce(source, '    this.selectedSquare = null;\n', '    this.selectedSquare = null;\n    this.selectedReserveEntryId = null;\n', 'browser reserve state');
  source = replaceOnce(
    source,
    "    this.selectedSquare = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedSquare : null;\n",
    "    this.selectedSquare = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedSquare : null;\n    this.selectedReserveEntryId = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedReserveEntryId : null;\n",
    'browser reserve render reset'
  );

  const renderScenario = `  renderScenario(snapshot) {
    const scenario = snapshot.scenario;
    const purpose = snapshot.status === 'boss' ? 'boss' : snapshot.currentNode?.type === 'elite' ? 'elite' : 'battle';
    const art = sceneAsset(snapshot, purpose);
    const objectives = scenario.objectives.map((item) => \`<div class="rpvs__item \${item.status === 'completed' ? 'rpvs__item--done' : ''}"><b>\${escapeHtml(item.label)}</b><div class="rpvs__muted">\${item.current} / \${item.target}</div><div class="rpvs__progress"><span style="width:\${Math.min(100, item.target ? item.current / item.target * 100 : 0)}%"></span></div></div>\`).join('');
    const failures = scenario.failures.map((item) => \`<div class="rpvs__item \${item.triggered ? 'rpvs__item--danger' : ''}"><b>\${escapeHtml(item.label)}</b><div class="rpvs__muted">\${item.triggered ? 'Сработало' : 'Не допустить'}</div></div>\`).join('');
    const moveCommands = scenario.legalCommands.filter((command) => command.type === 'MovePiece');
    const commands = moveCommands.map((command, index) => \`<button class="rpvs__action" data-move-command-index="\${index}">\${escapeHtml(commandLabel(command))}</button>\`).join('');
    const playerReserve = (scenario.reserve || []).filter((entry) => entry.side === snapshot.playerSide);
    if (this.selectedReserveEntryId && !playerReserve.some((entry) => entry.entryId === this.selectedReserveEntryId && entry.legalSquares.length)) this.selectedReserveEntryId = null;
    const reserveCards = playerReserve.map((entry) => {
      const selected = entry.entryId === this.selectedReserveEntryId;
      const disabled = !scenario.playerTurn || !entry.affordable || !entry.legalSquares.length;
      return \`<button class="rpvs__reserve-card" data-reserve-entry="\${escapeAttribute(entry.entryId)}" aria-pressed="\${selected}" \${disabled ? 'disabled' : ''}><span class="rpvs__reserve-piece">\${escapeHtml(pieceGlyph({ side: entry.side, type: entry.type }))}</span><span class="rpvs__reserve-meta"><strong>\${escapeHtml(entry.label)}</strong><small class="rpvs__muted">\${entry.legalSquares.length} доступн. клеток</small></span><span class="rpvs__reserve-cost">\${entry.orderCost} ОП</span></button>\`;
    }).join('');
    const order = scenario.orderPoints?.player || { current: 0, max: 0 };
    const title = snapshot.status === 'boss' ? snapshot.boss?.currentPhaseTitle || snapshot.boss?.bossId : snapshot.currentNode?.contentId || 'Тактический бой';
    const phase = snapshot.status === 'boss' ? \`Фаза \${snapshot.boss.phaseNumber} / \${snapshot.boss.phaseCount} · \` : '';
    const check = scenario.chessStatus?.check ? \`<span class="rpvs__check"><img src="\${escapeAttribute(CORE_ASSETS.vfx.check)}" alt="">Шах</span>\` : '';
    const main = \`<div class="rpvs__panel-head"><h1 class="rpvs__title">\${escapeHtml(title)}</h1><span class="rpvs__muted">\${phase}ход: \${scenario.sideToMove === snapshot.playerSide ? 'игрок' : 'противник'} · действие \${scenario.actionIndex}</span>\${check}</div><div class="rpvs__board-wrap" style="\${sceneStyle(art)}"><canvas class="rpvs__canvas" data-board tabindex="0" aria-label="Шахматная доска"></canvas></div>\`;
    const reserveSection = playerReserve.length ? \`<section class="rpvs__sidebar-section"><h3>Резерв</h3><div class="rpvs__order"><span>Очки приказа</span><strong>\${order.current} / \${order.max}</strong></div><div class="rpvs__reserve">\${reserveCards}</div>\${this.selectedReserveEntryId ? '<div class="rpvs__reserve-hint">Выберите подсвеченную клетку ввода на доске.</div>' : ''}</section>\` : '';
    const sidebar = \`<div class="rpvs__panel-head"><h2 class="rpvs__title">Задачи</h2></div><div class="rpvs__panel-body"><section class="rpvs__sidebar-section"><div class="rpvs__list">\${objectives}</div></section>\${failures ? \`<section class="rpvs__sidebar-section"><h3>Поражение</h3><div class="rpvs__list">\${failures}</div></section>\` : ''}\${reserveSection}<section class="rpvs__sidebar-section"><h3>Ходы фигур</h3><div class="rpvs__commands">\${commands || '<div class="rpvs__muted">Выберите фигуру на доске или ожидайте противника</div>'}</div></section></div>\`;
    this.root.innerHTML = this.shell(snapshot, main, sidebar);
    for (const button of this.root.querySelectorAll('[data-move-command-index]')) {
      button.addEventListener('click', () => {
        const command = moveCommands[Number(button.dataset.moveCommandIndex)];
        this.selectedReserveEntryId = null;
        this.client.dispatch({ type: 'PlayerCommand', request: command }).catch(() => {});
      });
    }
    for (const button of this.root.querySelectorAll('[data-reserve-entry]')) {
      button.addEventListener('click', () => {
        this.selectedReserveEntryId = this.selectedReserveEntryId === button.dataset.reserveEntry ? null : button.dataset.reserveEntry;
        this.selectedSquare = null;
        this.renderScenario(snapshot);
      });
    }
    const canvas = this.root.querySelector('[data-board]');
    canvas.addEventListener('pointerdown', (event) => this.handleBoardPointer(event));
    this.drawBoard();
    if (globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.drawBoard());
      this.resizeObserver.observe(canvas.parentElement);
    }
  }

`;
  source = replaceRange(source, '  renderScenario(snapshot) {', '  drawBoard() {', renderScenario, 'browser renderScenario');
  source = replaceOnce(
    source,
    '      CORE_ASSETS.neutralBoard.blocker,\n      CORE_ASSETS.vfx.legalMove,',
    '      CORE_ASSETS.neutralBoard.blocker,\n      CORE_ASSETS.neutralBoard.startZone,\n      CORE_ASSETS.vfx.legalMove,',
    'browser start zone preload'
  );
  source = replaceOnce(
    source,
    '    const targets = legalTargets(scenario, this.selectedSquare);\n    const environment = new Map();',
    '    const targets = this.selectedReserveEntryId ? new Map() : legalTargets(scenario, this.selectedSquare);\n    const reserveCommands = reserveTargets(scenario, this.selectedReserveEntryId);\n    const environment = new Map();',
    'browser reserve board targets'
  );
  source = replaceOnce(
    source,
    '        if (cell.square === this.selectedSquare) {',
    `        if (reserveCommands.has(cell.square)) {
          context.save();
          const startZone = this.assetCache.get(CORE_ASSETS.neutralBoard.startZone);
          if (startZone?.status === 'ready') context.drawImage(startZone.image, rect.x, rect.y, rect.size, rect.size);
          else { context.fillStyle = 'rgba(72,196,115,.34)'; context.fillRect(rect.x, rect.y, rect.size, rect.size); context.strokeStyle = '#7ee2a2'; context.lineWidth = Math.max(2, rect.size * .035); context.strokeRect(rect.x + 4, rect.y + 4, rect.size - 8, rect.size - 8); }
          context.restore();
        }
        if (cell.square === this.selectedSquare) {`,
    'browser reserve start-zone overlay'
  );
  source = replaceOnce(
    source,
    '[scenario.board.tileSet.light, scenario.board.tileSet.dark, CORE_ASSETS.neutralBoard.blocker, CORE_ASSETS.focusRing].some',
    '[scenario.board.tileSet.light, scenario.board.tileSet.dark, CORE_ASSETS.neutralBoard.blocker, CORE_ASSETS.neutralBoard.startZone, CORE_ASSETS.focusRing].some',
    'browser reserve async redraw'
  );

  const pointerMethod = `  handleBoardPointer(event) {
    if (this.busy || !this.boardReport || !this.boardPlan || !['scenario', 'boss'].includes(this.lastSnapshot?.status)) return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const viewport = this.boardReport.viewport;
    const displayX = Math.floor((x - viewport.x) / viewport.cellSize);
    const displayY = Math.floor((y - viewport.y) / viewport.cellSize);
    const cell = this.boardPlan.activeCells.find((candidate) => candidate.displayX === displayX && candidate.displayY === displayY);
    if (!cell) return;
    const scenario = this.lastSnapshot.scenario;
    if (this.selectedReserveEntryId) {
      const reserveCommand = reserveTargets(scenario, this.selectedReserveEntryId).get(cell.square);
      if (reserveCommand) {
        this.selectedReserveEntryId = null;
        this.client.dispatch({ type: 'PlayerCommand', request: reserveCommand }).catch(() => {});
      }
      return;
    }
    const targets = legalTargets(scenario, this.selectedSquare);
    const targetCommands = targets.get(cell.square) || [];
    if (targetCommands.length === 1) {
      this.client.dispatch({ type: 'PlayerCommand', request: targetCommands[0] }).catch(() => {});
      return;
    }
    const movable = scenario.legalCommands.some((command) => command.type === 'MovePiece' && command.payload.from === cell.square);
    this.selectedSquare = movable ? cell.square : null;
    this.drawBoard();
  }

`;
  source = replaceRange(source, '  handleBoardPointer(event) {', '  renderBossTransition(snapshot) {', pointerMethod, 'browser reserve pointer handler');
  source = replaceOnce(
    source,
    '  legalTargets,\n  createPresenterStyles,',
    '  legalTargets,\n  reserveTargets,\n  createPresenterStyles,',
    'browser reserve export'
  );
  write(file, source);
}

function patchProductionScenario() {
  const file = 'content/scenarios/iron_marches_vertical_slice.json';
  const data = JSON.parse(read(file));
  const scenario = data.encounters['encounter.iron_forward_outpost'];
  if (!scenario) throw new Error('production reserve scenario is missing');
  scenario.battle.orderPoints = { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } };
  scenario.battle.reserve = [{
    id: 'mara_chain_reserve',
    side: 'w',
    type: 'p',
    orderCost: 1,
    metadata: {
      heroId: 'hero.mara_chain',
      nameKey: 'hero.mara_chain.name',
      stars: 1,
      relicIds: ['relic.royal_decree']
    }
  }];
  scenario.battle.reserveCells = { w: ['b1', 'c1', 'd1'], b: [] };
  write(file, `${JSON.stringify(data, null, 2)}\n`);
}

function patchPresenterTests() {
  const file = 'tests/presenter-bridge.cjs';
  let source = read(file);
  source = replaceOnce(
    source,
    "      identityMetadata: { pawn_w: { heroId: 'hero.test', stars: 1, relicIds: ['relic.test'] } }\n",
    `      identityMetadata: { pawn_w: { heroId: 'hero.test', stars: 1, relicIds: ['relic.test'] } },
      orderPoints: { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
      reserve: [{ id: 'reserve_knight', side: 'w', type: 'n', orderCost: 1, metadata: { heroId: 'hero.reserve', nameKey: 'hero.reserve.name' } }],
      reserveCells: { w: ['b1', 'c1'], b: [] }
`,
    'presenter test reserve fixture'
  );
  source = replaceOnce(
    source,
    "    localization: { 'objective.survive': 'Survive two actions', 'failure.king': 'Protect the king', 'environment.altar': 'Visible altar' },",
    "    localization: { 'objective.survive': 'Survive two actions', 'failure.king': 'Protect the king', 'environment.altar': 'Visible altar', 'hero.reserve.name': 'Reserve Knight' },",
    'presenter test reserve localization'
  );
  source = replaceOnce(
    source,
    "  assert.strictEqual(snapshot.scenario.environment[0].cells[0], 'd4');\n  assert.ok(playerPawnCommand(state, deps));",
    `  assert.strictEqual(snapshot.scenario.environment[0].cells[0], 'd4');
  assert.strictEqual(snapshot.scenario.orderPoints.player.current, 2);
  assert.strictEqual(snapshot.scenario.orderPoints.player.max, 5);
  assert.strictEqual(snapshot.scenario.reserve[0].label, 'Reserve Knight');
  assert.deepStrictEqual(snapshot.scenario.reserve[0].legalSquares, ['b1', 'c1']);
  assert.deepStrictEqual(snapshot.scenario.reserveCells.w, ['b1', 'c1']);
  assert.ok(snapshot.scenario.legalCommands.some((command) => command.type === 'DeployReserve'));
  assert.ok(playerPawnCommand(state, deps));`,
    'presenter test reserve assertions'
  );
  const newTest = `
test('reserve command spends order points and remains inside PlayerCommand boundary', () => {
  const { contentRegistry, state: initial } = fixture(126);
  const deps = dependencies(contentRegistry);
  const active = enterUntilScenario(initial, deps);
  const snapshot = createPresenterSnapshot(active, deps);
  const reserveCommand = snapshot.scenario.legalCommands.find((command) => command.type === 'DeployReserve' && command.payload.square === 'b1');
  assert.ok(reserveCommand);
  const result = dispatchPresenterCommand(active, { type: 'PlayerCommand', request: reserveCommand }, deps);
  const reserveEvent = result.state.scenario?.battle.eventLog.find((event) => event.type === 'ReserveDeployed');
  assert.ok(reserveEvent || result.snapshot.status === 'reward');
  if (result.snapshot.scenario) {
    assert.strictEqual(result.snapshot.scenario.orderPoints.player.current, 1);
    assert.strictEqual(result.snapshot.scenario.reserve.length, 0);
  }
});

`;
  source = replaceOnce(source, "test('player command resolves one player/AI pair and projects the exact node reward', () => {", `${newTest}test('player command resolves one player/AI pair and projects the exact node reward', () => {`, 'presenter reserve command test');
  write(file, source);
}

function addBrowserTest() {
  const file = 'tests/reserve-presenter-browser.cjs';
  const content = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs')).href);
  const scenario = {
    legalCommands: [
      { type: 'MovePiece', payload: { from: 'e2', to: 'e4' } },
      { type: 'DeployReserve', payload: { entryId: 'reserve_knight', square: 'b1' } },
      { type: 'DeployReserve', payload: { entryId: 'reserve_knight', square: 'c1' } },
      { type: 'DeployReserve', payload: { entryId: 'reserve_pawn', square: 'd1' } }
    ]
  };
  const targets = presenter.reserveTargets(scenario, 'reserve_knight');
  assert.deepStrictEqual([...targets.keys()], ['b1', 'c1']);
  assert.strictEqual(targets.get('b1').payload.entryId, 'reserve_knight');
  assert.strictEqual(presenter.reserveTargets(scenario, null).size, 0);
  assert.strictEqual(presenter.commandLabel({ type: 'DeployReserve', payload: { entryId: 'reserve_knight', square: 'b1' } }), 'Резерв: reserve_knight → b1');
  const styles = presenter.createPresenterStyles();
  assert.ok(styles.includes('rpvs__reserve-card'));
  assert.ok(styles.includes('rpvs__order'));
  const source = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs'), 'utf8');
  assert.ok(source.includes('CORE_ASSETS.neutralBoard.startZone'));
  assert.ok(source.includes('data-reserve-entry'));
  assert.ok(source.includes('selectedReserveEntryId'));
  console.log('Reserve presenter browser: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
`;
  write(file, content);
}

function patchPackage() {
  const file = 'package.json';
  const data = JSON.parse(read(file));
  const marker = 'node tests/browser-crypto-shim.cjs';
  if (!data.scripts.test.includes(marker)) throw new Error('package test marker missing');
  if (!data.scripts.test.includes('tests/reserve-presenter-browser.cjs')) {
    data.scripts.test = data.scripts.test.replace(marker, `${marker} && node tests/reserve-presenter-browser.cjs`);
  }
  write(file, `${JSON.stringify(data, null, 2)}\n`);
}

patchPresenterBridge();
patchBrowserPresenter();
patchProductionScenario();
patchPresenterTests();
addBrowserTest();
patchPackage();
console.log('Applied reserve/order-points presentation patch.');
