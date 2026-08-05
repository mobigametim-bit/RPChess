'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function file(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(file(relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(file(relativePath), content);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment is not unique`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchBattle() {
  let source = read('src/combat/battle.cjs');
  source = replaceOnce(source,
    "} = require('./statuses.cjs');\n\nfunction freezeArray(items) {",
    "} = require('./statuses.cjs');\nconst {\n  createAbilityState,\n  legalAbilityCommands,\n  normalizeAbilityRequest,\n  resolveAbilityCommand\n} = require('./abilities.cjs');\n\nfunction freezeArray(items) {",
    'battle ability import');
  source = replaceOnce(source,
    "    statuses: options.statuses && options.statuses.format === 'rpchess-status-state'\n      ? options.statuses\n      : createStatusState(options.statuses || {}),\n    actionIndex: 0,",
    "    statuses: options.statuses && options.statuses.format === 'rpchess-status-state'\n      ? options.statuses\n      : createStatusState(options.statuses || {}),\n    abilities: createAbilityState(options.abilities || {}),\n    actionIndex: 0,",
    'battle state abilities');
  source = replaceOnce(source,
    "  return [\n    ...moveCommands(state),\n    ...legalReserveDeployments({",
    "  return [\n    ...moveCommands(state),\n    ...legalAbilityCommands(state),\n    ...legalReserveDeployments({",
    'battle legal abilities');
  source = replaceOnce(source,
    '  let statuses = state.statuses;\n',
    '  let statuses = resolution.statuses || state.statuses;\n',
    'battle ability statuses');
  source = replaceOnce(source,
    "  if (!request || !['MovePiece', 'DeployReserve'].includes(request.type)) {\n    throw new Error(`unsupported battle command: ${request && request.type}`);\n  }\n\n  const actingSide = state.position.sideToMove;\n  const factory = createEnvelopeFactory(state.envelope);\n  const command = factory.command(request.type, request.payload || {}, {\n    battleId: state.battleId,\n    actorSide: actingSide,\n    actionIndex: state.actionIndex\n  });\n  const resolution = request.type === 'MovePiece'\n    ? executeMoveCommand(state, command, factory)\n    : executeReserveCommand(state, command, factory);",
    "  if (!request || !['MovePiece', 'DeployReserve', 'UseAbility'].includes(request.type)) {\n    throw new Error(`unsupported battle command: ${request && request.type}`);\n  }\n\n  const normalizedRequest = request.type === 'UseAbility'\n    ? normalizeAbilityRequest(state, request)\n    : request;\n  const actingSide = state.position.sideToMove;\n  const factory = createEnvelopeFactory(state.envelope);\n  const command = factory.command(normalizedRequest.type, normalizedRequest.payload || {}, {\n    battleId: state.battleId,\n    actorSide: actingSide,\n    actionIndex: state.actionIndex\n  });\n  let resolution;\n  if (normalizedRequest.type === 'MovePiece') resolution = executeMoveCommand(state, command, factory);\n  else if (normalizedRequest.type === 'DeployReserve') resolution = executeReserveCommand(state, command, factory);\n  else resolution = resolveAbilityCommand(state, command, factory);",
    'battle execute ability');
  source = replaceOnce(source,
    "    statuses,\n    actionIndex: state.actionIndex + 1,",
    "    statuses,\n    abilities: resolution.abilities || state.abilities,\n    actionIndex: state.actionIndex + 1,",
    'battle persist abilities');
  write('src/combat/battle.cjs', source);
}

function patchBrowserHost() {
  let source = read('src/browser/iron-marches-browser-host.cjs');
  source = replaceOnce(source,
    "  createRuntimeArmy,\n  validateRuntimeArmy,\n  runtimeSelectionFromArmy,\n  projectArmyBattleOptions\n} = require('../runtime/army-roster.cjs');",
    "  createRuntimeArmy,\n  validateRuntimeArmy,\n  runtimeSelectionFromArmy\n} = require('../runtime/army-roster.cjs');\nconst { projectIronMarchesBattleOptions } = require('../runtime/iron-marches-mechanics.cjs');",
    'browser mechanics import');
  source = replaceOnce(source,
    '  const battleProjector = (battleOptions) => projectArmyBattleOptions(battleOptions, army);',
    '  const battleProjector = (battleOptions) => projectIronMarchesBattleOptions(battleOptions, army);',
    'browser mechanics projector');
  write('src/browser/iron-marches-browser-host.cjs', source);
}

