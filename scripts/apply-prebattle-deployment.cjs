'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, 'utf8');

function replaceOnce(content, needle, replacement, label) {
  const first = content.indexOf(needle);
  if (first < 0) throw new Error(`${label}: needle not found`);
  if (content.indexOf(needle, first + needle.length) >= 0) throw new Error(`${label}: ambiguous needle`);
  return content.slice(0, first) + replacement + content.slice(first + needle.length);
}

function replaceRange(content, startNeedle, endNeedle, replacement, label) {
  const start = content.indexOf(startNeedle);
  if (start < 0) throw new Error(`${label}: start not found`);
  const end = content.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) throw new Error(`${label}: end not found`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function patchVerticalSlice() {
  const file = 'src/runtime/vertical-slice.cjs';
  let source = read(file);
  source = replaceOnce(
    source,
    "const { executeBossActionPair, advanceBossPhase } = require('./boss-gate.cjs');",
    `const { executeBossActionPair, advanceBossPhase } = require('./boss-gate.cjs');
const {
  DEPLOYMENT_COMMANDS,
  executeDeploymentEdit,
  finalizeScenarioDeployment
} = require('./deployment-gate.cjs');`,
    'vertical deployment imports'
  );
  source = replaceOnce(source, "  'campaign',\n  'event',", "  'campaign',\n  'deployment',\n  'event',", 'vertical deployment status');
  source = replaceOnce(source, '    currentNode: null,\n    event: null,', '    currentNode: null,\n    deployment: null,\n    event: null,', 'vertical initial deployment');
  source = replaceOnce(
    source,
    "  const operation = Object.freeze({ type: 'Travel', targetNodeId });",
    `  const deployment = resolution.mode === 'scenario' && typeof dependencies.deploymentFactory === 'function'
    ? dependencies.deploymentFactory({ runtime: state, campaign, node, content, scenario: resolution.scenario })
    : null;
  const operation = Object.freeze({ type: 'Travel', targetNodeId });`,
    'vertical create deployment gate'
  );
  source = replaceOnce(
    source,
    "  const nextStatus = resolution.mode === 'scenario'\n    ? 'scenario'",
    "  const nextStatus = resolution.mode === 'scenario'\n    ? (deployment ? 'deployment' : 'scenario')",
    'vertical deployment next status'
  );
  source = replaceOnce(
    source,
    '    currentNode,\n    event: resolution.event,',
    '    currentNode,\n    deployment,\n    event: resolution.event,',
    'vertical deployment state field'
  );

  const deploymentFunction = `function executeVerticalSliceDeployment(state, commandInput, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status !== 'deployment' || !state.deployment || !state.scenario) throw new Error('no active vertical slice deployment');
  if (!commandInput || !DEPLOYMENT_COMMANDS.includes(commandInput.type)) throw new Error('unsupported vertical slice deployment command');
  const command = Object.freeze({
    type: commandInput.type,
    payload: Object.freeze({ ...(commandInput.payload || {}) })
  });
  if (command.type === 'ConfirmDeployment') {
    const finalized = finalizeScenarioDeployment(state.deployment);
    return deepFreeze({
      ...state,
      status: 'scenario',
      deployment: null,
      scenario: finalized.scenario,
      transcript: freezeArray([...state.transcript, command]),
      history: freezeArray([...state.history, Object.freeze({
        index: state.history.length,
        type: 'deployment_confirmed',
        nodeId: state.currentNode.nodeId,
        commandSpent: finalized.summary.commandSpent,
        commandLimit: finalized.summary.commandLimit,
        reserveIds: finalized.summary.reserveIds
      })])
    });
  }
  const deployment = executeDeploymentEdit(state.deployment, command);
  return deepFreeze({
    ...state,
    deployment,
    transcript: freezeArray([...state.transcript, command]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'deployment_edited',
      nodeId: state.currentNode.nodeId,
      commandType: command.type,
      payload: command.payload,
      revision: deployment.revision
    })])
  });
}

`;
  source = replaceOnce(source, 'function copyRequest(request) {', `${deploymentFunction}function copyRequest(request) {`, 'vertical deployment execution');
  source = replaceOnce(
    source,
    '    currentNode: null,\n    event: null,',
    '    currentNode: null,\n    deployment: null,\n    event: null,',
    'vertical clear deployment after reward'
  );
  source = replaceOnce(
    source,
    "  if (state.status === 'event' && (!state.event || state.event.status !== 'active')) throw new Error('snapshot active event is invalid');",
    `  if (state.status === 'deployment' && (!state.deployment || state.deployment.format !== 'rpchess-scenario-deployment-gate' || !state.scenario)) throw new Error('snapshot active deployment is invalid');
  if (state.status === 'event' && (!state.event || state.event.status !== 'active')) throw new Error('snapshot active event is invalid');`,
    'vertical deployment snapshot validation'
  );
  source = replaceOnce(
    source,
    "    if (operation.type === 'Travel') state = enterVerticalSliceNode(state, operation.targetNodeId, dependencies);\n    else if (operation.type === 'ChooseEvent')",
    "    if (operation.type === 'Travel') state = enterVerticalSliceNode(state, operation.targetNodeId, dependencies);\n    else if (DEPLOYMENT_COMMANDS.includes(operation.type)) state = executeVerticalSliceDeployment(state, operation, dependencies);\n    else if (operation.type === 'ChooseEvent')",
    'vertical deployment replay'
  );
  source = replaceOnce(
    source,
    '  chooseVerticalSliceEvent,\n  executeVerticalSlicePlayerTurn,',
    '  chooseVerticalSliceEvent,\n  executeVerticalSliceDeployment,\n  executeVerticalSlicePlayerTurn,',
    'vertical deployment export'
  );
  write(file, source);
}

function patchBrowserHost() {
  const file = 'src/browser/iron-marches-browser-host.cjs';
  let source = read(file);
  source = replaceOnce(
    source,
    "const { buildBrowserProductionBundle } = require('./production-content-browser.cjs');",
    `const { buildBrowserProductionBundle } = require('./production-content-browser.cjs');
const { createScenarioDeploymentGate } = require('../runtime/deployment-gate.cjs');`,
    'browser deployment import'
  );
  source = replaceOnce(
    source,
    '  return Object.freeze({\n    contentRegistry: bundle.registry,',
    `  const deploymentFactory = ({ runtime, node, scenario }) => createScenarioDeploymentGate(scenario, {
    gateId: \`${'${'}node.id}_deployment\`,
    seed: hash32(\`${'${'}runtime.seed}:${'${'}node.id}:deployment\`),
    playerSide: runtime.playerSide,
    localization
  });

  return Object.freeze({
    contentRegistry: bundle.registry,`,
    'browser deployment factory'
  );
  source = replaceOnce(
    source,
    '    nodeResolver,\n    bossPhaseBattleResolver,',
    '    nodeResolver,\n    deploymentFactory,\n    bossPhaseBattleResolver,',
    'browser deployment dependency'
  );
  write(file, source);
}

function patchPresenterBridge() {
  const file = 'src/runtime/presenter-bridge.cjs';
  let source = read(file);
  source = replaceOnce(
    source,
    '  chooseVerticalSliceEvent,\n  executeVerticalSlicePlayerTurn,',
    '  chooseVerticalSliceEvent,\n  executeVerticalSliceDeployment,\n  executeVerticalSlicePlayerTurn,',
    'presenter deployment runtime import'
  );
  source = replaceOnce(
    source,
    "} = require('./vertical-slice.cjs');",
    `} = require('./vertical-slice.cjs');
const { deploymentGateSnapshot } = require('./deployment-gate.cjs');`,
    'presenter deployment snapshot import'
  );
  source = replaceOnce(source, "  'Travel',\n  'ChooseEvent',", "  'Travel',\n  'PlaceDeploymentUnit',\n  'RemoveDeploymentUnit',\n  'ConfirmDeployment',\n  'ChooseEvent',", 'presenter deployment commands');
  source = replaceOnce(
    source,
    "  const playerTurn = battle.position.sideToMove === state.playerSide && scenario.status === 'active';",
    "  const playerTurn = ['scenario', 'boss'].includes(state.status) && battle.position.sideToMove === state.playerSide && scenario.status === 'active';",
    'presenter suppress moves during deployment'
  );
  source = replaceOnce(
    source,
    "  if (state.status === 'campaign') return freezeArray(['Travel']);\n  if (state.status === 'event'",
    "  if (state.status === 'campaign') return freezeArray(['Travel']);\n  if (state.status === 'deployment') return freezeArray(['PlaceDeploymentUnit', 'RemoveDeploymentUnit', 'ConfirmDeployment']);\n  if (state.status === 'event'",
    'presenter deployment actions'
  );
  source = replaceOnce(
    source,
    '  const event = eventSnapshot(state, dependencies);\n  const scenario = scenarioSnapshot(state, dependencies);',
    '  const event = eventSnapshot(state, dependencies);\n  const deployment = state.deployment ? deploymentGateSnapshot(state.deployment) : null;\n  const scenario = scenarioSnapshot(state, dependencies);',
    'presenter deployment projection'
  );
  source = replaceOnce(
    source,
    '    event,\n    scenario,',
    '    event,\n    deployment,\n    scenario,',
    'presenter deployment payload'
  );
  source = replaceOnce(
    source,
    "  if (type === 'ChooseEvent') {",
    `  if (type === 'PlaceDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    const square = String(command.square || command.payload?.square || '');
    if (!unitId || !square) throw new Error('PlaceDeploymentUnit requires unitId and square');
    return Object.freeze({ type, payload: Object.freeze({ unitId, square }) });
  }
  if (type === 'RemoveDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    if (!unitId) throw new Error('RemoveDeploymentUnit requires unitId');
    return Object.freeze({ type, payload: Object.freeze({ unitId }) });
  }
  if (type === 'ChooseEvent') {`,
    'presenter deployment command normalization'
  );
  source = replaceOnce(
    source,
    "  if (command.type === 'Travel') nextState = enterVerticalSliceNode(state, command.targetNodeId, dependencies);\n  else if (command.type === 'ChooseEvent')",
    "  if (command.type === 'Travel') nextState = enterVerticalSliceNode(state, command.targetNodeId, dependencies);\n  else if (['PlaceDeploymentUnit', 'RemoveDeploymentUnit', 'ConfirmDeployment'].includes(command.type)) nextState = executeVerticalSliceDeployment(state, command, dependencies);\n  else if (command.type === 'ChooseEvent')",
    'presenter deployment dispatch'
  );
  write(file, source);
}

function patchRuntimeClient() {
  const file = 'game/js/runtime-command-client.mjs';
  let source = read(file);
  source = replaceOnce(source, "  'Travel',\n  'ChooseEvent',", "  'Travel',\n  'PlaceDeploymentUnit',\n  'RemoveDeploymentUnit',\n  'ConfirmDeployment',\n  'ChooseEvent',", 'client deployment commands');
  source = replaceOnce(
    source,
    "  if (!['campaign', 'event', 'scenario', 'boss', 'boss_transition', 'reward', 'complete', 'failed'].includes(snapshot.status)) {",
    "  if (!['campaign', 'deployment', 'event', 'scenario', 'boss', 'boss_transition', 'reward', 'complete', 'failed'].includes(snapshot.status)) {",
    'client deployment status'
  );
  source = replaceOnce(
    source,
    "  if (snapshot.status === 'event' && (!snapshot.event || !Array.isArray(snapshot.event.choices))) {",
    "  if (snapshot.status === 'deployment' && (!snapshot.deployment || !snapshot.scenario)) throw new Error('presenter deployment snapshot is incomplete');\n  if (snapshot.status === 'event' && (!snapshot.event || !Array.isArray(snapshot.event.choices))) {",
    'client deployment validation'
  );
  source = replaceOnce(
    source,
    "  if (type === 'ChooseEvent') {",
    `  if (type === 'PlaceDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    const square = String(command.square || command.payload?.square || '');
    if (!unitId || !square) throw new Error('PlaceDeploymentUnit requires unitId and square');
    return Object.freeze({ type, payload: Object.freeze({ unitId, square }) });
  }
  if (type === 'RemoveDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    if (!unitId) throw new Error('RemoveDeploymentUnit requires unitId');
    return Object.freeze({ type, payload: Object.freeze({ unitId }) });
  }
  if (type === 'ChooseEvent') {`,
    'client deployment normalization'
  );
  write(file, source);
}

function patchBrowserPresenter() {
  const file = 'game/js/vertical-slice-presenter.mjs';
  let source = read(file);
  source = replaceOnce(
    source,
    '    .rpvs__order{display:flex;',
    `    .rpvs__deployment-units{display:grid;gap:8px}.rpvs__deployment-unit{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;padding:9px;border:1px solid #526885;border-radius:10px;background:#142239;color:#f4ead6;text-align:left;cursor:pointer}.rpvs__deployment-unit[aria-pressed=true]{border-color:#f2cf76;box-shadow:0 0 0 2px rgba(242,207,118,.22) inset}.rpvs__deployment-unit[disabled]{opacity:.55;cursor:not-allowed}.rpvs__deployment-remove{padding:7px;border:1px solid #985858;border-radius:8px;background:#3b1d25;color:#ffd8d8;cursor:pointer}.rpvs__deployment-budget{display:flex;justify-content:space-between;margin-bottom:10px;padding:10px;border:1px solid #8d7745;border-radius:10px;background:#111d30}.rpvs__deployment-help{color:#a8c8a8;font-size:13px}
    .rpvs__order{display:flex;`,
    'browser deployment styles'
  );
  source = replaceOnce(source, '    this.selectedReserveEntryId = null;\n', '    this.selectedReserveEntryId = null;\n    this.selectedDeploymentUnitId = null;\n', 'browser deployment state');
  source = replaceOnce(
    source,
    "    this.selectedReserveEntryId = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedReserveEntryId : null;\n",
    "    this.selectedReserveEntryId = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedReserveEntryId : null;\n    this.selectedDeploymentUnitId = snapshot.status === 'deployment' ? this.selectedDeploymentUnitId : null;\n",
    'browser deployment reset'
  );
  source = replaceOnce(
    source,
    "    else if (['scenario', 'boss'].includes(snapshot.status)) this.renderScenario(snapshot);",
    "    else if (snapshot.status === 'deployment') this.renderDeployment(snapshot);\n    else if (['scenario', 'boss'].includes(snapshot.status)) this.renderScenario(snapshot);",
    'browser deployment render switch'
  );

  const deploymentMethods = `  renderDeployment(snapshot) {
    const deployment = snapshot.deployment;
    const scenario = snapshot.scenario;
    const art = sceneAsset(snapshot, snapshot.currentNode?.type === 'elite' ? 'elite' : 'battle');
    if (this.selectedDeploymentUnitId && !deployment.units.some((unit) => unit.id === this.selectedDeploymentUnitId && !unit.fixed)) this.selectedDeploymentUnitId = null;
    const units = deployment.units.map((unit) => {
      const selected = unit.id === this.selectedDeploymentUnitId;
      const location = unit.square || 'резерв';
      return \`<div class="rpvs__deployment-unit" role="button" tabindex="\${unit.fixed ? -1 : 0}" aria-pressed="\${selected}" data-deployment-unit="\${escapeAttribute(unit.id)}" \${unit.fixed ? 'aria-disabled="true"' : ''}><span class="rpvs__reserve-piece">\${escapeHtml(pieceGlyph({ side: deployment.playerSide, type: unit.type }))}</span><span><strong>\${escapeHtml(unit.label)}</strong><small class="rpvs__muted">\${escapeHtml(location)} · \${unit.commandCost} ком.</small></span>\${!unit.fixed && unit.square ? \`<button class="rpvs__deployment-remove" data-deployment-remove="\${escapeAttribute(unit.id)}">В резерв</button>\` : ''}</div>\`;
    }).join('');
    const main = \`<div class="rpvs__panel-head"><h1 class="rpvs__title">Расстановка армии</h1><span class="rpvs__muted">Выберите фигуру, затем клетку стартовой зоны</span></div><div class="rpvs__board-wrap" style="\${sceneStyle(art)}"><canvas class="rpvs__canvas" data-deployment-board tabindex="0" aria-label="Поле расстановки"></canvas></div>\`;
    const sidebar = \`<div class="rpvs__panel-head"><h2 class="rpvs__title">Состав</h2></div><div class="rpvs__panel-body"><div class="rpvs__deployment-budget"><span>Командование</span><strong>\${deployment.commandSpent} / \${deployment.commandLimit}</strong></div><div class="rpvs__deployment-units">\${units}</div><p class="rpvs__deployment-help">Обязательные фигуры должны оставаться на поле. Неразмещённые необязательные фигуры переходят в резерв.</p><button class="rpvs__primary" data-confirm-deployment \${deployment.canConfirm ? '' : 'disabled'}>Подтвердить расстановку</button></div>\`;
    this.root.innerHTML = this.shell(snapshot, main, sidebar);
    for (const card of this.root.querySelectorAll('[data-deployment-unit]')) {
      const choose = (event) => {
        if (event.target.closest('[data-deployment-remove]') || card.getAttribute('aria-disabled') === 'true') return;
        this.selectedDeploymentUnitId = this.selectedDeploymentUnitId === card.dataset.deploymentUnit ? null : card.dataset.deploymentUnit;
        this.renderDeployment(snapshot);
      };
      card.addEventListener('click', choose);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(event); } });
    }
    for (const button of this.root.querySelectorAll('[data-deployment-remove]')) button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.selectedDeploymentUnitId = null;
      this.client.dispatch({ type: 'RemoveDeploymentUnit', unitId: button.dataset.deploymentRemove }).catch(() => {});
    });
    this.root.querySelector('[data-confirm-deployment]')?.addEventListener('click', () => this.client.dispatch({ type: 'ConfirmDeployment' }).catch(() => {}));
    const canvas = this.root.querySelector('[data-deployment-board]');
    canvas.addEventListener('pointerdown', (event) => this.handleDeploymentPointer(event));
    this.drawDeploymentBoard();
    if (globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.drawDeploymentBoard());
      this.resizeObserver.observe(canvas.parentElement);
    }
  }

  drawDeploymentBoard() {
    const snapshot = this.lastSnapshot;
    const scenario = snapshot?.scenario;
    const deployment = snapshot?.deployment;
    const canvas = this.root.querySelector('[data-deployment-board]');
    if (!canvas || !scenario || !deployment) return;
    const bounds = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(320, Math.floor(bounds.height));
    const resized = resizeCanvasForDisplay(canvas, width, height, globalThis.devicePixelRatio || 1);
    const plan = buildBrowserBoardPlan({
      width: scenario.board.width,
      height: scenario.board.height,
      activeCells: scenario.board.activeCells,
      flipped: scenario.board.flipped,
      tileSet: scenario.board.tileSet
    });
    this.boardPlan = plan;
    this.assetCache.prime([scenario.board.tileSet.light, scenario.board.tileSet.dark, CORE_ASSETS.neutralBoard.blocker, CORE_ASSETS.neutralBoard.startZone, CORE_ASSETS.focusRing]);
    const environment = new Map();
    for (const object of scenario.environment) for (const cell of object.cells) environment.set(cell, object);
    const units = new Map(deployment.units.filter((unit) => unit.square).map((unit) => [unit.square, { ...unit, side: deployment.playerSide }]));
    for (const piece of scenario.pieces.filter((piece) => piece.side !== deployment.playerSide)) units.set(piece.square, piece);
    const zone = new Set(deployment.zone);
    const report = renderModularBoard(resized.context, plan, {
      assetCache: this.assetCache,
      canvasWidth: width,
      canvasHeight: height,
      padding: 18,
      showCoordinates: true,
      background: 'rgba(4,8,14,.72)',
      drawCellOverlay: (context, cell, rect) => {
        const object = environment.get(cell.square);
        if (object?.type === 'blocker') {
          const blocker = this.assetCache.get(CORE_ASSETS.neutralBoard.blocker);
          if (blocker?.status === 'ready') context.drawImage(blocker.image, rect.x, rect.y, rect.size, rect.size);
        }
        if (zone.has(cell.square)) {
          const startZone = this.assetCache.get(CORE_ASSETS.neutralBoard.startZone);
          if (startZone?.status === 'ready') context.drawImage(startZone.image, rect.x, rect.y, rect.size, rect.size);
          else { context.fillStyle = 'rgba(72,196,115,.18)'; context.fillRect(rect.x, rect.y, rect.size, rect.size); }
        }
        const unit = units.get(cell.square);
        if (unit) {
          context.save(); context.fillStyle = unit.side === 'w' ? '#f6ecd2' : '#172032'; context.strokeStyle = unit.side === 'w' ? '#765822' : '#a3b9db'; context.lineWidth = Math.max(2, rect.size * .035); context.beginPath(); context.arc(rect.x + rect.size / 2, rect.y + rect.size / 2, rect.size * .35, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = unit.side === 'w' ? '#111' : '#f4ead6'; context.font = \`\${Math.floor(rect.size * .58)}px Georgia,serif\`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(pieceGlyph({ side: unit.side, type: unit.type }), rect.x + rect.size / 2, rect.y + rect.size / 2 + rect.size * .03); context.restore();
        }
        const selected = deployment.units.find((unit) => unit.id === this.selectedDeploymentUnitId);
        if (selected?.square === cell.square) {
          const focus = this.assetCache.get(CORE_ASSETS.focusRing);
          if (focus?.status === 'ready') context.drawImage(focus.image, rect.x, rect.y, rect.size, rect.size);
        }
      }
    });
    this.boardReport = report;
    if ([scenario.board.tileSet.light, scenario.board.tileSet.dark, CORE_ASSETS.neutralBoard.blocker, CORE_ASSETS.neutralBoard.startZone, CORE_ASSETS.focusRing].some((source) => this.assetCache.status(source) === 'loading')) requestAnimationFrame(() => this.drawDeploymentBoard());
  }

  handleDeploymentPointer(event) {
    if (this.busy || !this.boardReport || !this.boardPlan || this.lastSnapshot?.status !== 'deployment') return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const viewport = this.boardReport.viewport;
    const displayX = Math.floor((event.clientX - bounds.left - viewport.x) / viewport.cellSize);
    const displayY = Math.floor((event.clientY - bounds.top - viewport.y) / viewport.cellSize);
    const cell = this.boardPlan.activeCells.find((candidate) => candidate.displayX === displayX && candidate.displayY === displayY);
    if (!cell) return;
    const deployment = this.lastSnapshot.deployment;
    const occupying = deployment.units.find((unit) => unit.square === cell.square && !unit.fixed);
    if (occupying) {
      this.selectedDeploymentUnitId = occupying.id;
      this.renderDeployment(this.lastSnapshot);
      return;
    }
    if (this.selectedDeploymentUnitId && deployment.zone.includes(cell.square)) {
      this.client.dispatch({ type: 'PlaceDeploymentUnit', unitId: this.selectedDeploymentUnitId, square: cell.square }).catch(() => {});
    }
  }

`;
  source = replaceOnce(source, '  renderScenario(snapshot) {', `${deploymentMethods}  renderScenario(snapshot) {`, 'browser deployment methods');
  write(file, source);
}

function patchProductionRuntimeTest() {
  const file = 'tests/browser-production-runtime.cjs';
  let source = read(file);
  source = replaceOnce(
    source,
    "  assert.ok(['campaign', 'event', 'scenario', 'boss', 'reward'].includes(result.snapshot.status));",
    "  assert.ok(['campaign', 'deployment', 'event', 'scenario', 'boss', 'reward'].includes(result.snapshot.status));",
    'browser runtime deployment status test'
  );
  write(file, source);
}

function addRuntimeTests() {
  const file = 'tests/deployment-runtime.cjs';
  write(file, `const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host.cjs');

async function launch(host) {
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  await host.dispatch({ type: 'LockSelection' });
  return host.getRuntimeHost();
}

async function reachDeployment(runtime) {
  for (let step = 0; step < 20; step += 1) {
    const snapshot = runtime.getSnapshot();
    if (snapshot.status === 'deployment') return snapshot;
    if (snapshot.status === 'campaign') {
      const route = snapshot.campaign.routes.find((item) => item.affordable && ['battle', 'elite'].includes(item.type)) || snapshot.campaign.routes.find((item) => item.affordable);
      if (!route) throw new Error('no affordable route while seeking deployment');
      await runtime.dispatch({ type: 'Travel', targetNodeId: route.to });
    } else if (snapshot.status === 'event') {
      await runtime.dispatch({ type: 'ChooseEvent', choiceId: snapshot.event.choices[0].id });
    } else if (snapshot.status === 'reward') {
      await runtime.dispatch({ type: 'ClaimReward' });
    } else throw new Error(`unexpected status while seeking deployment: ${snapshot.status}`);
  }
  throw new Error('deployment was not reached');
}

(async () => {
  const storage = new MemoryKeyValueStorage();
  const host = createBrowserRunSelectionHost({ seed: 20001, profileId: 'profile-1', storage, deviceId: 'deployment-runtime-test' });
  const runtime = await launch(host);
  let snapshot = await reachDeployment(runtime);
  assert.strictEqual(snapshot.status, 'deployment');
  assert.strictEqual(snapshot.deployment.format, 'rpchess-deployment-presenter');
  assert.strictEqual(snapshot.actions.includes('ConfirmDeployment'), true);
  assert.strictEqual(snapshot.scenario.playerTurn, false);
  assert.ok(snapshot.deployment.zone.length >= 16);
  const optional = snapshot.deployment.units.find((unit) => !unit.fixed && !unit.required);
  assert.ok(optional);

  await runtime.dispatch({ type: 'RemoveDeploymentUnit', unitId: optional.id });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.deployment.units.find((unit) => unit.id === optional.id).inReserve, true);
  const revisionAfterEdit = runtime.getLastSaveEnvelope().revision;

  const resumedHost = createBrowserRunSelectionHost({ profileId: 'profile-1', storage, deviceId: 'deployment-runtime-test' });
  assert.strictEqual(resumedHost.getSnapshot().status, 'ready');
  const resumed = resumedHost.getRuntimeHost();
  assert.strictEqual(resumed.getSnapshot().status, 'deployment');
  assert.strictEqual(resumed.getSnapshot().deployment.units.find((unit) => unit.id === optional.id).inReserve, true);
  assert.strictEqual(resumed.getLastSaveEnvelope(), null);

  await resumed.dispatch({ type: 'ConfirmDeployment' });
  snapshot = resumed.getSnapshot();
  assert.strictEqual(snapshot.status, 'scenario');
  assert.strictEqual(snapshot.deployment, null);
  assert.ok(snapshot.scenario.reserve.some((entry) => entry.entryId === optional.id));
  assert.ok(resumed.getLastSaveEnvelope().revision > revisionAfterEdit);
  console.log('Deployment runtime: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
`);
}

function addBrowserTests() {
  const file = 'tests/deployment-presenter-browser.cjs';
  write(file, `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const client = await import(pathToFileURL(path.resolve(__dirname, '../game/js/runtime-command-client.mjs')).href);
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'PlaceDeploymentUnit', unitId: 'hero_a', square: 'b1' }), { type: 'PlaceDeploymentUnit', payload: { unitId: 'hero_a', square: 'b1' } });
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'RemoveDeploymentUnit', unitId: 'hero_a' }), { type: 'RemoveDeploymentUnit', payload: { unitId: 'hero_a' } });
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'ConfirmDeployment' }), { type: 'ConfirmDeployment' });
  const source = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs'), 'utf8');
  assert.ok(source.includes('renderDeployment(snapshot)'));
  assert.ok(source.includes('drawDeploymentBoard()'));
  assert.ok(source.includes('handleDeploymentPointer(event)'));
  assert.ok(source.includes('data-confirm-deployment'));
  assert.ok(source.includes('CORE_ASSETS.neutralBoard.startZone'));
  console.log('Deployment presenter browser: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
`);
}

function patchPackage() {
  const file = 'package.json';
  const data = JSON.parse(read(file));
  const marker = 'node tests/deployment-reserve.cjs';
  if (!data.scripts.test.includes(marker)) throw new Error('deployment test marker missing');
  if (!data.scripts.test.includes('tests/deployment-gate.cjs')) data.scripts.test = data.scripts.test.replace(marker, `${marker} && node tests/deployment-gate.cjs`);
  const tail = 'node tests/browser-profile-selector.cjs';
  if (!data.scripts.test.includes(tail)) throw new Error('browser selector marker missing');
  if (!data.scripts.test.includes('tests/deployment-runtime.cjs')) data.scripts.test = data.scripts.test.replace(tail, `${tail} && node tests/deployment-runtime.cjs && node tests/deployment-presenter-browser.cjs`);
  write(file, `${JSON.stringify(data, null, 2)}\n`);
}

patchVerticalSlice();
patchBrowserHost();
patchPresenterBridge();
patchRuntimeClient();
patchBrowserPresenter();
patchProductionRuntimeTest();
addRuntimeTests();
addBrowserTests();
patchPackage();
console.log('Applied pre-battle deployment integration.');
