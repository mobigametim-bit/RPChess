import { readRun, writeRun } from './run-persistence.mjs';
import { TRAVEL_SUPPLY_COST, applyTravelSupplyCost } from './resources-core.mjs';
import {
  PLAYABLE_TRAVEL_TYPES,
  TRAVEL_CHOICE_COUNT,
  createTravelChoices,
  isTravelChoice
} from './travel-choice-core.mjs';

const ROUTE_ICONS = Object.freeze({
  skirmish: 'generated_assets/node_battle.png',
  battle: 'generated_assets/node_elite.png',
  event: 'generated_assets/node_event.png',
  settlement: 'generated_assets/node_shop.png',
  puzzle: 'generated_assets/node_training.png'
});

let screen = null;
let activeRun = null;
let routing = false;

function audio() { return globalThis.RPChessRebootAudio; }

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;

  screen = document.createElement('main');
  screen.className = 'travel-choice-screen';
  screen.dataset.travelChoiceScreen = '';
  screen.setAttribute('aria-label', 'Выбор следующего пути');
  screen.hidden = true;
  screen.innerHTML = `
    <div class="travel-choice-shell">
      <header class="travel-choice-topbar">
        <img class="travel-choice-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
        <div class="travel-choice-topbar__actions">
          <button class="reboot-button reboot-button--primary" type="button" data-travel-roster>Отряд</button>
          <button class="reboot-button reboot-button--primary" type="button" data-travel-settings>Настройки</button>
        </div>
      </header>
      <header class="travel-choice-heading">
        <div class="reboot-eyebrow">ПУТЕШЕСТВИЕ</div>
        <h1>Куда двигаться дальше?</h1>
        <p data-travel-step>Шаг путешествия 1</p>
      </header>
      <section class="travel-choice-routes" data-travel-routes aria-label="Три возможных пути"></section>
      <p class="travel-choice-footnote">Выбор пути окончателен. Каждый переход расходует 1 припас. Нажмите на карточку, чтобы сразу отправиться навстречу событию.</p>
    </div>`;
  app.append(screen);

  screen.querySelector('[data-travel-roster]')?.addEventListener('click', openRoster);
  screen.querySelector('[data-travel-settings]')?.addEventListener('click', () => {
    audio()?.click?.();
    globalThis.RPChessOpenSettings?.();
  });
  return screen;
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove('roster-active', 'skirmish-active', 'battle-active', 'classic-chess-active', 'settlement-active');
}