function patchPresenter() {
  let source = read('game/js/vertical-slice-presenter.mjs');
  source = replaceOnce(source,
    "  if (command.type === 'DeployReserve') return `Резерв: ${payload.entryId} → ${payload.square}`;\n  return command.type;",
    "  if (command.type === 'DeployReserve') return `Резерв: ${payload.entryId} → ${payload.square}`;\n  if (command.type === 'UseAbility') {\n    const name = payload.abilityId === 'ability.circle_warding' ? 'Круг защиты' : payload.abilityId;\n    return `${name} → ${payload.targetSquare || payload.targetId} · ${payload.effectiveOrderCost ?? payload.baseOrderCost ?? 0} ОП`;\n  }\n  return command.type;",
    'presenter ability label');
  source = replaceOnce(source,
    "    const moveCommands = scenario.legalCommands.filter((command) => command.type === 'MovePiece');\n    const commands = moveCommands.map((command, index) => `<button class=\"rpvs__action\" data-move-command-index=\"${index}\">${escapeHtml(commandLabel(command))}</button>`).join('');",
    "    const moveCommands = scenario.legalCommands.filter((command) => command.type === 'MovePiece');\n    const commands = moveCommands.map((command, index) => `<button class=\"rpvs__action\" data-move-command-index=\"${index}\">${escapeHtml(commandLabel(command))}</button>`).join('');\n    const abilityCommands = scenario.legalCommands.filter((command) => command.type === 'UseAbility');\n    const abilityButtons = abilityCommands.map((command, index) => `<button class=\"rpvs__action\" data-ability-command-index=\"${index}\">${escapeHtml(commandLabel(command))}</button>`).join('');",
    'presenter ability commands');
  source = replaceOnce(source,
    "    const reserveSection = playerReserve.length ? `<section class=\"rpvs__sidebar-section\"><h3>Резерв</h3><div class=\"rpvs__order\"><span>Очки приказа</span><strong>${order.current} / ${order.max}</strong></div><div class=\"rpvs__reserve\">${reserveCards}</div>${this.selectedReserveEntryId ? '<div class=\"rpvs__reserve-hint\">Выберите подсвеченную клетку ввода на доске.</div>' : ''}</section>` : '';\n    const sidebar = `<div class=\"rpvs__panel-head\"><h2 class=\"rpvs__title\">Задачи</h2></div><div class=\"rpvs__panel-body\"><section class=\"rpvs__sidebar-section\"><div class=\"rpvs__list\">${objectives}</div></section>${failures ? `<section class=\"rpvs__sidebar-section\"><h3>Поражение</h3><div class=\"rpvs__list\">${failures}</div></section>` : ''}${reserveSection}<section class=\"rpvs__sidebar-section\"><h3>Ходы фигур</h3><div class=\"rpvs__commands\">${commands || '<div class=\"rpvs__muted\">Выберите фигуру на доске или ожидайте противника</div>'}</div></section></div>`;",
    "    const reserveSection = playerReserve.length ? `<section class=\"rpvs__sidebar-section\"><h3>Резерв</h3><div class=\"rpvs__order\"><span>Очки приказа</span><strong>${order.current} / ${order.max}</strong></div><div class=\"rpvs__reserve\">${reserveCards}</div>${this.selectedReserveEntryId ? '<div class=\"rpvs__reserve-hint\">Выберите подсвеченную клетку ввода на доске.</div>' : ''}</section>` : '';\n    const abilitySection = abilityButtons ? `<section class=\"rpvs__sidebar-section\"><h3>Способности</h3><div class=\"rpvs__order\"><span>Очки приказа</span><strong>${order.current} / ${order.max}</strong></div><div class=\"rpvs__commands\">${abilityButtons}</div></section>` : '';\n    const sidebar = `<div class=\"rpvs__panel-head\"><h2 class=\"rpvs__title\">Задачи</h2></div><div class=\"rpvs__panel-body\"><section class=\"rpvs__sidebar-section\"><div class=\"rpvs__list\">${objectives}</div></section>${failures ? `<section class=\"rpvs__sidebar-section\"><h3>Поражение</h3><div class=\"rpvs__list\">${failures}</div></section>` : ''}${reserveSection}${abilitySection}<section class=\"rpvs__sidebar-section\"><h3>Ходы фигур</h3><div class=\"rpvs__commands\">${commands || '<div class=\"rpvs__muted\">Выберите фигуру на доске или ожидайте противника</div>'}</div></section></div>`;",
    'presenter ability section');
  source = replaceOnce(source,
    "    for (const button of this.root.querySelectorAll('[data-reserve-entry]')) {",
    "    for (const button of this.root.querySelectorAll('[data-ability-command-index]')) {\n      button.addEventListener('click', () => {\n        const command = abilityCommands[Number(button.dataset.abilityCommandIndex)];\n        this.selectedSquare = null;\n        this.selectedReserveEntryId = null;\n        this.client.dispatch({ type: 'PlayerCommand', request: command }).catch(() => {});\n      });\n    }\n    for (const button of this.root.querySelectorAll('[data-reserve-entry]')) {",
    'presenter ability listener');
  write('game/js/vertical-slice-presenter.mjs', source);
}

