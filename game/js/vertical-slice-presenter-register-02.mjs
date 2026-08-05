import { VerticalSlicePresenter as BaseVerticalSlicePresenter } from './vertical-slice-presenter.mjs';
import { heroAssets } from './register-02-assets.mjs';
import { kingAssets, doctrineAssets } from './register-01-assets.mjs';
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

function heroArmyState(snapshot, heroId) {
  if (!heroId) return Object.freeze({ id: 'unknown', label: 'Нет данных' });
  if (snapshot?.status === 'deployment') {
    const unit = (snapshot.deployment?.units || []).find((entry) => recordHeroId(entry) === heroId);
    if (unit?.square) return Object.freeze({ id: 'field', label: `На поле: ${unit.square}` });
    if (unit) return Object.freeze({ id: 'reserve', label: 'Резерв расстановки' });
  }
  if (['scenario', 'boss'].includes(snapshot?.status)) {
    const piece = (snapshot.scenario?.pieces || []).find((entry) => recordHeroId(entry) === heroId);
    if (piece?.square) return Object.freeze({ id: 'field', label: `На поле: ${piece.square}` });
    const reserve = (snapshot.scenario?.reserve || []).find((entry) => recordHeroId(entry) === heroId);
    if (reserve) return Object.freeze({ id: 'reserve', label: 'В боевом резерве' });
    return Object.freeze({ id: 'inactive', label: 'Не участвует в текущем бою' });
  }
  if (snapshot?.status === 'complete') return Object.freeze({ id: 'complete', label: 'Поход завершён' });
  if (snapshot?.status === 'failed') return Object.freeze({ id: 'failed', label: 'Поход завершён поражением' });
  return Object.freeze({ id: 'roster', label: 'В составе похода' });
}

function armyPanelMarkup(snapshot) {
  const army = snapshot?.army;
  if (!army) return '';
  const king = kingAssets(army.kingId);
  const doctrine = doctrineAssets(army.doctrineId);
  const heroes = (army.heroes || []).map((hero) => {
    const profile = heroProfile(hero.heroId);
    const assets = heroAssets(hero.heroId);
    const state = heroArmyState(snapshot, hero.heroId);
    const name = hero.name || profile?.name || hero.heroId;
    return `<article class="rp02-army-hero rp02-army-hero--${state.id}">
      ${assets?.portrait ? `<img src="${assets.portrait}" alt="${name}">` : ''}
      <div><strong>${name}</strong><span>${state.label}</span><small>${hero.relicIds?.length || 0} реликв.</small></div>
    </article>`;
  }).join('');
  return `<aside class="rpvs__panel rp02-army-panel" data-rp02-army-panel>
    <div class="rpvs__panel-head"><h2 class="rpvs__title">Армия</h2><span class="rpvs__chip">${army.heroCount} гер.</span></div>
    <div class="rpvs__panel-body">
      <div class="rp02-army-command">
        ${king?.portrait ? `<img src="${king.portrait}" alt="${army.kingName}">` : ''}
        <div><small>Король</small><strong>${army.kingName}</strong></div>
        ${doctrine?.emblem ? `<img src="${doctrine.emblem}" alt="${army.doctrineName}">` : ''}
        <div><small>Доктрина</small><strong>${army.doctrineName}</strong></div>
      </div>
      <div class="rp02-army-summary"><span>Героев: ${army.heroCount}</span><span>Реликвий: ${army.relicCount}</span></div>
      <div class="rp02-army-list">${heroes}</div>
    </div>
  </aside>`;
}

function ensureArmyStyles(document) {
  if (document.getElementById('rp02-army-styles')) return;
  const style = document.createElement('style');
  style.id = 'rp02-army-styles';
  style.textContent = `
    .rpvs__layout.rpvs__layout--army{grid-template-columns:minmax(0,1fr) 330px 280px;max-width:1680px}.rp02-army-panel{align-self:start;position:sticky;top:18px;max-height:calc(100vh - 36px);overflow:auto}.rp02-army-command{display:grid;grid-template-columns:48px minmax(0,1fr);gap:7px 9px;align-items:center}.rp02-army-command img{width:48px;height:48px;object-fit:contain;border-radius:9px;background:#08111f}.rp02-army-command div{display:grid;min-width:0}.rp02-army-command small,.rp02-army-hero span,.rp02-army-hero small{color:#aab4c4;font-size:11px}.rp02-army-command strong,.rp02-army-hero strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rp02-army-summary{display:flex;justify-content:space-between;gap:8px;margin:12px 0;color:#f2cf76;font-size:12px}.rp02-army-list{display:grid;gap:7px}.rp02-army-hero{display:grid;grid-template-columns:48px minmax(0,1fr);gap:9px;align-items:center;padding:7px;border:1px solid #3b4f6c;border-radius:10px;background:#111d30}.rp02-army-hero img{width:48px;height:48px;object-fit:cover;border-radius:8px}.rp02-army-hero div{display:grid;min-width:0}.rp02-army-hero--field{border-color:#6ea77e}.rp02-army-hero--reserve{border-color:#b9964c}.rp02-army-hero--inactive{opacity:.66}.rp02-army-hero--failed{border-color:#a75e5e}@media(max-width:1280px){.rpvs__layout.rpvs__layout--army{grid-template-columns:minmax(0,1fr) 330px}.rp02-army-panel{position:static;grid-column:1/-1;max-height:none}.rp02-army-list{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:980px){.rp02-army-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.rp02-army-list{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function installArmyPanel(root, snapshot) {
  const layout = root.querySelector('.rpvs__layout');
  if (!layout || !snapshot?.army) return null;
  layout.querySelector('[data-rp02-army-panel]')?.remove();
  layout.classList.add('rpvs__layout--army');
  const host = layout.ownerDocument.createElement('div');
  host.innerHTML = armyPanelMarkup(snapshot);
  const panel = host.firstElementChild;
  if (panel) layout.appendChild(panel);
  return panel;
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
    ensureArmyStyles(this.root.ownerDocument);
  }

  destroy() {
    clearTimeout(this._rp02BadgeRetry);
    super.destroy();
  }

  render(snapshotInput) {
    super.render(snapshotInput);
    installArmyPanel(this.root, snapshotInput);
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
  heroArmyState,
  armyPanelMarkup,
  ensureArmyStyles,
  installArmyPanel,
  deploymentHeroRecord,
  scenarioHeroRecord,
  VerticalSlicePresenter
};
