const CSS_HREF = 'css/compact-ui-pass4.css?v=20260902-2';
let queued = false;
let resetEventScroll = false;

function ensureCss() {
  if (document.querySelector('[data-compact-ui-pass4-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.compactUiPass4Css = '';
  document.head.append(link);
}

function ensureEventFrames() {
  const screen = document.querySelector('[data-events-screen]');
  const panel = screen?.querySelector('.events-panel');
  const choices = panel?.querySelector('[data-events-choices]');
  if (!panel || !choices) return;

  let copyFrame = panel.querySelector(':scope > .events-copy-frame');
  let choiceFrame = panel.querySelector(':scope > .events-choice-frame');
  if (!copyFrame || !choiceFrame) {
    const copyNodes = [...panel.children].filter((node) => node !== choices && !node.classList.contains('events-choice-frame'));
    copyFrame = document.createElement('div');
    copyFrame.className = 'events-copy-frame';
    choiceFrame = document.createElement('div');
    choiceFrame.className = 'events-choice-frame';
    copyFrame.append(...copyNodes);
    choiceFrame.append(choices);
    panel.replaceChildren(copyFrame, choiceFrame);
    panel.dataset.compactEventFrames = 'true';
  }

  const choiceCount = choices.querySelectorAll(':scope > [data-event-choice]').length;
  choiceFrame.dataset.choiceCount = String(choiceCount);

  if (resetEventScroll) {
    copyFrame.scrollTop = 0;
    resetEventScroll = false;
  }
}

function refresh() {
  queued = false;
  ensureEventFrames();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(refresh);
}

ensureCss();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
else schedule();

addEventListener('rpchess:event-open', () => {
  resetEventScroll = true;
  queueMicrotask(schedule);
});
addEventListener('resize', schedule, { passive: true });

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      if (mutation.target instanceof Element && mutation.target.matches?.('[data-events-screen]')) return schedule();
      continue;
    }
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.('[data-events-screen],[data-events-choices],[data-event-choice]') || node.querySelector?.('[data-events-screen],[data-events-choices],[data-event-choice]')) return schedule();
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

globalThis.RPChessCompactUIPass4 = Object.freeze({ refresh: schedule });
