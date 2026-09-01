const CSS_HREF = 'css/compact-ui-pass4.css?v=20260902-2';
const LIVE_OVERRIDE_CSS = `
@media (min-width:901px){
  body.events-active .events-panel{--event-reading-size:clamp(18px,1.22vw,22px)}
  body.events-active .events-copy-frame,
  body.events-active .events-choice-frame{
    background:linear-gradient(110deg,rgba(7,10,15,.67),rgba(7,10,15,.62))!important;
  }
  body.events-active .events-story,
  body.events-active .events-choice{
    font-size:var(--event-reading-size)!important;
  }
  body.events-active .events-choice__head strong,
  body.events-active .events-choice__reaction,
  body.events-active .events-choice__hero-line{
    font-size:1em!important;
    line-height:1.34!important;
  }
  body.events-active:has(.events-choice-frame[data-choice-count="5"]) .events-panel,
  body.events-active:has(.events-choice-frame[data-choice-count="6"]) .events-panel{
    --event-reading-size:clamp(16px,1.05vw,18px);
  }

  /* Travel: preserve the original landscape artwork proportions. The card height
     follows its content; only title/meta move over the lower edge of the image. */
  body.travel-choice-active .travel-choice-routes{
    height:auto!important;
    min-height:0!important;
    align-items:start!important;
  }
  body.travel-choice-active .travel-choice-card{
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    align-self:start!important;
    grid-template-rows:auto auto!important;
  }
  body.travel-choice-active .travel-choice-card__visual{
    position:relative!important;
    width:100%!important;
    height:auto!important;
    min-height:0!important;
    aspect-ratio:3 / 2!important;
    overflow:hidden!important;
  }
  body.travel-choice-active .travel-choice-card__overlay{
    position:absolute!important;
    z-index:5!important;
    left:0!important;
    right:0!important;
    bottom:0!important;
    display:flex!important;
    flex-direction:column!important;
    gap:6px!important;
    padding:72px 24px 14px!important;
    background:linear-gradient(180deg,rgba(3,7,12,0) 0%,rgba(3,7,12,.48) 38%,rgba(3,7,12,.94) 100%)!important;
    pointer-events:none!important;
  }
  body.travel-choice-active .travel-choice-card__overlay .travel-choice-card__type{
    font-size:clamp(28px,2vw,35px)!important;
    line-height:1!important;
  }
  body.travel-choice-active .travel-choice-card__overlay .travel-choice-card__threat,
  body.travel-choice-active .travel-choice-card__overlay .travel-choice-card__safe,
  body.travel-choice-active .travel-choice-card__overlay .travel-choice-card__meta--cost-only{
    margin:3px 0 0!important;
    padding:0!important;
    border:0!important;
    min-height:26px!important;
  }
  body.travel-choice-active .travel-choice-card__body{
    height:auto!important;
    min-height:0!important;
    padding:13px 24px 15px!important;
    overflow:hidden!important;
    justify-content:flex-start!important;
  }
  body.travel-choice-active .travel-choice-card__flavor{
    margin:0!important;
    font-size:clamp(15px,1.03vw,18px)!important;
    line-height:1.42!important;
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:2!important;
    overflow:hidden!important;
  }
}
@media (min-width:901px) and (max-height:760px){
  body.events-active .events-panel{--event-reading-size:16px}
  body.travel-choice-active .travel-choice-card__overlay{
    padding:58px 18px 11px!important;
  }
  body.travel-choice-active .travel-choice-card__body{
    min-height:0!important;
    padding:10px 18px 12px!important;
  }
}
`;
let queued = false;
let resetEventScroll = false;

function ensureCss() {
  if (!document.querySelector('[data-compact-ui-pass4-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    link.dataset.compactUiPass4Css = '';
    document.head.append(link);
  }
  if (!document.querySelector('[data-compact-ui-pass4-live-overrides]')) {
    const style = document.createElement('style');
    style.dataset.compactUiPass4LiveOverrides = '';
    style.textContent = LIVE_OVERRIDE_CSS;
    document.head.append(style);
  }
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

function restoreTravelCardBody(overlay, type, meta, body) {
  if (!overlay || !body) return;
  const flavor = body.querySelector('.travel-choice-card__flavor');
  if (type && type.parentElement === overlay) body.insertBefore(type, flavor || null);
  if (meta && meta.parentElement === overlay) body.insertBefore(meta, flavor || null);
  overlay.remove();
}

function ensureTravelCardOverlays() {
  const desktop = matchMedia('(min-width: 901px)').matches;
  for (const card of document.querySelectorAll('[data-travel-choice]')) {
    const visual = card.querySelector('.travel-choice-card__visual');
    const body = card.querySelector('.travel-choice-card__body');
    const type = card.querySelector('.travel-choice-card__type');
    const meta = card.querySelector('.travel-choice-card__threat, .travel-choice-card__safe, .travel-choice-card__meta--cost-only');
    let overlay = card.querySelector('.travel-choice-card__overlay');
    if (!desktop) {
      restoreTravelCardBody(overlay, type, meta, body);
      continue;
    }
    if (!visual || !body || !type) continue;
    if (!overlay) {
      overlay = document.createElement('span');
      overlay.className = 'travel-choice-card__overlay';
      visual.append(overlay);
    }
    if (type.parentElement !== overlay) overlay.append(type);
    if (meta && meta.parentElement !== overlay) overlay.append(meta);
  }
}

function refresh() {
  queued = false;
  ensureEventFrames();
  ensureTravelCardOverlays();
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
addEventListener('rpchess:travel-open', () => queueMicrotask(schedule));
addEventListener('resize', schedule, { passive: true });

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      if (mutation.target instanceof Element && mutation.target.matches?.('[data-events-screen],[data-travel-choice-screen]')) return schedule();
      continue;
    }
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.('[data-events-screen],[data-events-choices],[data-event-choice],[data-travel-choice],.travel-choice-card__meta--cost-only') || node.querySelector?.('[data-events-screen],[data-events-choices],[data-event-choice],[data-travel-choice],.travel-choice-card__meta--cost-only')) return schedule();
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

globalThis.RPChessCompactUIPass4 = Object.freeze({ refresh: schedule });
