import { validatePresenterSnapshot } from './runtime-command-client.mjs';
import { VerticalSlicePresenter, escapeHtml } from './vertical-slice-presenter.mjs';

function eventChoiceMarkup(event) {
  return event.choices.map((choice) => `
    <button class="rpvs__action rpvs__event-choice" data-event-choice="${escapeHtml(choice.id)}">
      <strong>${escapeHtml(choice.label)}</strong>
    </button>`).join('');
}

class EventAwareVerticalSlicePresenter extends VerticalSlicePresenter {
  render(snapshotInput) {
    const snapshot = validatePresenterSnapshot(snapshotInput);
    if (snapshot.status !== 'event') {
      super.render(snapshot);
      return;
    }
    this.lastSnapshot = snapshot;
    this.selectedSquare = null;
    this.resizeObserver?.disconnect();
    this.renderEvent(snapshot);
  }

  renderEvent(snapshot) {
    const event = snapshot.event;
    const scene = event.sceneArt
      ? `<img src="${escapeHtml(event.sceneArt)}" alt="" style="width:100%;max-height:330px;object-fit:contain;background:#080d16" onerror="this.remove()">`
      : '';
    const main = `
      <div class="rpvs__panel-head">
        <h1 class="rpvs__title">${escapeHtml(event.title)}</h1>
        <span class="rpvs__muted">${escapeHtml(event.scope)}</span>
      </div>
      ${scene}
      <div class="rpvs__panel-body" style="max-width:900px;margin:auto">
        <p style="font:20px/1.55 Georgia,serif;white-space:pre-wrap">${escapeHtml(event.body)}</p>
      </div>`;
    const sidebar = `
      <div class="rpvs__panel-head"><h2 class="rpvs__title">Решение</h2></div>
      <div class="rpvs__panel-body">
        <div class="rpvs__commands" data-event-choices>${eventChoiceMarkup(event)}</div>
        <p class="rpvs__muted">Немедленная цена выбора показывается до подтверждения; долгосрочные последствия записываются в Хронику.</p>
      </div>`;
    this.root.innerHTML = this.shell(snapshot, main, sidebar);
    for (const button of this.root.querySelectorAll('[data-event-choice]')) {
      button.addEventListener('click', () => this.client.dispatch({ type: 'ChooseEvent', choiceId: button.dataset.eventChoice }).catch(() => {}));
    }
  }
}

export {
  eventChoiceMarkup,
  EventAwareVerticalSlicePresenter
};
