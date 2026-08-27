import './battle-app.mjs';

const journeyButton = document.querySelector('[data-roster-travel]');
const actions = journeyButton?.parentElement || null;
const dataRosterBattle = 'data-roster-battle';

if (journeyButton && actions && !document.querySelector(`[${dataRosterBattle}]`)) {
  const battleButton = document.createElement('button');
  battleButton.className = 'reboot-button reboot-button--primary roster-battle-button';
  battleButton.type = 'button';
  battleButton.dataset.rosterBattle = '';
  battleButton.textContent = 'Начать битву';
  battleButton.addEventListener('click', () => {
    globalThis.RPChessRebootAudio?.click?.();
    globalThis.RPChessBattle?.open?.();
  });
  actions.insertBefore(battleButton, journeyButton.nextSibling);
}