function patchAuditReport() {
  const relativePath = 'content/audits/iron_marches_mechanics_readiness.json';
  const report = JSON.parse(read(relativePath));
  const byId = new Map(report.relicEffects.map((record) => [record.id, record]));
  Object.assign(byId.get('effect.ward_first_capture'), {
    status: 'IMPLEMENTED',
    uiAvailability: 'enabled',
    reason: 'Канонический владелец Эхо-щита автоматически получает ward при создании каждого production-боя; перехват взятия, расходование, сохранение и replay исполняются детерминированно.',
    evidence: [
      { path: 'src/runtime/iron-marches-mechanics.cjs', tokens: ['ECHO_SHIELD', 'addStartingWard', 'effect.ward_first_capture'] },
      { path: 'src/combat/ward-protection.cjs', tokens: ['executeWardAwareCommand', 'CapturePrevented'] },
      { path: 'tests/iron-marches-abilities.cjs', tokens: ['Echo Shield', 'aldric_role', "statusFor(battle.statuses, 'aldric_role')"] },
      { path: 'tests/ward-protection.cjs', tokens: ['CapturePrevented', 'ward'] }
    ]
  });
  Object.assign(byId.get('effect.place_adjacent_ward'), {
    status: 'IMPLEMENTED',
    uiAvailability: 'enabled',
    reason: 'Круг защиты исполняется как проверяемая команда UseAbility: один приказ, один раз за бой, ортогонально соседняя союзная не-королевская цель без другого primary-статуса.',
    evidence: [
      { path: 'src/combat/abilities.cjs', tokens: ['place_adjacent_ward', 'UseAbility', 'StatusApplied'] },
      { path: 'src/runtime/iron-marches-mechanics.cjs', tokens: ['CIRCLE_WARDING', 'ability.circle_warding'] },
      { path: 'tests/iron-marches-abilities.cjs', tokens: ['Circle Warding', 'effectiveOrderCost', 'AbilityUsed'] },
      { path: 'game/js/vertical-slice-presenter.mjs', tokens: ['data-ability-command-index', 'Способности'] }
    ]
  });
  Object.assign(byId.get('effect.first_ability_order_discount'), {
    status: 'PARTIAL',
    uiAvailability: 'limited',
    reason: 'Общий детерминированный модификатор уже уменьшает стоимость первой способности владельца и расходуется, но уникальная способность Томаса пока не реализована и поэтому production-триггер ещё недоступен игроку.',
    evidence: [
      { path: 'src/combat/abilities.cjs', tokens: ['FIRST_ABILITY_DISCOUNT', 'effectiveOrderCost', 'RelicEffectConsumed'] },
      { path: 'src/runtime/iron-marches-mechanics.cjs', tokens: ['TWIN_COMMAND', 'effect.first_ability_order_discount'] },
      { path: 'tests/iron-marches-abilities.cjs', tokens: ['Twin Command', 'consumed', 'effectiveOrderCost'] }
    ]
  });
  write(relativePath, `${JSON.stringify(report, null, 2)}\n`);
}

function patchReadinessModule() {
  let source = read('game/js/iron-marches-mechanics-readiness.mjs');
  source = replaceOnce(source,
    "    status: 'PARTIAL',\n    availability: 'limited',\n    note: 'Перехват статуса ward работает, но автоматическая выдача ward от реликвии ещё не подключена.'",
    "    status: 'IMPLEMENTED',\n    availability: 'enabled',\n    note: 'Владелец автоматически получает ward в начале production-боя; первое взятие предотвращается и расходует защиту.'",
    'Echo Shield readiness');
  source = replaceOnce(source,
    "    status: 'DECLARATIVE',\n    availability: 'disabled',\n    note: 'Нет команды, стоимости и выбора защищаемой фигуры.'",
    "    status: 'IMPLEMENTED',\n    availability: 'enabled',\n    note: 'Работает как UseAbility: один приказ, один раз за бой, соседняя союзная не-королевская цель.'",
    'Circle Warding readiness');
  source = replaceOnce(source,
    "    status: 'DECLARATIVE',\n    availability: 'disabled',\n    note: 'Зависит от общего контура активных способностей.'",
    "    status: 'PARTIAL',\n    availability: 'limited',\n    note: 'Скидка и её расходование работают в общем контуре; способность Томаса ещё не подключена.'",
    'Twin Command readiness');
  write('game/js/iron-marches-mechanics-readiness.mjs', source);
}

