import { VerticalSlicePresenter as BaseVerticalSlicePresenter } from './vertical-slice-presenter.mjs';
import { heroAssets } from './register-02-assets.mjs';
import {
  heroProfile,
  heroPanelMarkup,
  installRegister02Codex,
  ensureCodexStyles
} from './register-02-codex.mjs';

function recordHeroId(record) {
  return record?.heroId || record?.metadata?.heroId || null;
}

function badgeSource(record) {
  const heroId = recordHeroId(record);
  return heroId ? heroAssets(heroId)?.pieceBadge || null : null;
}

function portraitSource(record) {
  const heroId = recordHeroId(record);
  return heroId ? heroAssets(heroId)?.portrait || null : null;
}

function heroIconMarkup(record, fallback) {
  const source = badgeSource(record);
  if (!source) return fallback;
  const label = heroProfile(recordHeroId(record))?.name || recordHeroId(record);
  return `<img class="rp02-piece-image" src="${source}" alt="${label}">`;
}

function deploymentHeroRecord(snapshot, selectedId) {
  const units = snapshot?.deployment?.units || [];
  return units.find((unit) => unit.id === selectedId && recordHeroId(unit))
    || units.find((unit) => recordHeroId(unit))
    || null;
}

function scenarioHeroRecord(snapshot, selectedSquare, selectedReserveEntryId) {
  const scenario = snapshot?.scenario;
  if (!scenario) return null;
  if (selectedReserveEntryId) {
    const reserve = (scenario.reserve || []).find((entry) => entry.entryId === selectedReserveEntryId && recordHeroId(entry));
    if (reserve) return { ...reserve, inReserve: true };
  }
  if (selectedSquare) {
    const piece = (scenario.pieces || []).find((entry) => entry.square === selectedSquare && recordHeroId(entry));
    if (piece) return piece;
  }
  return (scenario.pieces || []).find((entry) => entry.side === snapshot.playerSide && recordHeroId(entry))
    || (scenario.reserve || []).find((entry) => entry.side === snapshot.playerSide && recordHeroId(entry))
    || null;
}

function injectPanel(sidebar, markup) {
  if (!sidebar || !markup) return null;
  sidebar.querySelector('[data-rp02-hero-panel]')?.remove();
  const host = sidebar.ownerDocument.createElement('div');
  host.dataset.rp02HeroPanel = '';
  host.className = 'rpvs__panel-body';
  host.innerHTML = markup;
  const head = sidebar.querySelector('.rpvs__panel-head');
  if (head) head.insertAdjacentElement('afterend', host);
  else sidebar.prepend(host);
  return host;
}

class VerticalSlicePresenter extends BaseVerticalSlicePresenter {
  installStyles() {
    super.installStyles();
    ensureCodexStyles(this.root.ownerDocument);
  }

  destroy() {
    clearTimeout(this._rp02BadgeRetry);
    super.destroy();
  }

  render(snapshotInput) {
    super.render(snapshotInput);
    installRegister02Codex(this.root, { target: '.rpvs__resources', label: 'Кодекс' });
  }

  renderDeployment(snapshot) {
    super.renderDeployment(snapshot);
    const unitById = new Map((snapshot.deployment?.units || []).map((unit) => [unit.id, unit]));
    for (const card of this.root.querySelectorAll('[data-deployment-unit]')) {
      const record = unitById.get(card.dataset.deploymentUnit);
      const icon = card.querySelector('.rpvs__reserve-piece');
      if (icon && recordHeroId(record)) icon.innerHTML = heroIconMarkup(record, icon.innerHTML);
    }
    const record = deploymentHeroRecord(snapshot, this.selectedDeploymentUnitId);
    injectPanel(this.root.querySelector('aside.rpvs__panel'), heroPanelMarkup(record, {
      state: record?.square ? `Расстановка: ${record.square}` : 'В резерве перед боем'
    }));
  }