function showTravel() {
  const root = ensureScreen();
  if (!root) return;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('travel-choice-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
}

function hideTravel() {
  if (screen) screen.hidden = true;
  document.body.classList.remove('travel-choice-active');
}

function validStoredChoices(run) {
  return Array.isArray(run?.currentTravelChoices) &&
    run.currentTravelChoices.length === TRAVEL_CHOICE_COUNT &&
    run.currentTravelChoices.every((choice) => isTravelChoice(choice) && PLAYABLE_TRAVEL_TYPES.includes(choice.type));
}

function ensureChoices(run) {
  if (validStoredChoices(run)) return run;
  const step = (Number.isInteger(run?.journeyStep) ? run.journeyStep : 0) + 1;
  const choices = createTravelChoices({ runId: run.id, step });
  return writeRun({ ...run, currentTravelChoices: choices, activeTravelChoice: null });
}

function starsText(stars) {
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`;
}

function routeCard(choice) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `travel-choice-card travel-choice-card--${choice.type}`;
  button.dataset.travelChoice = choice.id;
  button.dataset.travelType = choice.type;
  button.dataset.travelStars = String(choice.stars);
  button.setAttribute('aria-label', choice.type === 'settlement'
    ? `${choice.label}. Безопасное место. Лечение, найм и снабжение. Стоимость пути ${TRAVEL_SUPPLY_COST} припас. ${choice.flavor} Нажмите, чтобы выбрать путь.`
    : `${choice.label}. Угроза ${choice.stars} из 5. Стоимость пути ${TRAVEL_SUPPLY_COST} припас. ${choice.flavor} Нажмите, чтобы выбрать путь.`);

  const visual = document.createElement('span');
  visual.className = 'travel-choice-card__visual';
  const glow = document.createElement('span');
  glow.className = 'travel-choice-card__glow';
  const icon = document.createElement('img');
  icon.className = 'travel-choice-card__icon';
  icon.src = ROUTE_ICONS[choice.type] || ROUTE_ICONS.skirmish;
  icon.alt = '';
  visual.append(glow, icon);

  const body = document.createElement('span');
  body.className = 'travel-choice-card__body';
  const type = document.createElement('strong');
  type.className = 'travel-choice-card__type';
  type.textContent = choice.label;

  let dangerOrSafe;
  if (choice.type === 'settlement') {
    dangerOrSafe = document.createElement('span');
    dangerOrSafe.className = 'travel-choice-card__safe';
    dangerOrSafe.innerHTML = '<strong>БЕЗОПАСНОЕ МЕСТО</strong><small>ЛЕЧЕНИЕ · НАЙМ · СНАБЖЕНИЕ</small>';
  } else {
    dangerOrSafe = document.createElement('span');
    dangerOrSafe.className = 'travel-choice-card__threat';
    dangerOrSafe.innerHTML = `<strong>${starsText(choice.stars)}</strong><small>${choice.threatLabel} УГРОЗА</small>`;
  }

  const flavor = document.createElement('span');
  flavor.className = 'travel-choice-card__flavor';
  flavor.textContent = choice.flavor;
  const hint = document.createElement('span');
  hint.className = 'travel-choice-card__hint';
  hint.textContent = choice.mechanicalHint;
  const cost = document.createElement('span');
  cost.className = 'travel-choice-card__cost';
  const noSupplies = (activeRun?.supplies || 0) < TRAVEL_SUPPLY_COST;
  cost.classList.toggle('is-empty', noSupplies);
  cost.textContent = noSupplies
    ? 'ПРИПАСОВ НЕТ · ПЕРЕХОД БЕЗ СПИСАНИЯ'
    : `СТОИМОСТЬ ПУТИ · ${TRAVEL_SUPPLY_COST} ПРИПАС`;
  const action = document.createElement('span');
  action.className = 'travel-choice-card__action';
  action.textContent = 'ВЫБРАТЬ ПУТЬ →';
  body.append(type, dangerOrSafe, flavor, hint, cost, action);
  button.append(visual, body);
  button.addEventListener('click', () => chooseChoice(choice, button));
  return button;
}

function renderChoices() {
  if (!screen || !activeRun) return;
  const step = (Number.isInteger(activeRun.journeyStep) ? activeRun.journeyStep : 0) + 1;
  const stepLabel = screen.querySelector('[data-travel-step]');
  if (stepLabel) stepLabel.textContent = `Шаг путешествия ${step}`;
  const routes = screen.querySelector('[data-travel-routes]');
  if (!routes) return;
  routes.replaceChildren();
  for (const choice of activeRun.currentTravelChoices || []) routes.append(routeCard(choice));
}

function combatCount(run, choice) {
  if (choice?.type === 'battle') return Number.isInteger(run?.battleCount) ? run.battleCount : 0;
  if (choice?.type === 'skirmish') return Number.isInteger(run?.skirmishCount) ? run.skirmishCount : 0;
  return null;
}

function dispatchEncounter(choice) {
  hideTravel();
  const detail = { source: 'travel-choice', runId: activeRun?.id || null, choice };
  if (choice.type === 'skirmish' || choice.type === 'battle') {
    globalThis.RPChessTravelEncounterOverride = choice;
  } else {
    delete globalThis.RPChessTravelEncounterOverride;
  }
  if (choice.type === 'skirmish') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:skirmish-open', { detail }));
    return;
  }
  if (choice.type === 'battle') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:battle-open', { detail }));
    return;
  }
  if (choice.type === 'settlement') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:settlement-open', { detail }));
    return;
  }
  throw new Error(`Travel Choice encounter type is not playable yet: ${choice.type}`);
}

function chooseChoice(choice, button) {
  if (routing) return;
  const current = readRun();
  if (!current || current.ended || current.activeTravelChoice) return;
  if (!validStoredChoices(current) || !current.currentTravelChoices.some((item) => item.id === choice.id)) return;

  routing = true;
  for (const card of screen?.querySelectorAll('[data-travel-choice]') || []) card.disabled = true;
  button?.classList.add('is-chosen');
  audio()?.click?.();

  const travelPayment = applyTravelSupplyCost(current);
  const count = combatCount(current, choice);
  const activeChoice = {
    ...choice,
    ...(Number.isInteger(count) ? { combatCountAtSelection: count } : {}),
    supplyCostAtSelection: travelPayment.requested,
    supplyPaid: travelPayment.paid
  };
  activeRun = writeRun({
    ...travelPayment.run,
    journeyStep: choice.step,
    currentTravelChoices: null,
    activeTravelChoice: activeChoice
  });
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  if (travelPayment.paid > 0) {
    globalThis.RPChessResources?.showChange?.({ suppliesDelta: -travelPayment.paid, label: 'ПЕРЕХОД' });
  } else {
    globalThis.RPChessResources?.showChange?.({ label: 'ПРИПАСОВ НЕТ' });
  }

  const delay = document.documentElement.dataset.reducedMotion === '1' ? 0 : 180;
  setTimeout(() => {
    routing = false;
    dispatchEncounter(activeChoice);
  }, delay);
}

function openTravel() {
  routing = false;
  activeRun = readRun();
  if (!activeRun || activeRun.ended) return;

  if (isTravelChoice(activeRun.activeTravelChoice) && PLAYABLE_TRAVEL_TYPES.includes(activeRun.activeTravelChoice.type)) {
    dispatchEncounter(activeRun.activeTravelChoice);
    return;
  }

  activeRun = ensureChoices(activeRun);
  renderChoices();
  showTravel();
}

function openRoster() {
  if (routing) return;
  audio()?.click?.();
  hideTravel();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
}

function activeChoiceCompleted(run) {
  const choice = run?.activeTravelChoice;
  if (!isTravelChoice(choice) || !['skirmish', 'battle'].includes(choice.type) || !Number.isInteger(choice.combatCountAtSelection)) return false;
  return combatCount(run, choice) > choice.combatCountAtSelection;
}

function applyAftermathTravelLabels() {
  const skirmishContinue = document.querySelector('[data-aftermath-continue]');
  const battleContinue = document.querySelector('[data-battle-continue]');
  if (skirmishContinue) skirmishContinue.textContent = 'Продолжить путь';
  if (battleContinue) battleContinue.textContent = 'Продолжить путь';
}

function syncRun() {
  activeRun = readRun();
  if (!activeRun) return;
  if (activeChoiceCompleted(activeRun)) {
    activeRun = writeRun({ ...activeRun, activeTravelChoice: null });
    queueMicrotask(applyAftermathTravelLabels);
  }
  if (screen && !screen.hidden && activeRun && !activeRun.ended && !activeRun.activeTravelChoice) {
    activeRun = ensureChoices(activeRun);
    renderChoices();
  }
}

function wireAftermathTravel() {
  applyAftermathTravelLabels();
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-aftermath-continue],[data-battle-continue]');
    if (!button) return;
    queueMicrotask(() => openTravel());
  });
}

ensureScreen();
wireAftermathTravel();
addEventListener('rpchess:travel-open', openTravel);
addEventListener('rpchess:run-updated', syncRun);

globalThis.RPChessTravelChoice = Object.freeze({
  open: openTravel,
  openRoster,
  get run() { return activeRun; },
  get choices() { return [...(activeRun?.currentTravelChoices || [])]; },
  get activeChoice() { return activeRun?.activeTravelChoice || null; }
});
