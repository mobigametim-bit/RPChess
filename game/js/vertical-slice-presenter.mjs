import {
  buildBrowserBoardPlan,
  resizeCanvasForDisplay,
  TileImageCache,
  renderModularBoard
} from './modular-board-renderer.mjs';
import { validatePresenterSnapshot } from './runtime-command-client.mjs';
import {
  CORE_ASSETS,
  regionAssets,
  sceneAsset,
  effectForBattleEvent
} from './register-01-assets.mjs';
import { nodeArt, sceneArt as approvedSceneArt, unitArt, humanFailure, humanObjective } from './approved-shell-data.mjs';

const PIECE_GLYPHS = Object.freeze({
  w: Object.freeze({ k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }),
  b: Object.freeze({ k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' })
});

const NODE_GLYPHS = Object.freeze({
  start: '⌂', battle: '⚔', elite: '♛', event: '✦', shop: '¤', service: '⚒', treasure: '◆', boss: '♚'
});

const ENVIRONMENT_GLYPHS = Object.freeze({
  blocker: '▰', portal: '◉', altar: '✧', hazard: '△', objective: '◎', seal: '✥'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function cssUrl(value) {
  return `url("${String(value || '').replace(/["\\\n\r]/g, '')}")`;
}

function pieceGlyph(piece) {
  return PIECE_GLYPHS[piece?.side]?.[piece?.type] || '?';
}


const NODE_TYPE_LABELS = Object.freeze({
  start: 'Начало пути', battle: 'Сражение', elite: 'Элитный бой', event: 'Событие', shop: 'Лавка', service: 'Служба снабжения', treasure: 'Сокровищница', boss: 'Железный Регент'
});

function nodeDisplayLabel(node = {}) {
  const raw = String(node.label || '').trim();
  const technical = !raw || raw === node.type || ['start', 'battle', 'elite', 'event', 'shop', 'service', 'treasure', 'boss', 'unknown'].includes(raw.toLowerCase());
  return technical ? (NODE_TYPE_LABELS[node.type] || 'Неизведанный путь') : raw;
}

function rewardArt(kind) {
  const map = { gold: 'gold', supplies: 'heal', meta: 'meta' };
  return `generated_assets/reward_${map[kind] || kind}.png`;
}

function drawWarriorPiece(context, rect, piece, assetCache) {
  const source = unitArt(piece);
  const cached = source ? assetCache.get(source) : null;
  context.save();
  if (cached?.status === 'ready' && cached.image) {
    const inset = rect.size * .035;
    context.shadowColor = 'rgba(0,0,0,.72)';
    context.shadowBlur = rect.size * .09;
    context.shadowOffsetY = rect.size * .055;
    context.drawImage(cached.image, rect.x + inset, rect.y + inset, rect.size - inset * 2, rect.size - inset * 2);
  } else {
    context.fillStyle = piece.side === 'w' ? '#f3e5c1' : '#24334a';
    context.beginPath();
    context.arc(rect.x + rect.size / 2, rect.y + rect.size / 2, rect.size * .34, 0, Math.PI * 2);
    context.fill();
  }
  const glyph = pieceGlyph(piece);
  const glyphSize = Math.max(13, Math.floor(rect.size * .24));
  const cx = rect.x + rect.size / 2;
  const cy = rect.y + rect.size * .885;
  context.shadowColor = 'transparent';
  context.fillStyle = 'rgba(4,8,14,.88)';
  context.beginPath();
  context.roundRect?.(cx - glyphSize * .72, cy - glyphSize * .64, glyphSize * 1.44, glyphSize * 1.02, glyphSize * .28);
  if (context.roundRect) context.fill();
  else context.fillRect(cx - glyphSize * .72, cy - glyphSize * .64, glyphSize * 1.44, glyphSize * 1.02);
  context.fillStyle = piece.side === 'w' ? '#fff4d2' : '#e2ecff';
  context.strokeStyle = '#05080d';
  context.lineWidth = Math.max(1, glyphSize * .08);
  context.font = `700 ${glyphSize}px Georgia,serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.strokeText(glyph, cx, cy - glyphSize * .04);
  context.fillText(glyph, cx, cy - glyphSize * .04);
  if (piece.status) {
    context.fillStyle = '#f3bf51';
    context.beginPath();
    context.arc(rect.x + rect.size * .82, rect.y + rect.size * .18, rect.size * .085, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function commandLabel(command) {
  const payload = command.payload || {};
  if (command.type === 'MovePiece') return `${payload.from} → ${payload.to}${payload.promotion ? ` = ${payload.promotion.toUpperCase()}` : ''}`;
  if (command.type === 'DeployReserve') return `Резерв: ${payload.entryId} → ${payload.square}`;
  if (command.type === 'UseAbility') {
    const names = {
      'ability.circle_warding': 'Круг защиты',
      'ability.interpose': 'Перехват',
      'ability.chain_formation': 'Цепное построение',
      'ability.forge_line': 'Линия кузни',
      'ability.previewed_charge': 'Предсказанный натиск',
      'ability.hostage_tactic': 'Тактика заложника',
      'ability.gate_command': 'Команда ворот',
      'ability.royal_decree': 'Королевский указ',
      'ability.oath_fallen': 'Клятва павших'
    };
    const name = names[payload.abilityId] || payload.abilityId;
    const target = payload.via && payload.to ? `${payload.via} → ${payload.to}` : payload.targetSquare || payload.to || payload.targetId;
    return `${name} → ${target} · ${payload.effectiveOrderCost ?? payload.baseOrderCost ?? 0} ОП`;
  }
  return command.type;
}

function groupNodesByLayer(nodes) {
  const groups = new Map();
  for (const node of nodes || []) {
    if (!groups.has(node.layer)) groups.set(node.layer, []);
    groups.get(node.layer).push(node);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([layer, values]) => ({
    layer,
    nodes: values.slice().sort((a, b) => a.id.localeCompare(b.id))
  }));
}

function legalTargets(scenario, selectedSquare) {
  if (!scenario || !selectedSquare) return new Map();
  const targets = new Map();
  for (const command of scenario.legalCommands || []) {
    if (command.type === 'MovePiece' && command.payload.from === selectedSquare) {
      const current = targets.get(command.payload.to) || [];
      current.push(command);
      targets.set(command.payload.to, current);
    }
  }
  return targets;
}

function reserveTargets(scenario, selectedReserveEntryId) {
  if (!scenario || !selectedReserveEntryId) return new Map();
  const targets = new Map();
  for (const command of scenario.legalCommands || []) {
    if (command.type === 'DeployReserve' && command.payload.entryId === selectedReserveEntryId) {
      targets.set(command.payload.square, command);
    }
  }
  return targets;
}

function sceneStyle(source, extra = '') {
  if (!source) return extra;
  return `background-image:linear-gradient(90deg,rgba(5,9,16,.92) 0%,rgba(5,9,16,.68) 44%,rgba(5,9,16,.25) 100%),${cssUrl(source)};${extra}`;
}

function createPresenterStyles() {
  return `
    .rpvs{--rpvs-focus:${cssUrl(CORE_ASSETS.focusRing)};min-height:100%;box-sizing:border-box;padding:18px;color:#f4ead6;background:#080d16 center/cover fixed no-repeat;font:16px/1.4 system-ui,sans-serif}
    .rpvs *{box-sizing:border-box}.rpvs button{font:inherit;position:relative}.rpvs button:focus-visible,.rpvs canvas:focus-visible{outline:3px solid #78c9ff;outline-offset:4px}.rpvs button:focus-visible::after{content:"";position:absolute;inset:-9px;z-index:4;pointer-events:none;background:var(--rpvs-focus) center/100% 100% no-repeat}
    .rpvs__top{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:0 auto 14px;max-width:1400px;padding:12px 16px;border:1px solid rgba(190,157,80,.45);border-radius:15px;background:rgba(7,12,21,.82);backdrop-filter:blur(7px)}
    .rpvs__identity{display:flex;align-items:center;gap:12px}.rpvs__crest{width:52px;height:52px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.55))}.rpvs__brand{font:700 24px/1.1 Georgia,serif;letter-spacing:.04em}.rpvs__resources{display:flex;gap:8px;flex-wrap:wrap}.rpvs__chip{padding:7px 11px;border:1px solid #8d7745;border-radius:999px;background:#151f31;color:#f7e7b0}
    .rpvs__layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;max-width:1400px;margin:auto}.rpvs__panel{border:1px solid #73633f;border-radius:16px;background:rgba(11,18,29,.92);box-shadow:0 18px 50px rgba(0,0,0,.36);overflow:hidden}.rpvs__panel--scene{background-position:center;background-size:cover;background-repeat:no-repeat}
    .rpvs__panel-head{padding:13px 16px;border-bottom:1px solid rgba(174,147,82,.35);display:flex;justify-content:space-between;align-items:center;gap:10px;background:rgba(8,14,24,.78)}.rpvs__panel-body{padding:16px}.rpvs__title{margin:0;font:700 20px/1.2 Georgia,serif}.rpvs__muted{color:#aab4c4;font-size:14px}
    .rpvs__map{display:flex;gap:26px;align-items:stretch;min-height:520px;overflow:auto;padding:32px;background-position:center;background-size:cover}.rpvs__layer{display:flex;flex-direction:column;justify-content:space-around;gap:18px;min-width:150px}.rpvs__node{position:relative;min-height:84px;padding:11px;border:1px solid #4b5a72;border-radius:13px;background:rgba(11,20,34,.9);color:#e9edf4;text-align:left;backdrop-filter:blur(4px)}.rpvs__node[disabled]{opacity:.48}.rpvs__node--current{border-color:#e1b85d;box-shadow:0 0 0 2px rgba(225,184,93,.25)}.rpvs__node--visited{background:rgba(21,44,48,.9)}.rpvs__node--route{cursor:pointer}.rpvs__node--route:hover{border-color:#7fc7ff}.rpvs__node-icon{font-size:24px;display:block}.rpvs__cost{display:block;margin-top:5px;color:#f4cc75;font-size:13px}
    .rpvs__board-wrap{position:relative;min-height:620px;background-position:center;background-size:cover;isolation:isolate}.rpvs__board-wrap::before{content:"";position:absolute;inset:0;background:rgba(3,7,13,.48);z-index:-1}.rpvs__canvas{display:block;width:100%;height:620px;touch-action:none;outline:none}.rpvs__check{display:flex;align-items:center;gap:7px;color:#ffdf8e;font-weight:700}.rpvs__check img{width:34px;height:34px;object-fit:contain}
    .rpvs__sidebar-section+ .rpvs__sidebar-section{border-top:1px solid rgba(174,147,82,.25);margin-top:14px;padding-top:14px}.rpvs__list{display:grid;gap:8px}.rpvs__item{padding:10px;border-radius:10px;background:rgba(18,28,43,.92);border:1px solid #2f415d}.rpvs__item--done{border-color:#5b9e73}.rpvs__item--danger{border-color:#9f5151}.rpvs__progress{height:6px;margin-top:7px;border-radius:999px;background:#273347;overflow:hidden}.rpvs__progress>span{display:block;height:100%;background:#d7b65a}
    .rpvs__commands{display:grid;gap:7px;max-height:320px;overflow:auto}.rpvs__action,.rpvs__choice{padding:10px 12px;border:1px solid #6b7d99;border-radius:9px;background:rgba(24,38,58,.94);color:#f4ead6;cursor:pointer;text-align:left}.rpvs__action:hover,.rpvs__choice:hover{border-color:#79c9ff}.rpvs__primary{width:100%;padding:13px;border:1px solid #d2ab52;border-radius:10px;background:linear-gradient(#6b5220,#47340f);color:#fff2c7;font-weight:700;cursor:pointer}
    .rpvs__deployment-units{display:grid;gap:8px}.rpvs__deployment-unit{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;padding:9px;border:1px solid #526885;border-radius:10px;background:#142239;color:#f4ead6;text-align:left;cursor:pointer}.rpvs__deployment-unit[aria-pressed=true]{border-color:#f2cf76;box-shadow:0 0 0 2px rgba(242,207,118,.22) inset}.rpvs__deployment-unit[disabled]{opacity:.55;cursor:not-allowed}.rpvs__deployment-remove{padding:7px;border:1px solid #985858;border-radius:8px;background:#3b1d25;color:#ffd8d8;cursor:pointer}.rpvs__deployment-budget{display:flex;justify-content:space-between;margin-bottom:10px;padding:10px;border:1px solid #8d7745;border-radius:10px;background:#111d30}.rpvs__deployment-help{color:#a8c8a8;font-size:13px}
    .rpvs__order{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:9px 11px;border:1px solid #8d7745;border-radius:10px;background:#111d30}.rpvs__order strong{color:#f2cf76;font-size:20px}.rpvs__reserve{display:grid;gap:8px}.rpvs__reserve-card{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;width:100%;padding:9px;border:1px solid #526885;border-radius:10px;background:#142239;color:#f4ead6;text-align:left;cursor:pointer}.rpvs__reserve-card[disabled]{opacity:.48;cursor:not-allowed}.rpvs__reserve-card[aria-pressed=true]{border-color:#f2cf76;box-shadow:0 0 0 2px rgba(242,207,118,.22) inset}.rpvs__reserve-piece{display:grid;place-items:center;width:42px;height:42px;border-radius:8px;background:#08111f;font:30px Georgia,serif}.rpvs__reserve-meta{display:grid}.rpvs__reserve-cost{color:#f2cf76;font-weight:800}.rpvs__reserve-hint{margin-top:8px;color:#9fca9f;font-size:13px}
    .rpvs__center{position:relative;min-height:560px;display:grid;place-items:center;padding:34px;text-align:center;background-position:center;background-size:cover}.rpvs__center-card{position:relative;z-index:2;max-width:720px;padding:24px;border:1px solid rgba(194,159,78,.65);border-radius:17px;background:rgba(7,12,21,.84);box-shadow:0 18px 48px rgba(0,0,0,.4);backdrop-filter:blur(8px)}.rpvs__event-copy{font-size:18px;white-space:pre-line}.rpvs__choice-list{display:grid;gap:10px;margin-top:20px}.rpvs__reward-grid{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:22px 0}.rpvs__reward{min-width:110px;padding:18px;border:1px solid #9b8045;border-radius:14px;background:#19243a}.rpvs__reward b{display:block;font-size:26px;color:#f2cf76}
    .rpvs__board-vfx,.rpvs__scene-vfx{position:absolute;z-index:8;pointer-events:none;background-repeat:no-repeat;filter:drop-shadow(0 0 12px rgba(255,210,110,.55))}.rpvs__scene-vfx{left:50%;top:50%;width:230px;height:230px;transform:translate(-50%,-50%)}
    .rpvs__env-sheet{width:100%;aspect-ratio:1;object-fit:contain;border-radius:10px;background:#09111d}.rpvs__toast{position:fixed;right:20px;bottom:20px;max-width:420px;padding:12px 15px;border-radius:10px;background:#151d2a;border:1px solid #9f5151;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:10}.rpvs__busy{opacity:.65;pointer-events:none}
    @media(max-width:980px){.rpvs__layout{grid-template-columns:1fr}.rpvs__board-wrap,.rpvs__canvas{min-height:520px;height:520px}.rpvs__map{min-height:420px}.rpvs__top{align-items:flex-start;flex-direction:column}.rpvs__identity{align-items:flex-start}}
    @media(prefers-reduced-motion:reduce){.rpvs *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
  `;
}

class VerticalSlicePresenter {
  constructor(options = {}) {
    if (!options.root || typeof options.root.appendChild !== 'function') throw new Error('VerticalSlicePresenter requires a root element');
    if (!options.client || typeof options.client.dispatch !== 'function') throw new Error('VerticalSlicePresenter requires a RuntimeCommandClient');
    this.root = options.root;
    this.client = options.client;
    this.assetCache = options.assetCache || new TileImageCache();
    this.selectedSquare = null;
    this.selectedReserveEntryId = null;
    this.selectedDeploymentUnitId = null;
    this.boardPlan = null;
    this.boardReport = null;
    this.resizeObserver = null;
    this.busy = false;
    this.lastSnapshot = null;
    this.pendingEffect = null;
    this.lastEffectEventId = null;
    this.effectFrameRequest = null;
    this.onSnapshot = (event) => this.render(event.detail);
    this.onPending = (event) => { this.busy = Boolean(event.detail.pending); this.root.classList.toggle('rpvs__busy', this.busy); };
    this.onError = (event) => this.showError(event.detail.error);
    this.client.addEventListener('snapshot', this.onSnapshot);
    this.client.addEventListener('pending', this.onPending);
    this.client.addEventListener('error', this.onError);
    this.installStyles();
    if (this.client.getSnapshot()) this.render(this.client.getSnapshot());
  }

  installStyles() {
    if (this.root.ownerDocument.getElementById('rpvs-presenter-styles')) return;
    const style = this.root.ownerDocument.createElement('style');
    style.id = 'rpvs-presenter-styles';
    style.textContent = createPresenterStyles();
    this.root.ownerDocument.head.appendChild(style);
  }

  destroy() {
    this.client.removeEventListener('snapshot', this.onSnapshot);
    this.client.removeEventListener('pending', this.onPending);
    this.client.removeEventListener('error', this.onError);
    this.resizeObserver?.disconnect();
    if (this.effectFrameRequest) (globalThis.cancelAnimationFrame || clearTimeout)(this.effectFrameRequest);
    this.root.replaceChildren();
  }

  shell(snapshot, main, sidebar = '') {
    const region = regionAssets(snapshot.campaign.regionId);
    const banner = region?.mapBanner;
    const regionLabel = snapshot.campaign.regionId === 'region.iron_marches' ? 'Железные Марши' : snapshot.campaign.regionId;
    const layoutClass = sidebar ? '' : ' rpvs__layout--single';
    return `
      <section class="rpvs" aria-label="RPChess" style="${banner ? `background-image:linear-gradient(rgba(4,8,14,.78),rgba(4,8,14,.9)),${cssUrl(banner)}` : ''}">
        <header class="rpvs__top">
          <div class="rpvs__identity"><img class="rpvs__crest" src="generated_assets/logo_main.png" alt=""><div><div class="rpvs__brand">RPChess</div><div class="rpvs__muted">${escapeHtml(regionLabel)} · Акт ${snapshot.campaign.act}</div></div></div>
          <div class="rpvs__resources" aria-label="Ресурсы"><span class="rpvs__chip">Золото · ${snapshot.resources.gold}</span><span class="rpvs__chip">Припасы · ${snapshot.resources.supplies}</span><span class="rpvs__chip">Мета · ${snapshot.resources.meta}</span><button class="rpvs__chip rpa-runtime-menu" data-runtime-menu aria-label="Главное меню">☰ Меню</button></div>
        </header>
        <div class="rpvs__layout${layoutClass}"><main class="rpvs__panel rpvs__panel--scene">${main}</main>${sidebar ? `<aside class="rpvs__panel">${sidebar}</aside>` : ''}</div>
      </section>`;
  }

  queueEffect(snapshot) {
    const events = snapshot.scenario?.recentBattleEvents || [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const effect = effectForBattleEvent(events[index], snapshot.scenario);
      if (!effect || !effect.eventId || effect.eventId === this.lastEffectEventId) continue;
      this.lastEffectEventId = effect.eventId;
      this.pendingEffect = effect;
      return;
    }
  }

  render(snapshotInput) {
    const snapshot = validatePresenterSnapshot(snapshotInput);
    this.lastSnapshot = snapshot;
    this.queueEffect(snapshot);
    this.selectedSquare = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedSquare : null;
    this.selectedReserveEntryId = ['scenario', 'boss'].includes(snapshot.status) ? this.selectedReserveEntryId : null;
    this.selectedDeploymentUnitId = snapshot.status === 'deployment' ? this.selectedDeploymentUnitId : null;
    this.resizeObserver?.disconnect();
    if (snapshot.status === 'campaign') this.renderCampaign(snapshot);
    else if (snapshot.status === 'event') this.renderEvent(snapshot);
    else if (snapshot.status === 'deployment') this.renderDeployment(snapshot);
    else if (['scenario', 'boss'].includes(snapshot.status)) this.renderScenario(snapshot);
    else if (snapshot.status === 'boss_transition') this.renderBossTransition(snapshot);
    else if (snapshot.status === 'reward') this.renderReward(snapshot);
    else this.renderTerminal(snapshot);
  }

  renderCampaign(snapshot) {
    const routeByNode = new Map(snapshot.campaign.routes.map((route) => [route.to, route]));
    const layers = groupNodesByLayer(snapshot.campaign.nodes);
    const map = `<div class="rpvs__panel-head"><h1 class="rpvs__title">Карта похода</h1><span class="rpvs__muted">Разведано путей: ${snapshot.campaign.scouting}</span></div><div class="rpvs__map">${layers.map((group) => `<div class="rpvs__layer" data-layer="${group.layer}">${group.nodes.map((node) => {
      const route = routeByNode.get(node.id);
      const enabled = Boolean(route?.affordable);
      const classes = ['rpvs__node', node.current ? 'rpvs__node--current' : '', node.visited ? 'rpvs__node--visited' : '', route ? 'rpvs__node--route' : ''].filter(Boolean).join(' ');
      const label = nodeDisplayLabel(node);
      return `<button class="${classes}" data-node-id="${escapeAttribute(node.id)}" ${route && enabled ? '' : 'disabled'} aria-label="${escapeAttribute(label)}"><img class="rpvs__node-art" src="${escapeAttribute(nodeArt(node.type))}" alt=""><span><strong>${escapeHtml(label)}</strong>${route ? `<span class="rpvs__cost">${route.affordable ? `Потратить припасы: ${route.cost}` : `Нужно припасов: ${route.cost}`}</span>` : node.current ? '<span class="rpvs__cost">Вы находитесь здесь</span>' : ''}</span></button>`;
    }).join('')}</div>`).join('')}</div>`;
    this.root.innerHTML = this.shell(snapshot, map);
    for (const button of this.root.querySelectorAll('[data-node-id]:not([disabled])')) button.addEventListener('click', () => this.client.dispatch({ type: 'Travel', targetNodeId: button.dataset.nodeId }).catch(() => {}));
  }

  renderEvent(snapshot) {
    const event = snapshot.event;
    const choices = event.choices.map((choice) => `<button class="rpvs__choice" data-choice-id="${escapeAttribute(choice.id)}"><strong>${escapeHtml(choice.label)}</strong></button>`).join('');
    const main = `<div class="rpvs__event-stage"><div class="rpvs__event-copy-panel"><div class="rpa-eyebrow">СЮЖЕТНОЕ СОБЫТИЕ</div><h1>${escapeHtml(event.title)}</h1><p class="rpvs__event-copy">${escapeHtml(event.body)}</p><div class="rpvs__choice-list">${choices}</div></div><div class="rpvs__event-art-space" aria-hidden="true"></div></div>`;
    this.root.innerHTML = this.shell(snapshot, main);
    for (const button of this.root.querySelectorAll('[data-choice-id]')) button.addEventListener('click', () => this.client.dispatch({ type: 'ChooseEvent', choiceId: button.dataset.choiceId }).catch(() => {}));
  }

  renderDeployment(snapshot) {
    const deployment = snapshot.deployment;
    const scenario = snapshot.scenario;
    const art = sceneAsset(snapshot, snapshot.currentNode?.type === 'elite' ? 'elite' : 'battle');
    if (this.selectedDeploymentUnitId && !deployment.units.some((unit) => unit.id === this.selectedDeploymentUnitId && !unit.fixed)) this.selectedDeploymentUnitId = null;
    const units = deployment.units.map((unit) => {
      const selected = unit.id === this.selectedDeploymentUnitId;
      const location = unit.square || 'резерв';
      return `<div class="rpvs__deployment-unit" role="button" tabindex="${unit.fixed ? -1 : 0}" aria-pressed="${selected}" data-deployment-unit="${escapeAttribute(unit.id)}" ${unit.fixed ? 'aria-disabled="true"' : ''}><span class="rpvs__reserve-piece"><img src="${escapeAttribute(unitArt({ side: deployment.playerSide, type: unit.type }))}" alt=""><small>${escapeHtml(pieceGlyph({ side: deployment.playerSide, type: unit.type }))}</small></span><span><strong>${escapeHtml(unit.label)}</strong><small class="rpvs__muted">${escapeHtml(location)} · ${unit.commandCost} ком.</small></span>${!unit.fixed && unit.square ? `<button class="rpvs__deployment-remove" data-deployment-remove="${escapeAttribute(unit.id)}">В резерв</button>` : ''}</div>`;
    }).join('');
    const main = `<div class="rpvs__panel-head"><h1 class="rpvs__title">Расстановка армии</h1><span class="rpvs__muted">Выберите фигуру, затем клетку стартовой зоны</span></div><div class="rpvs__board-wrap" style="${sceneStyle(art)}"><canvas class="rpvs__canvas" data-deployment-board tabindex="0" aria-label="Поле расстановки"></canvas></div>`;
    const sidebar = `<div class="rpvs__panel-head"><h2 class="rpvs__title">Состав</h2></div><div class="rpvs__panel-body"><div class="rpvs__deployment-budget"><span>Командование</span><strong>${deployment.commandSpent} / ${deployment.commandLimit}</strong></div><div class="rpvs__deployment-units">${units}</div><p class="rpvs__deployment-help">Обязательные фигуры должны оставаться на поле. Неразмещённые необязательные фигуры переходят в резерв.</p><button class="rpvs__primary" data-confirm-deployment ${deployment.canConfirm ? '' : 'disabled'}>Подтвердить расстановку</button></div>`;
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
    this.assetCache.prime([scenario.board.tileSet.light, scenario.board.tileSet.dark, CORE_ASSETS.neutralBoard.blocker, CORE_ASSETS.neutralBoard.startZone, CORE_ASSETS.focusRing, ...deployment.units.map((unit) => unitArt({ side: deployment.playerSide, type: unit.type })).filter(Boolean), ...scenario.pieces.map(unitArt).filter(Boolean)]);
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
          drawWarriorPiece(context, rect, unit, this.assetCache);
        }
        const selected = deployment.units.find((unit) => unit.id === this.selectedDeploymentUnitId);
        if (selected?.square === cell.square) {
          const focus = this.assetCache.get(CORE_ASSETS.focusRing);
          if (focus?.status === 'ready') context.drawImage(focus.image, rect.x, rect.y, rect.size, rect.size);
        }
      }
    });
    this.boardReport = report;
    if ([scenario.board.tileSet.light, scenario.board.tileSet.dark, CORE_ASSETS.neutralBoard.blocker, CORE_ASSETS.neutralBoard.startZone, CORE_ASSETS.focusRing, ...deployment.units.map((unit) => unitArt({ side: deployment.playerSide, type: unit.type })).filter(Boolean), ...scenario.pieces.map(unitArt).filter(Boolean)].some((source) => this.assetCache.status(source) === 'loading')) requestAnimationFrame(() => this.drawDeploymentBoard());
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

  renderScenario(snapshot) {
    const scenario = snapshot.scenario;
    const objectives = scenario.objectives.map((item) => `<div class="rpvs__item ${item.status === 'completed' ? 'rpvs__item--done' : ''}"><b>${escapeHtml(humanObjective(item))}</b><div class="rpvs__muted">${item.current} / ${item.target}</div><div class="rpvs__progress"><span style="width:${Math.min(100, item.target ? item.current / item.target * 100 : 0)}%"></span></div></div>`).join('');
    const failures = scenario.failures.map((item) => `<div class="rpvs__item ${item.triggered ? 'rpvs__item--danger' : ''}"><b>${escapeHtml(humanFailure(item))}</b><div class="rpvs__failure-copy">${item.triggered ? 'Условие поражения выполнено' : 'Не допускайте этого исхода'}</div></div>`).join('');
    const abilityCommands = scenario.legalCommands.filter((command) => command.type === 'UseAbility');
    const abilityButtons = abilityCommands.map((command, index) => `<button class="rpvs__action" data-ability-command-index="${index}">${escapeHtml(commandLabel(command))}</button>`).join('');
    const playerReserve = (scenario.reserve || []).filter((entry) => entry.side === snapshot.playerSide);
    if (this.selectedReserveEntryId && !playerReserve.some((entry) => entry.entryId === this.selectedReserveEntryId && entry.legalSquares.length)) this.selectedReserveEntryId = null;
    const reserveCards = playerReserve.map((entry) => {
      const selected = entry.entryId === this.selectedReserveEntryId;
      const disabled = !scenario.playerTurn || !entry.affordable || !entry.legalSquares.length;
      return `<button class="rpvs__reserve-card" data-reserve-entry="${escapeAttribute(entry.entryId)}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}><span class="rpvs__reserve-piece"><img src="${escapeAttribute(unitArt({ side: entry.side, type: entry.type }))}" alt=""><small>${escapeHtml(pieceGlyph({ side: entry.side, type: entry.type }))}</small></span><span class="rpvs__reserve-meta"><strong>${escapeHtml(entry.label)}</strong><small class="rpvs__muted">Клеток для выхода: ${entry.legalSquares.length}</small></span><span class="rpvs__reserve-cost">${entry.orderCost} ОП</span></button>`;
    }).join('');
    const order = scenario.orderPoints?.player || { current: 0, max: 0 };
    const title = snapshot.status === 'boss' ? snapshot.boss?.currentPhaseTitle || 'Железный Регент' : nodeDisplayLabel(snapshot.currentNode || { type: 'battle' });
    const phase = snapshot.status === 'boss' ? `Фаза ${snapshot.boss.phaseNumber} из ${snapshot.boss.phaseCount} · ` : '';
    const check = scenario.chessStatus?.check ? `<span class="rpvs__check"><img src="${escapeAttribute(CORE_ASSETS.vfx.check)}" alt="">Вашему королю объявлен шах</span>` : '';
    const main = `<div class="rpvs__panel-head"><h1 class="rpvs__title">${escapeHtml(title)}</h1><span class="rpvs__muted">${phase}${scenario.sideToMove === snapshot.playerSide ? 'Ваш ход' : 'Ход противника'}</span>${check}</div><div class="rpvs__board-wrap"><canvas class="rpvs__canvas" data-board tabindex="0" aria-label="Тактическая шахматная доска"></canvas></div>`;
    const reserveSection = playerReserve.length ? `<section class="rpvs__sidebar-section"><h3>Боевой резерв</h3><div class="rpvs__order"><span>Очки приказа</span><strong>${order.current} / ${order.max}</strong></div><div class="rpvs__reserve">${reserveCards}</div>${this.selectedReserveEntryId ? '<div class="rpvs__reserve-hint">Теперь выберите подсвеченную клетку на доске.</div>' : ''}</section>` : '';
    const abilitySection = abilityButtons ? `<section class="rpvs__sidebar-section"><h3>Способности</h3><div class="rpvs__order"><span>Очки приказа</span><strong>${order.current} / ${order.max}</strong></div><div class="rpvs__commands">${abilityButtons}</div></section>` : '';
    const sidebar = `<div class="rpvs__panel-head"><h2 class="rpvs__title">Задача боя</h2></div><div class="rpvs__panel-body"><section class="rpvs__sidebar-section"><div class="rpvs__list">${objectives}</div></section>${failures ? `<section class="rpvs__sidebar-section"><h3>Поражение</h3><div class="rpvs__list">${failures}</div></section>` : ''}${reserveSection}${abilitySection}<section class="rpvs__sidebar-section"><div class="rpvs__battle-help">Выберите свою фигуру на доске, затем подсвеченную клетку. Технический шахматный символ находится внизу изображения воина.</div></section></div>`;
    this.root.innerHTML = this.shell(snapshot, main, sidebar);
    for (const button of this.root.querySelectorAll('[data-ability-command-index]')) button.addEventListener('click', () => { const command = abilityCommands[Number(button.dataset.abilityCommandIndex)]; this.selectedSquare = null; this.selectedReserveEntryId = null; this.client.dispatch({ type: 'PlayerCommand', request: command }).catch(() => {}); });
    for (const button of this.root.querySelectorAll('[data-reserve-entry]')) button.addEventListener('click', () => { this.selectedReserveEntryId = this.selectedReserveEntryId === button.dataset.reserveEntry ? null : button.dataset.reserveEntry; this.selectedSquare = null; this.renderScenario(snapshot); });
    const canvas = this.root.querySelector('[data-board]');
    canvas.addEventListener('pointerdown', (event) => this.handleBoardPointer(event));
    this.drawBoard();
    if (globalThis.ResizeObserver) { this.resizeObserver = new ResizeObserver(() => this.drawBoard()); this.resizeObserver.observe(canvas.parentElement); }
  }

  drawBoard() {
    const snapshot = this.lastSnapshot;
    const canvas = this.root.querySelector('[data-board]');
    if (!canvas || !['scenario', 'boss'].includes(snapshot?.status)) return;
    const scenario = snapshot.scenario;
    const bounds = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(420, Math.floor(bounds.height));
    const resized = resizeCanvasForDisplay(canvas, width, height);
    this.boardPlan = buildBrowserBoardPlan({
      width: scenario.board.width,
      height: scenario.board.height,
      activeCells: scenario.board.activeCells,
      flipped: scenario.board.flipped,
      tileSet: scenario.board.tileSet
    });
    const preload = [
      scenario.board.tileSet.light,
      scenario.board.tileSet.dark,
      CORE_ASSETS.neutralBoard.blocker,
      CORE_ASSETS.neutralBoard.startZone,
      CORE_ASSETS.vfx.legalMove,
      CORE_ASSETS.vfx.captureMove
    ];
    preload.push(...scenario.pieces.map(unitArt).filter(Boolean));
    if (this.pendingEffect) preload.push(this.pendingEffect.source);
    this.assetCache.prime(preload);
    const pieces = new Map(scenario.pieces.map((piece) => [piece.square, piece]));
    const targets = this.selectedReserveEntryId ? new Map() : legalTargets(scenario, this.selectedSquare);
    const reserveCommands = reserveTargets(scenario, this.selectedReserveEntryId);
    const environment = new Map();
    for (const object of scenario.environment) for (const cell of object.cells) environment.set(cell, object);
    this.boardReport = renderModularBoard(resized.context, this.boardPlan, {
      canvasWidth: width,
      canvasHeight: height,
      assetCache: this.assetCache,
      showCoordinates: true,
      background: 'rgba(5,9,16,.68)',
      drawCellOverlay: (context, cell, rect) => {
        const env = environment.get(cell.square);
        if (env) {
          const blocker = env.type === 'blocker' ? this.assetCache.get(CORE_ASSETS.neutralBoard.blocker) : null;
          if (blocker?.status === 'ready') context.drawImage(blocker.image, rect.x, rect.y, rect.size, rect.size);
          else {
            context.save();
            context.fillStyle = env.type === 'hazard' ? 'rgba(190,67,48,.35)' : 'rgba(89,164,219,.24)';
            context.fillRect(rect.x, rect.y, rect.size, rect.size);
            context.fillStyle = 'rgba(255,255,255,.78)';
            context.font = `${Math.floor(rect.size * .27)}px serif`;
            context.textAlign = 'right';
            context.textBaseline = 'top';
            context.fillText(ENVIRONMENT_GLYPHS[env.type] || '•', rect.x + rect.size - 5, rect.y + 3);
            context.restore();
          }
        }
        if (reserveCommands.has(cell.square)) {
          context.save();
          const startZone = this.assetCache.get(CORE_ASSETS.neutralBoard.startZone);
          if (startZone?.status === 'ready') context.drawImage(startZone.image, rect.x, rect.y, rect.size, rect.size);
          else { context.fillStyle = 'rgba(72,196,115,.34)'; context.fillRect(rect.x, rect.y, rect.size, rect.size); context.strokeStyle = '#7ee2a2'; context.lineWidth = Math.max(2, rect.size * .035); context.strokeRect(rect.x + 4, rect.y + 4, rect.size - 8, rect.size - 8); }
          context.restore();
        }
        if (cell.square === this.selectedSquare) {
          context.save();
          const focus = this.assetCache.get(CORE_ASSETS.focusRing);
          if (focus?.status === 'ready') context.drawImage(focus.image, rect.x - 4, rect.y - 4, rect.size + 8, rect.size + 8);
          else { context.strokeStyle = '#ffd36a'; context.lineWidth = Math.max(3, rect.size * .055); context.strokeRect(rect.x + 3, rect.y + 3, rect.size - 6, rect.size - 6); }
          context.restore();
        }
        if (targets.has(cell.square)) {
          const capture = pieces.has(cell.square);
          const marker = this.assetCache.get(capture ? CORE_ASSETS.vfx.captureMove : CORE_ASSETS.vfx.legalMove);
          if (marker?.status === 'ready') context.drawImage(marker.image, rect.x, rect.y, rect.size, rect.size);
          else { context.save(); context.fillStyle = capture ? 'rgba(224,76,89,.48)' : 'rgba(77,203,154,.42)'; context.beginPath(); context.arc(rect.x + rect.size / 2, rect.y + rect.size / 2, rect.size * .16, 0, Math.PI * 2); context.fill(); context.restore(); }
        }
        const piece = pieces.get(cell.square);
        if (piece) drawWarriorPiece(context, rect, piece, this.assetCache);
      }
    });
    this.playPendingBoardEffect();
    if (preload.some((source) => this.assetCache.status(source) === 'loading')) {
      setTimeout(() => { if (this.lastSnapshot === snapshot) this.drawBoard(); }, 120);
    }
  }

  playPendingBoardEffect() {
    const effect = this.pendingEffect;
    if (!effect?.square || !this.boardReport || !this.boardPlan) return;
    const cell = this.boardPlan.activeCells.find((candidate) => candidate.square === effect.square);
    if (!cell) return;
    const wrap = this.root.querySelector('.rpvs__board-wrap');
    if (!wrap) return;
    this.pendingEffect = null;
    const viewport = this.boardReport.viewport;
    const element = this.root.ownerDocument.createElement('div');
    element.className = 'rpvs__board-vfx';
    element.style.left = `${viewport.x + cell.displayX * viewport.cellSize}px`;
    element.style.top = `${viewport.y + cell.displayY * viewport.cellSize}px`;
    element.style.width = `${viewport.cellSize}px`;
    element.style.height = `${viewport.cellSize}px`;
    wrap.appendChild(element);
    this.animateSprite(element, effect);
  }

  animateSprite(element, effect) {
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const frameCount = reduce ? 1 : effect.frames;
    const duration = reduce ? 120 : effect.durationMs;
    const started = globalThis.performance?.now?.() || Date.now();
    element.style.backgroundImage = cssUrl(effect.source);
    element.style.backgroundSize = `${effect.columns * 100}% ${effect.rows * 100}%`;
    const request = globalThis.requestAnimationFrame || ((callback) => setTimeout(() => callback(Date.now()), 16));
    const tick = (now) => {
      const progress = Math.min(1, Math.max(0, (now - started) / duration));
      const frame = Math.min(frameCount - 1, Math.floor(progress * frameCount));
      const x = frame % effect.columns;
      const y = Math.floor(frame / effect.columns);
      element.style.backgroundPosition = `${effect.columns === 1 ? 0 : x / (effect.columns - 1) * 100}% ${effect.rows === 1 ? 0 : y / (effect.rows - 1) * 100}%`;
      if (progress < 1) this.effectFrameRequest = request(tick);
      else { element.remove(); this.effectFrameRequest = null; }
    };
    this.effectFrameRequest = request(tick);
  }

  handleBoardPointer(event) {
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

  renderBossTransition(snapshot) {
    const main = `<div class="rpvs__center" style="background-image:linear-gradient(#040912b8,#040912e8),url('${approvedSceneArt('battle')}')"><div class="rpvs__center-card"><div class="rpa-eyebrow">ЖЕЛЕЗНЫЙ РЕГЕНТ</div><h1 class="rpvs__title">Враг меняет тактику</h1><p class="rpvs__event-copy">Первая линия обороны разрушена, но Регент вступает в следующую фазу. Подготовьтесь к новым правилам поля.</p><button class="rpvs__primary" data-begin-phase>Начать следующую фазу</button></div></div>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelector('[data-begin-phase]').addEventListener('click', () => this.client.dispatch({ type: 'BeginBossPhase' }).catch(() => {}));
  }

  renderReward(snapshot) {
    const reward = snapshot.reward;
    const main = `<div class="rpvs__center" style="background-image:linear-gradient(#040912c9,#040912e8),url('${approvedSceneArt('reward')}')"><div class="rpvs__center-card"><div class="rpa-eyebrow">ПОБЕДА</div><h1 class="rpvs__title">${escapeHtml(reward.title || 'Награда')}</h1><div class="rpvs__reward-grid"><div class="rpvs__reward"><img src="${rewardArt('gold')}" alt=""><span><b>${reward.gold}</b>золото</span></div><div class="rpvs__reward"><img src="${rewardArt('supplies')}" alt=""><span><b>${reward.supplies}</b>припасы</span></div><div class="rpvs__reward"><img src="${rewardArt('meta')}" alt=""><span><b>${reward.meta}</b>осколки наследия</span></div></div><button class="rpvs__primary" data-claim>Забрать награду</button></div>${this.pendingEffect ? '<div class="rpvs__scene-vfx" data-scene-vfx></div>' : ''}</div>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelector('[data-claim]').addEventListener('click', () => this.client.dispatch({ type: 'ClaimReward' }).catch(() => {}));
    const effectElement = this.root.querySelector('[data-scene-vfx]');
    if (effectElement && this.pendingEffect) { const effect = this.pendingEffect; this.pendingEffect = null; this.animateSprite(effectElement, effect); }
  }

  renderTerminal(snapshot) {
    const victory = snapshot.terminal?.outcome === 'victory' || snapshot.status === 'complete';
    const background = approvedSceneArt(victory ? 'victory' : 'defeat');
    const main = `<div class="rpvs__center" style="background-image:linear-gradient(#040912b8,#040912e5),url('${background}')"><div class="rpvs__center-card"><img src="generated_assets/logo_main.png" alt="" style="width:100px;height:100px;object-fit:contain"><div class="rpa-eyebrow">${victory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</div><h1 class="rpvs__title">${victory ? 'Железные Марши пройдены' : 'Поход окончен'}</h1><p class="rpvs__muted">${victory ? 'Железный Регент повержен. Победа сохранена в Хронике.' : 'Ваш король получил мат. Поход можно начать заново из главного меню.'}</p><button class="rpvs__primary" data-runtime-menu>Вернуться в главное меню</button></div></div>`;
    this.root.innerHTML = this.shell(snapshot, main);
  }

  showError(error) {
    const toast = this.root.ownerDocument.createElement('div');
    toast.className = 'rpvs__toast';
    toast.setAttribute('role', 'alert');
    toast.textContent = error?.message || String(error);
    this.root.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }
}

export {
  PIECE_GLYPHS,
  NODE_GLYPHS,
  ENVIRONMENT_GLYPHS,
  escapeHtml,
  pieceGlyph,
  nodeDisplayLabel,
  drawWarriorPiece,
  commandLabel,
  groupNodesByLayer,
  legalTargets,
  reserveTargets,
  createPresenterStyles,
  VerticalSlicePresenter
};