  renderScenario(snapshot) {
    super.renderScenario(snapshot);
    const reserveById = new Map((snapshot.scenario?.reserve || []).map((entry) => [entry.entryId, entry]));
    for (const card of this.root.querySelectorAll('[data-reserve-entry]')) {
      const record = reserveById.get(card.dataset.reserveEntry);
      const icon = card.querySelector('.rpvs__reserve-piece');
      if (icon && recordHeroId(record)) icon.innerHTML = heroIconMarkup(record, icon.innerHTML);
    }
    const record = scenarioHeroRecord(snapshot, this.selectedSquare, this.selectedReserveEntryId);
    injectPanel(this.root.querySelector('aside.rpvs__panel'), heroPanelMarkup(record));
  }

  handleBoardPointer(event) {
    const beforeSquare = this.selectedSquare;
    const beforeReserve = this.selectedReserveEntryId;
    super.handleBoardPointer(event);
    if (beforeSquare !== this.selectedSquare || beforeReserve !== this.selectedReserveEntryId) {
      const snapshot = this.lastSnapshot;
      queueMicrotask(() => {
        if (this.lastSnapshot === snapshot && ['scenario', 'boss'].includes(snapshot?.status)) this.renderScenario(snapshot);
      });
    }
  }

  drawDeploymentBoard() {
    super.drawDeploymentBoard();
    const snapshot = this.lastSnapshot;
    if (snapshot?.status !== 'deployment') return;
    const records = [
      ...(snapshot.deployment?.units || []).filter((unit) => unit.square).map((unit) => ({ ...unit, side: snapshot.deployment.playerSide })),
      ...(snapshot.scenario?.pieces || []).filter((piece) => piece.side !== snapshot.deployment.playerSide)
    ];
    this.overlayHeroBadges('[data-deployment-board]', records, snapshot);
  }

  drawBoard() {
    super.drawBoard();
    const snapshot = this.lastSnapshot;
    if (!['scenario', 'boss'].includes(snapshot?.status)) return;
    this.overlayHeroBadges('[data-board]', snapshot.scenario?.pieces || [], snapshot);
  }

  overlayHeroBadges(canvasSelector, records, snapshot) {
    const canvas = this.root.querySelector(canvasSelector);
    if (!canvas || !this.boardPlan || !this.boardReport) return;
    const heroes = (records || []).filter((record) => record.square && recordHeroId(record) && badgeSource(record));
    if (!heroes.length) return;
    const sources = heroes.map(badgeSource);
    this.assetCache.prime(sources);
    const context = canvas.getContext('2d');
    if (!context) return;
    const viewport = this.boardReport.viewport;
    for (const record of heroes) {
      const source = badgeSource(record);
      const cached = this.assetCache.get(source);
      if (cached?.status !== 'ready' || !cached.image) continue;
      const cell = this.boardPlan.activeCells.find((candidate) => candidate.square === record.square);
      if (!cell) continue;
      const x = viewport.x + cell.displayX * viewport.cellSize;
      const y = viewport.y + cell.displayY * viewport.cellSize;
      const size = viewport.cellSize;
      context.save();
      context.fillStyle = record.side === 'b' ? 'rgba(9,15,25,.94)' : 'rgba(246,236,210,.92)';
      context.strokeStyle = record.side === 'b' ? 'rgba(221,231,247,.88)' : 'rgba(85,61,24,.9)';
      context.lineWidth = Math.max(1, size * .025);
      context.beginPath();
      context.arc(x + size / 2, y + size / 2, size * .39, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.drawImage(cached.image, x + size * .075, y + size * .075, size * .85, size * .85);
      if (record.status) {
        context.fillStyle = '#f3bf51';
        context.beginPath();
        context.arc(x + size * .82, y + size * .18, size * .09, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    if (sources.some((source) => this.assetCache.status(source) === 'loading')) {
      clearTimeout(this._rp02BadgeRetry);
      this._rp02BadgeRetry = setTimeout(() => {
        if (this.lastSnapshot !== snapshot) return;
        if (snapshot.status === 'deployment') this.drawDeploymentBoard();
        else if (['scenario', 'boss'].includes(snapshot.status)) this.drawBoard();
      }, 110);
    }
  }
}

export {
  recordHeroId,
  badgeSource,
  portraitSource,
  heroIconMarkup,
  deploymentHeroRecord,
  scenarioHeroRecord,
  VerticalSlicePresenter
};
