/* One on-board switch for the existing simplified-piece setting.
 * Battle, Skirmish and Caravan share the Classic board; Arena and Tournament
 * have their own journals; Training creates its left-side panel on demand.
 * Never mutate chess state or duplicate the persistent settings contract.
 */
import { boardRacePiecePath } from './race-assets.mjs';
import { fantasyPiecePath } from './fantasy-piece.mjs';
import { t, subscribe } from './i18n.mjs';

const SETTINGS_INPUT = 'input[data-simple-pieces]';
const SWITCH_INPUT = 'input[data-board-view-switch]';

function syncToggles() {
  const simplified = document.documentElement.dataset.simplePieces === '1';
  const label = t('settings.simplePieces');
  document.querySelectorAll('[data-board-view-toggle]').forEach(group => {
    group.setAttribute('aria-label', label);
    const input = group.querySelector(SWITCH_INPUT);
    if (input) {
      input.checked = simplified;
      input.setAttribute('aria-label', label);
    }
  });
}

function makeToggle() {
  const group = document.createElement('div');
  group.className = 'rpchess-board-view-toggle';
  group.dataset.boardViewToggle = '';
  group.setAttribute('role', 'group');

  const regular = document.createElement('img');
  regular.className = 'rpchess-board-view-toggle__king rpchess-board-view-toggle__king--regular';
  regular.src = boardRacePiecePath('humans', 'king', 'w');
  regular.alt = '';
  regular.draggable = false;
  regular.setAttribute('aria-hidden', 'true');

  const separator = document.createElement('span');
  separator.className = 'rpchess-board-view-toggle__separator';
  separator.textContent = '/';
  separator.setAttribute('aria-hidden', 'true');

  const fantasy = document.createElement('img');
  fantasy.className = 'rpchess-board-view-toggle__king rpchess-board-view-toggle__king--fantasy';
  fantasy.src = fantasyPiecePath('k', 'w');
  fantasy.alt = '';
  fantasy.draggable = false;
  fantasy.setAttribute('aria-hidden', 'true');

  const switchLabel = document.createElement('label');
  switchLabel.className = 'rpchess-board-view-toggle__switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.boardViewSwitch = '';
  input.className = 'rpchess-board-view-toggle__input';
  const track = document.createElement('span');
  track.className = 'rpchess-board-view-toggle__track';
  track.setAttribute('aria-hidden', 'true');
  switchLabel.append(input, track);
  group.append(regular, separator, fantasy, switchLabel);

  input.addEventListener('change', () => {
    const settingsInput = document.querySelector(SETTINGS_INPUT);
    if (!settingsInput) return;
    // The owner of the save key stays reboot-foundation.mjs.
    settingsInput.checked = input.checked;
    settingsInput.dispatchEvent(new Event('change', { bubbles:true }));
    syncToggles();
  });
  return group;
}

function mount(container, before) {
  if (!container || container.querySelector('[data-board-view-toggle]')) return;
  const group = makeToggle();
  container.insertBefore(group, before || null);
}

function mountAll() {
  const classic = document.querySelector('[data-classic-screen] .classic-panel--moves');
  const arena = document.querySelector('[data-arena-screen] .arena-battle-journal');
  const training = document.querySelector('[data-puzzle-screen] .puzzle-layout > .puzzle-panel:first-child');
  const tournament = document.querySelector('[data-tournament-screen] .tournament-journal-heading');
  mount(classic, classic?.firstChild);
  mount(arena, arena?.firstChild);
  mount(training, null);
  mount(tournament, null);
  syncToggles();
}

mountAll();
addEventListener('rpchess:puzzle-shown', mountAll);
addEventListener('rpchess:tournament-board-mounted', mountAll);
document.querySelector(SETTINGS_INPUT)?.addEventListener('change', syncToggles);
subscribe(syncToggles);
