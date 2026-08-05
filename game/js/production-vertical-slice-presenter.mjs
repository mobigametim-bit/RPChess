import { validatePresenterSnapshot } from './runtime-command-client.mjs';
import { EventAwareVerticalSlicePresenter } from './event-aware-vertical-slice-presenter.mjs';
import { escapeHtml } from './vertical-slice-presenter.mjs';

function bossPhaseLabel(boss) {
  if (!boss) return '';
  return `Фаза ${boss.phaseNumber}/${boss.phaseCount}: ${boss.currentPhaseTitle || boss.currentPhaseId}`;
}

function bossTransitionMarkup(boss) {
  const completed = boss.completedPhases.at(-1);
  return `
    <div class="rpvs__center">
      <div>
        <div style="font-size:72px">♚</div>
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
    const head = this.root.querySelector('.rpvs__panel-head');
    if (head && snapshot.boss) {
      head.insertAdjacentHTML('afterbegin', `
        <div class="rpvs__chip" aria-label="Фаза босса">
          ${escapeHtml(bossPhaseLabel(snapshot.boss))}
        </div>`);
    }
  }

  renderBossTransition(snapshot) {
    const boss = snapshot.boss;
    const completed = boss.completedPhases.at(-1);
    const sidebar = `
      <div class="rpvs__panel-head"><h2 class="rpvs__title">Железный Регент</h2></div>
      <div class="rpvs__panel-body">
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
