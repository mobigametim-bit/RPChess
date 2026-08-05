import {
  buildBrowserBoardPlan,
  resizeCanvasForDisplay,
  TileImageCache,
  renderModularBoard
} from './modular-board-renderer.mjs';
import { validatePresenterSnapshot } from './runtime-command-client.mjs';

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

function pieceGlyph(piece) {
  return PIECE_GLYPHS[piece?.side]?.[piece?.type] || '?';
}

function commandLabel(command) {
  const payload = command.payload || {};
  if (command.type === 'MovePiece') return `${payload.from} → ${payload.to}${payload.promotion ? ` = ${payload.promotion.toUpperCase()}` : ''}`;
  if (command.type === 'DeployReserve') return `Резерв: ${payload.entryId} → ${payload.square}`;
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

function createPresenterStyles() {
  return `
    .rpvs{min-height:100%;box-sizing:border-box;padding:18px;color:#f4ead6;background:radial-gradient(circle at 50% -20%,#233452 0,#111827 45%,#080d16 100%);font:16px/1.4 system-ui,sans-serif}
    .rpvs *{box-sizing:border-box}.rpvs button{font:inherit}.rpvs__top{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:0 auto 14px;max-width:1400px}
    .rpvs__brand{font:700 24px/1.1 Georgia,serif;letter-spacing:.04em}.rpvs__resources{display:flex;gap:8px;flex-wrap:wrap}.rpvs__chip{padding:7px 11px;border:1px solid #8d7745;border-radius:999px;background:#151f31;color:#f7e7b0}
    .rpvs__layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;max-width:1400px;margin:auto}.rpvs__panel{border:1px solid #73633f;border-radius:16px;background:rgba(11,18,29,.9);box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden}
    .rpvs__panel-head{padding:13px 16px;border-bottom:1px solid rgba(174,147,82,.35);display:flex;justify-content:space-between;align-items:center;gap:10px}.rpvs__panel-body{padding:16px}.rpvs__title{margin:0;font:700 20px/1.2 Georgia,serif}.rpvs__muted{color:#aab4c4;font-size:14px}
    .rpvs__map{display:flex;gap:26px;align-items:stretch;min-height:420px;overflow:auto;padding:28px}.rpvs__layer{display:flex;flex-direction:column;justify-content:space-around;gap:18px;min-width:150px}.rpvs__node{position:relative;min-height:74px;padding:10px;border:1px solid #4b5a72;border-radius:13px;background:#121d2d;color:#e9edf4;text-align:left}.rpvs__node[disabled]{opacity:.42}.rpvs__node--current{border-color:#e1b85d;box-shadow:0 0 0 2px rgba(225,184,93,.25)}.rpvs__node--visited{background:#1b2a32}.rpvs__node--route{cursor:pointer}.rpvs__node--route:hover,.rpvs__node--route:focus-visible{border-color:#7fc7ff;outline:2px solid #7fc7ff;outline-offset:2px}.rpvs__node-icon{font-size:24px;display:block}.rpvs__cost{display:inline-block;margin-top:5px;color:#f4cc75;font-size:13px}
    .rpvs__board-wrap{position:relative;min-height:620px;background:linear-gradient(145deg,rgba(27,39,57,.6),rgba(4,8,14,.82))}.rpvs__canvas{display:block;width:100%;height:620px;touch-action:none;outline:none}.rpvs__canvas:focus-visible{box-shadow:inset 0 0 0 3px #75c8ff}.rpvs__sidebar-section+ .rpvs__sidebar-section{border-top:1px solid rgba(174,147,82,.25);margin-top:14px;padding-top:14px}
    .rpvs__list{display:grid;gap:8px}.rpvs__item{padding:10px;border-radius:10px;background:#121c2b;border:1px solid #2f415d}.rpvs__item--done{border-color:#5b9e73}.rpvs__item--danger{border-color:#9f5151}.rpvs__progress{height:6px;margin-top:7px;border-radius:999px;background:#273347;overflow:hidden}.rpvs__progress>span{display:block;height:100%;background:#d7b65a}
    .rpvs__commands{display:grid;gap:7px;max-height:320px;overflow:auto}.rpvs__action{padding:10px 12px;border:1px solid #6b7d99;border-radius:9px;background:#18263a;color:#f4ead6;cursor:pointer;text-align:left}.rpvs__action:hover,.rpvs__action:focus-visible{outline:2px solid #79c9ff;outline-offset:1px}.rpvs__action:disabled{opacity:.45;cursor:wait}.rpvs__primary{width:100%;padding:13px;border:1px solid #d2ab52;border-radius:10px;background:linear-gradient(#6b5220,#47340f);color:#fff2c7;font-weight:700;cursor:pointer}
    .rpvs__center{min-height:520px;display:grid;place-items:center;padding:30px;text-align:center}.rpvs__reward-grid{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:22px 0}.rpvs__reward{min-width:110px;padding:18px;border:1px solid #9b8045;border-radius:14px;background:#19243a}.rpvs__reward b{display:block;font-size:26px;color:#f2cf76}
    .rpvs__toast{position:fixed;right:20px;bottom:20px;max-width:420px;padding:12px 15px;border-radius:10px;background:#151d2a;border:1px solid #9f5151;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:10}.rpvs__busy{opacity:.65;pointer-events:none}
    @media(max-width:980px){.rpvs__layout{grid-template-columns:1fr}.rpvs__board-wrap,.rpvs__canvas{min-height:520px;height:520px}.rpvs__map{min-height:360px}.rpvs__top{align-items:flex-start;flex-direction:column}}
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
    this.boardPlan = null;
    this.boardReport = null;
    this.resizeObserver = null;
    this.busy = false;
    this.lastSnapshot = null;
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
    this.root.replaceChildren();
  }

  shell(snapshot, main, sidebar = '') {
    return `
      <section class="rpvs" aria-label="RPChess vertical slice">
        <header class="rpvs__top">
          <div><div class="rpvs__brand">RPChess</div><div class="rpvs__muted">Акт ${snapshot.campaign.act} · ${escapeHtml(snapshot.campaign.regionId)} · seed ${snapshot.seed}</div></div>
          <div class="rpvs__resources" aria-label="Ресурсы"><span class="rpvs__chip">Золото: ${snapshot.resources.gold}</span><span class="rpvs__chip">Припасы: ${snapshot.resources.supplies}</span><span class="rpvs__chip">Мета: ${snapshot.resources.meta}</span></div>
        </header>
        <div class="rpvs__layout"><main class="rpvs__panel">${main}</main><aside class="rpvs__panel">${sidebar || '<div class="rpvs__panel-body rpvs__muted">Нет дополнительных действий</div>'}</aside></div>
      </section>`;
  }

  render(snapshotInput) {
    const snapshot = validatePresenterSnapshot(snapshotInput);
    this.lastSnapshot = snapshot;
    this.selectedSquare = snapshot.status === 'scenario' ? this.selectedSquare : null;
    this.resizeObserver?.disconnect();
    if (snapshot.status === 'campaign') this.renderCampaign(snapshot);
    else if (snapshot.status === 'scenario') this.renderScenario(snapshot);
    else if (snapshot.status === 'reward') this.renderReward(snapshot);
    else this.renderTerminal(snapshot);
  }

  renderCampaign(snapshot) {
    const routeByNode = new Map(snapshot.campaign.routes.map((route) => [route.to, route]));
    const layers = groupNodesByLayer(snapshot.campaign.nodes);
    const map = `<div class="rpvs__panel-head"><h1 class="rpvs__title">Карта похода</h1><span class="rpvs__muted">Разведка: ${snapshot.campaign.scouting}</span></div><div class="rpvs__map">${layers.map((group) => `<div class="rpvs__layer" data-layer="${group.layer}">${group.nodes.map((node) => {
      const route = routeByNode.get(node.id);
      const enabled = Boolean(route?.affordable);
      const classes = ['rpvs__node', node.current ? 'rpvs__node--current' : '', node.visited ? 'rpvs__node--visited' : '', route ? 'rpvs__node--route' : ''].filter(Boolean).join(' ');
      return `<button class="${classes}" data-node-id="${escapeHtml(node.id)}" ${route && enabled ? '' : 'disabled'} aria-label="${escapeHtml(node.label || node.type || 'Неизвестный узел')}"><span class="rpvs__node-icon">${NODE_GLYPHS[node.type] || '?'}</span><strong>${escapeHtml(node.label || node.type || 'Неизвестно')}</strong>${route ? `<span class="rpvs__cost">Цена: ${route.cost}${route.affordable ? '' : ' · недостаточно'}</span>` : ''}</button>`;
    }).join('')}</div>`).join('')}</div>`;
    const sidebar = `<div class="rpvs__panel-head"><h2 class="rpvs__title">Доступные маршруты</h2></div><div class="rpvs__panel-body"><div class="rpvs__list">${snapshot.campaign.routes.map((route) => `<div class="rpvs__item"><b>${escapeHtml(route.label || route.type || route.to)}</b><div class="rpvs__muted">${route.to} · ${route.cost} прип.</div></div>`).join('') || '<div class="rpvs__muted">Маршрутов нет</div>'}</div></div>`;
    this.root.innerHTML = this.shell(snapshot, map, sidebar);
    for (const button of this.root.querySelectorAll('[data-node-id]:not([disabled])')) {
      button.addEventListener('click', () => this.client.dispatch({ type: 'Travel', targetNodeId: button.dataset.nodeId }).catch(() => {}));
    }
  }

  renderScenario(snapshot) {
    const scenario = snapshot.scenario;
    const objectives = scenario.objectives.map((item) => `<div class="rpvs__item ${item.status === 'completed' ? 'rpvs__item--done' : ''}"><b>${escapeHtml(item.label)}</b><div class="rpvs__muted">${item.current} / ${item.target}</div><div class="rpvs__progress"><span style="width:${Math.min(100, item.target ? item.current / item.target * 100 : 0)}%"></span></div></div>`).join('');
    const failures = scenario.failures.map((item) => `<div class="rpvs__item ${item.triggered ? 'rpvs__item--danger' : ''}"><b>${escapeHtml(item.label)}</b><div class="rpvs__muted">${item.triggered ? 'Сработало' : 'Не допустить'}</div></div>`).join('');
    const commands = scenario.legalCommands.map((command, index) => `<button class="rpvs__action" data-command-index="${index}">${escapeHtml(commandLabel(command))}</button>`).join('');
    const main = `<div class="rpvs__panel-head"><h1 class="rpvs__title">${escapeHtml(snapshot.currentNode?.contentId || 'Тактический бой')}</h1><span class="rpvs__muted">Ход: ${scenario.sideToMove === snapshot.playerSide ? 'игрок' : 'противник'} · действие ${scenario.actionIndex}</span></div><div class="rpvs__board-wrap"><canvas class="rpvs__canvas" data-board tabindex="0" aria-label="Шахматная доска"></canvas></div>`;
    const sidebar = `<div class="rpvs__panel-head"><h2 class="rpvs__title">Задачи</h2></div><div class="rpvs__panel-body"><section class="rpvs__sidebar-section"><div class="rpvs__list">${objectives}</div></section>${failures ? `<section class="rpvs__sidebar-section"><h3>Поражение</h3><div class="rpvs__list">${failures}</div></section>` : ''}<section class="rpvs__sidebar-section"><h3>Легальные действия</h3><div class="rpvs__commands">${commands || '<div class="rpvs__muted">Ожидание противника</div>'}</div></section></div>`;
    this.root.innerHTML = this.shell(snapshot, main, sidebar);
    for (const button of this.root.querySelectorAll('[data-command-index]')) {
      button.addEventListener('click', () => {
        const command = scenario.legalCommands[Number(button.dataset.commandIndex)];
        this.client.dispatch({ type: 'PlayerCommand', request: command }).catch(() => {});
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

  drawBoard() {
    const snapshot = this.lastSnapshot;
    const canvas = this.root.querySelector('[data-board]');
    if (!canvas || snapshot?.status !== 'scenario') return;
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
    this.assetCache.prime([scenario.board.tileSet.light, scenario.board.tileSet.dark]);
    const pieces = new Map(scenario.pieces.map((piece) => [piece.square, piece]));
    const targets = legalTargets(scenario, this.selectedSquare);
    const environment = new Map();
    for (const object of scenario.environment) for (const cell of object.cells) environment.set(cell, object);
    this.boardReport = renderModularBoard(resized.context, this.boardPlan, {
      canvasWidth: width,
      canvasHeight: height,
      assetCache: this.assetCache,
      showCoordinates: true,
      background: '#080d16',
      drawCellOverlay: (context, cell, rect) => {
        const env = environment.get(cell.square);
        if (env) {
          context.save(); context.fillStyle = env.type === 'hazard' ? 'rgba(190,67,48,.35)' : 'rgba(89,164,219,.24)'; context.fillRect(rect.x, rect.y, rect.size, rect.size); context.fillStyle = 'rgba(255,255,255,.78)'; context.font = `${Math.floor(rect.size * .27)}px serif`; context.textAlign = 'right'; context.textBaseline = 'top'; context.fillText(ENVIRONMENT_GLYPHS[env.type] || '•', rect.x + rect.size - 5, rect.y + 3); context.restore();
        }
        if (cell.square === this.selectedSquare) { context.save(); context.strokeStyle = '#ffd36a'; context.lineWidth = Math.max(3, rect.size * .055); context.strokeRect(rect.x + 3, rect.y + 3, rect.size - 6, rect.size - 6); context.restore(); }
        if (targets.has(cell.square)) { context.save(); context.fillStyle = pieces.has(cell.square) ? 'rgba(224,76,89,.48)' : 'rgba(77,203,154,.42)'; context.beginPath(); context.arc(rect.x + rect.size / 2, rect.y + rect.size / 2, rect.size * .16, 0, Math.PI * 2); context.fill(); context.restore(); }
        const piece = pieces.get(cell.square);
        if (piece) { context.save(); context.fillStyle = piece.side === 'w' ? '#fff7df' : '#101722'; context.strokeStyle = piece.side === 'w' ? '#172033' : '#e7d9b5'; context.lineWidth = Math.max(1, rect.size * .025); context.font = `${Math.floor(rect.size * .7)}px Georgia,serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.strokeText(pieceGlyph(piece), rect.x + rect.size / 2, rect.y + rect.size * .53); context.fillText(pieceGlyph(piece), rect.x + rect.size / 2, rect.y + rect.size * .53); if (piece.status) { context.fillStyle = '#f3bf51'; context.beginPath(); context.arc(rect.x + rect.size * .82, rect.y + rect.size * .18, rect.size * .09, 0, Math.PI * 2); context.fill(); } context.restore(); }
      }
    });
  }

  handleBoardPointer(event) {
    if (this.busy || !this.boardReport || !this.boardPlan || this.lastSnapshot?.status !== 'scenario') return;
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

  renderReward(snapshot) {
    const reward = snapshot.reward;
    const main = `<div class="rpvs__center"><div><div class="rpvs__muted">Узел завершён</div><h1 class="rpvs__title">${escapeHtml(reward.title || 'Награда')}</h1><div class="rpvs__reward-grid"><div class="rpvs__reward"><b>${reward.gold}</b>золото</div><div class="rpvs__reward"><b>${reward.supplies}</b>припасы</div><div class="rpvs__reward"><b>${reward.meta}</b>мета</div></div><button class="rpvs__primary" data-claim>Забрать награду</button></div></div>`;
    const sidebar = `<div class="rpvs__panel-head"><h2 class="rpvs__title">Прогресс</h2></div><div class="rpvs__panel-body"><div class="rpvs__item"><b>Посещено узлов</b><div class="rpvs__muted">${snapshot.campaign.visitedNodeIds.length}</div></div></div>`;
    this.root.innerHTML = this.shell(snapshot, main, sidebar);
    this.root.querySelector('[data-claim]').addEventListener('click', () => this.client.dispatch({ type: 'ClaimReward' }).catch(() => {}));
  }

  renderTerminal(snapshot) {
    const victory = snapshot.terminal?.outcome === 'victory';
    const main = `<div class="rpvs__center"><div><div style="font-size:72px">${victory ? '♔' : '♚'}</div><h1 class="rpvs__title">${victory ? 'Акт завершён' : 'Поход окончен'}</h1><p class="rpvs__muted">Получено наград: ${snapshot.terminal?.rewardsClaimed || 0}</p></div></div>`;
    this.root.innerHTML = this.shell(snapshot, main, `<div class="rpvs__panel-body"><div class="rpvs__item"><b>Золото</b><div>${snapshot.resources.gold}</div></div><div class="rpvs__item"><b>Мета</b><div>${snapshot.resources.meta}</div></div></div>`);
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
  commandLabel,
  groupNodesByLayer,
  legalTargets,
  createPresenterStyles,
  VerticalSlicePresenter
};