function patchAuditScript() {
  let source = read('scripts/audit-iron-marches-mechanics.cjs');
  source = replaceOnce(source,
    "  const presenterBridge = fs.readFileSync(path.join(ROOT, 'src/runtime/presenter-bridge.cjs'), 'utf8');\n  const browserClient = fs.readFileSync(path.join(ROOT, 'game/js/runtime-command-client.mjs'), 'utf8');\n  assert(!presenterBridge.includes(\"'UseAbility'\"), 'UseAbility must not be exposed before an executable contract exists');\n  assert(!browserClient.includes(\"'UseAbility'\"), 'browser client must not advertise an unavailable ability command');",
    "  const battleCore = fs.readFileSync(path.join(ROOT, 'src/combat/battle.cjs'), 'utf8');\n  const abilityCore = fs.readFileSync(path.join(ROOT, 'src/combat/abilities.cjs'), 'utf8');\n  const browserPresenter = fs.readFileSync(path.join(ROOT, 'game/js/vertical-slice-presenter.mjs'), 'utf8');\n  assert(battleCore.includes(\"'UseAbility'\"), 'battle core must expose the executable UseAbility command');\n  assert(abilityCore.includes('normalizeAbilityRequest'), 'ability targets must be normalized against the legal command set');\n  assert(browserPresenter.includes('data-ability-command-index'), 'browser presenter must expose executable ability choices');",
    'mechanics audit executable command');
  write('scripts/audit-iron-marches-mechanics.cjs', source);
}

function patchReadinessTest() {
  let source = read('tests/iron-marches-mechanics-readiness.cjs');
  source = replaceOnce(source,
    "  assert.strictEqual(summary.counts.PARTIAL, 1);\n  assert.strictEqual(summary.counts.DECLARATIVE, 11);\n  assert.strictEqual(summary.counts.IMPLEMENTED, 0);",
    "  assert.strictEqual(summary.counts.PARTIAL, 1);\n  assert.strictEqual(summary.counts.DECLARATIVE, 9);\n  assert.strictEqual(summary.counts.IMPLEMENTED, 2);",
    'readiness counts');
  source = replaceOnce(source,
    "  assert.strictEqual(readiness.relicMechanicReadiness('relic.echo_shield').status, 'PARTIAL');",
    "  assert.strictEqual(readiness.relicMechanicReadiness('relic.echo_shield').status, 'IMPLEMENTED');\n  assert.strictEqual(readiness.relicMechanicReadiness('relic.circle_warding').status, 'IMPLEMENTED');\n  assert.strictEqual(readiness.relicMechanicReadiness('relic.twin_command').status, 'PARTIAL');",
    'readiness statuses');
  source = replaceOnce(source,
    "  assert.strictEqual(readiness.heroMechanicsSummary('hero.aldric_wall', ['relic.echo_shield']).relics[0].status, 'PARTIAL');",
    "  assert.strictEqual(readiness.heroMechanicsSummary('hero.aldric_wall', ['relic.echo_shield']).relics[0].status, 'IMPLEMENTED');",
    'readiness summary');
  source = replaceOnce(source,
    "  assert.ok(markup.includes('Частично подключено'));",
    "  assert.ok(markup.includes('Работает'));",
    'readiness markup');
  write('tests/iron-marches-mechanics-readiness.cjs', source);
}

function patchPackage() {
  const relativePath = 'package.json';
  const packageJson = JSON.parse(read(relativePath));
  const marker = 'node tests/iron-marches-mechanics-readiness.cjs';
  if (!packageJson.scripts.test.includes('node tests/iron-marches-abilities.cjs')) {
    if (!packageJson.scripts.test.includes(marker)) throw new Error('package test marker missing');
    packageJson.scripts.test = packageJson.scripts.test.replace(marker, `${marker} && node tests/iron-marches-abilities.cjs`);
  }
  write(relativePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

patchBattle();
patchBrowserHost();
patchPresenter();
patchAuditReport();
patchReadinessModule();
patchAuditScript();
patchReadinessTest();
patchPackage();

console.log('First executable Iron Marches mechanics package applied.');
