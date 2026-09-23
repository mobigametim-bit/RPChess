import { subscribe, t } from './i18n.mjs';

const screen = document.querySelector('[data-classic-screen]');
const button = screen?.querySelector('[data-combat-menu]');
let dialog = null;
let confirming = false;

function activeOwner() {
  if (screen?.hidden) return null;
  if (globalThis.RPChessBattle?.battlePlan) return globalThis.RPChessBattle;
  if (globalThis.RPChessSkirmish?.battlePlan) return globalThis.RPChessSkirmish;
  return null;
}

function syncButton() {
  if (!button) return;
  const active = Boolean(activeOwner());
  if (!active && dialog) closeDialog(false);
  if (button.hidden !== !active) button.hidden = !active;
  button.textContent = t('menu.actionsLabel');
}

function closeDialog(restoreFocus = true) {
  dialog?.remove();
  dialog = null;
  confirming = false;
  if (restoreFocus && !button?.hidden) button?.focus({ preventScroll:true });
}

function showDialog() {
  if (!activeOwner() || dialog) return;
  dialog = document.createElement('div');
  dialog.className = 'combat-exit-overlay';
  dialog.dataset.combatExitDialog = '';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'combat-exit-title');
  dialog.setAttribute('aria-describedby', 'combat-exit-warning');
  dialog.innerHTML = '<section class="combat-exit-panel ui-panel-safe"><h2 id="combat-exit-title"></h2><p id="combat-exit-warning"></p><div class="combat-exit-actions"><button class="reboot-button" type="button" data-combat-exit-cancel></button><button class="reboot-button reboot-button--primary" type="button" data-combat-exit-confirm></button></div></section>';
  const copy = () => {
    dialog.querySelector('#combat-exit-title').textContent = t('combat.exitTitle');
    dialog.querySelector('#combat-exit-warning').textContent = t('combat.exitWarning');
    dialog.querySelector('[data-combat-exit-cancel]').textContent = t('combat.exitCancel');
    dialog.querySelector('[data-combat-exit-confirm]').textContent = t('combat.exitConfirm');
  };
  copy();
  dialog.querySelector('[data-combat-exit-cancel]').addEventListener('click', () => closeDialog());
  dialog.querySelector('[data-combat-exit-confirm]').addEventListener('click', () => {
    if (confirming) return;
    confirming = true;
    const owner = activeOwner();
    if (!owner?.forfeitBattle?.()) { closeDialog(); return; }
    closeDialog(false);
    globalThis.RPChessClassicChess?.showMenu?.();
    for (const main of document.querySelectorAll('#app > main')) main.hidden = !main.matches('[data-reboot-foundation]');
    document.body.classList.remove('travel-choice-active', 'skirmish-active', 'battle-active', 'classic-chess-active', 'compact-combat-active', 'run-combat-board-active', 'endless-run-active');
    globalThis.RPChessRoster?.returnToMenu?.();
    syncButton();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    event.preventDefault();
    buttons[(index + (event.shiftKey ? buttons.length - 1 : 1) + buttons.length) % buttons.length].focus();
  });
  document.body.append(dialog);
  dialog.querySelector('[data-combat-exit-cancel]').focus({ preventScroll:true });
}

button?.addEventListener('click', showDialog);
subscribe(() => { syncButton(); if (dialog) {
  dialog.querySelector('#combat-exit-title').textContent = t('combat.exitTitle');
  dialog.querySelector('#combat-exit-warning').textContent = t('combat.exitWarning');
  dialog.querySelector('[data-combat-exit-cancel]').textContent = t('combat.exitCancel');
  dialog.querySelector('[data-combat-exit-confirm]').textContent = t('combat.exitConfirm');
}});
for (const event of ['rpchess:combat-started', 'rpchess:run-updated', 'rpchess:scene-changed']) addEventListener(event, () => queueMicrotask(syncButton));
if (screen && typeof MutationObserver !== 'undefined') new MutationObserver(syncButton).observe(screen, { attributes:true, attributeFilter:['hidden'] });
const style = document.createElement('style');
style.textContent = `
  .combat-exit-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(2,5,10,.78)}
  .combat-exit-panel{width:min(460px,100%);padding:28px;border:1px solid #ad8b4d;border-radius:12px;background:#111923;color:#f6e7c7;box-shadow:0 20px 65px #000b;text-align:center}
  .combat-exit-panel h2{margin:0 0 16px;font-size:clamp(22px,3vw,30px)}
  .combat-exit-panel p{margin:0 0 24px;line-height:1.5}
  .combat-exit-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px}
  .combat-exit-actions button{min-height:44px}
  [data-combat-menu][hidden]{display:none!important}
`;
document.head.append(style);
syncButton();
