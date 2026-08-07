import { validatePresenterSnapshot } from './runtime-command-client.mjs';
import { EventAwareVerticalSlicePresenter } from './event-aware-vertical-slice-presenter.mjs';
import { escapeHtml } from './vertical-slice-presenter.mjs';
import { bossAssets, bossDisplayName, bossPhaseSigil } from './register-05-boss-assets.mjs';

function bossPhaseLabel(boss) {
  if (!boss) return '';
  return `Фаза ${boss.phaseNumber}/${boss.phaseCount}: ${boss.currentPhaseTitle || boss.currentPhaseId}`;
}

function bossTransitionMarkup(boss) {
  const completed = boss.completedPhases.at(-1);
  const assets = bossAssets(boss.bossId);
  const nextSigil = bossPhaseSigil(boss.bossId, Number(boss.phaseNumber || 1) + 1);
  const transitionArt = assets?.phaseTransition
    ? `<img src="${escapeHtml(assets.phaseTransition)}" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.13;pointer-events:none" onerror="this.remove()">`
    : '';
  const sigil = nextSigil
    ? `<img src="${escapeHtml(nextSigil)}" alt="" aria-hidden="true" style="width:112px;height:112px;object-fit:contain;filter:drop-shadow(0 8px 22px #000a)" onerror="this.remove()">`
    : '<div style="font-size:72px">♚</div>';
  return `
    <div class="rpvs__center" style="position:relative;overflow:hidden">
      ${transitionArt}
      <div style="position:relative;z-index:1;display:grid;justify-items:center;gap:12px">
        ${sigil}
        <div class="rpvs__muted">Фаза ${boss.phaseNumber} завершена</div>
        <h1 class="rpvs__title">${escapeHtml(boss.nextPhaseTitle || boss.nextPhaseId)}</h1>
        <p class="rpvs__muted">Позиция следующей фазы будет показана до первого действия. Ход начинает игрок.</p>
        <button class="rpvs__primary" data-begin-boss-phase>Начать следующую фазу</button>
      </div>
    </div>
    <template data-boss-transition-summary>
      ${escapeHtml(completed?.phaseId || boss.currentPhaseId)} · ${completed?.actionCount ?? 0}
    </template>`;
}

class ProductionVerticalSlicePresenter extends EventAwareVerticalSlicePresenter {
  render(snapshotInput) {
    const snapshot = validatePresenterSnapshot(snapshotInput);
    if (snapshot.status === 'boss') {
      this.lastSnapshot = snapshot;
      this.resizeObserver?.disconnect();
      this.renderBoss(snapshot);
      return;
    }
    if (snapshot.status === 'boss_transition') {
      this.lastSnapshot = snapshot;
      this.selectedSquare = null;
      this.resizeObserver?.disconnect();
      this.renderBossTransition(snapshot);
      return;
    }
    super.render(snapshot);
  }

  renderBoss(snapshot) {
    this.renderScenario(snapshot);
    const bossId = snapshot.boss?.bossId || snapshot.currentNode?.contentId;
    const assets = bossAssets(bossId);
    const head = this.root.querySelector('.rpvs__panel-head');
    if (head && snapshot.boss) {
      const portrait = assets?.portrait
        ? `<img src="${escapeHtml(assets.portrait)}" alt="" aria-hidden="true" style="width:48px;height:48px;border-radius:50%;object-fit:contain;background:#080d16" onerror="this.remove()">`
        : '';
      const piece = assets?.piece
        ? `<img src="${escapeHtml(assets.piece)}" alt="" aria-hidden="true" style="width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 5px 10px #000a)" onerror="this.remove()">`
        : '';
      const sigilSource = bossPhaseSigil(bossId, snapshot.boss.phaseNumber);
      const sigil = sigilSource
        ? `<img src="${escapeHtml(sigilSource)}" alt="" aria-hidden="true" style="width:36px;height:36px;object-fit:contain" onerror="this.remove()">`
        : '';
      head.insertAdjacentHTML('afterbegin', `
        ${portrait}${piece}
        <div class="rpvs__chip" aria-label="Фаза босса">
          ${sigil}${escapeHtml(bossPhaseLabel(snapshot.boss))}
        </div>`);
    }
    const board = this.root.querySelector('.rpvs__board-wrap');
    if (board && assets?.arena) {
      board.style.backgroundImage = `linear-gradient(rgba(3,7,13,.48),rgba(3,7,13,.48)),url("${assets.arena.replace(/["\\\n\r]/g, '')}")`;
      board.style.backgroundPosition = 'center';
      board.style.backgroundSize = 'cover';
    }
  }

  renderBossTransition(snapshot) {
    const boss = snapshot.boss;
    const assets = bossAssets(boss.bossId || snapshot.currentNode?.contentId);
    const completed = boss.completedPhases.at(-1);
    const portrait = assets?.portrait
      ? `<img src="${escapeHtml(assets.portrait)}" alt="" aria-hidden="true" style="width:84px;height:84px;object-fit:contain;margin-bottom:10px" onerror="this.remove()">`
      : '';
    const piece = assets?.piece
      ? `<img src="${escapeHtml(assets.piece)}" alt="" aria-hidden="true" style="width:72px;height:72px;object-fit:contain;margin:0 0 10px 8px;filter:drop-shadow(0 6px 12px #000a)" onerror="this.remove()">`
      : '';
    const sidebar = `
      <div class="rpvs__panel-head"><h2 class="rpvs__title">${escapeHtml(bossDisplayName(boss.bossId || snapshot.currentNode?.contentId))}</h2></div>
      <div class="rpvs__panel-body">
        <div style="display:flex;align-items:center;gap:8px">${portrait}${piece}</div>
        <div class="rpvs__item rpvs__item--done">
          <b>${escapeHtml(completed?.phaseId || boss.currentPhaseId)}</b>
          <div class="rpvs__muted">Действий: ${completed?.actionCount ?? 0}</div>
        </div>
        <div class="rpvs__item">
          <b>Следующая фаза</b>
          <div class="rpvs__muted">${escapeHtml(boss.nextPhaseTitle || boss.nextPhaseId)}</div>
        </div>
      </div>`;
    this.root.innerHTML = this.shell(snapshot, bossTransitionMarkup(boss), sidebar);
    const scenePanel = this.root.querySelector('.rpvs__panel--scene');
    if (scenePanel && assets?.arena) {
      scenePanel.style.backgroundImage = `linear-gradient(90deg,rgba(5,9,16,.92),rgba(5,9,16,.42)),url("${assets.arena.replace(/["\\\n\r]/g, '')}")`;
      scenePanel.style.backgroundPosition = 'center';
      scenePanel.style.backgroundSize = 'cover';
    }
    this.root.querySelector('[data-begin-boss-phase]').addEventListener('click', () => {
      this.client.dispatch({ type: 'BeginBossPhase' }).catch(() => {});
    });
  }
}

export {
  bossPhaseLabel,
  bossTransitionMarkup,
  ProductionVerticalSlicePresenter
};
