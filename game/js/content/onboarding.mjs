import { platform } from '../platform.mjs';
import { currentLanguage, subscribe } from '../i18n.mjs';

const TUTORIAL_STORAGE_KEY = 'rpchess.reboot.v1.tutorial';
const TUTORIAL_SCHEMA_VERSION = 1;
const INCLUDED_HINTS = Object.freeze([
  'identity',
  'roster',
  'travel',
  'skirmishPrep',
  'skirmishChess',
  'battlePrep',
  'battleChess',
  'event',
  'settlement',
  'puzzle'
]);
const INCLUDED_HINT_SET = new Set(INCLUDED_HINTS);

const COPY = Object.freeze({
  ru:Object.freeze({
    dismiss:'Понятно',
    identity:Object.freeze({ title:'Начало похода', body:'Назовите своего героя. Это имя будет появляться в событиях и итогах похода.' }),
    roster:Object.freeze({ title:'Ваш отряд', body:'Здесь собраны все герои текущего похода. Следите за ранениями и составом, а затем отправляйтесь дальше.' }),
    travel:Object.freeze({ title:'Выбор пути', body:'Выберите одну из трёх карт маршрута. Учитывайте тип встречи, угрозу, награду и стоимость пути в припасах.' }),
    skirmishPrep:Object.freeze({ title:'Подготовка к стычке', body:'Соберите небольшой боевой отряд. Король обязателен, а остальные здоровые герои выбираются в пределах лимитов.' }),
    skirmishChess:Object.freeze({ title:'Стычка', body:'Дальше действуют обычные шахматные правила. Берегите именных героев: последствия боя останутся с отрядом.' }),
    battlePrep:Object.freeze({ title:'Подготовка к битве', body:'Битва использует полноценную армию. Проверьте персональных героев и состав перед началом партии.' }),
    battleChess:Object.freeze({ title:'Битва', body:'Побеждайте по шахматным правилам и следите за ценными героями. Исход партии влияет на дальнейший поход.' }),
    event:Object.freeze({ title:'Событие', body:'Читайте варианты внимательно: решения могут требовать героя, ресурсы или риск. Шанс успеха показан прямо в выборе.' }),
    settlement:Object.freeze({ title:'Поселение', body:'Здесь можно лечить раненых, нанимать новых героев и покупать припасы перед продолжением пути.' }),
    puzzle:Object.freeze({ title:'Тренировка', body:'Выполните шахматную задачу за ограниченное число ошибок. Чем точнее решение, тем выше награда.' })
  }),
  en:Object.freeze({
    dismiss:'Got it',
    identity:Object.freeze({ title:'Start the journey', body:'Name your hero. This name will appear in events and in the final record of the run.' }),
    roster:Object.freeze({ title:'Your party', body:'All heroes in the current run are shown here. Track wounds and party composition, then continue the journey.' }),
    travel:Object.freeze({ title:'Choose a path', body:'Pick one of three route cards. Consider encounter type, threat, reward, and the Supplies cost of travelling.' }),
    skirmishPrep:Object.freeze({ title:'Prepare for a skirmish', body:'Build a small combat party. The King is required; add healthy heroes while staying within the limits.' }),
    skirmishChess:Object.freeze({ title:'Skirmish', body:'Normal chess rules apply from here. Protect named heroes: combat consequences stay with your party.' }),
    battlePrep:Object.freeze({ title:'Prepare for battle', body:'Battles use a full army. Review your named heroes and the final composition before starting the game.' }),
    battleChess:Object.freeze({ title:'Battle', body:'Win by normal chess rules and protect valuable heroes. The result affects the rest of the run.' }),
    event:Object.freeze({ title:'Event', body:'Read each choice carefully: options can require a hero, resources, or risk. Success chance is shown in the choice.' }),
    settlement:Object.freeze({ title:'Settlement', body:'Heal wounded heroes, recruit new ones, and buy Supplies here before you return to the road.' }),
    puzzle:Object.freeze({ title:'Training', body:'Solve the chess objective with a limited number of mistakes. More accurate play earns a better reward.' })
  })
});

let overlay = null;
let currentHint = null;
let previousFocus = null;
let installed = false;
let unsubscribeLanguage = null;

function emptyState() {
  return { schemaVersion:TUTORIAL_SCHEMA_VERSION, activated:false, dismissed:{} };
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== TUTORIAL_SCHEMA_VERSION) return emptyState();
  const dismissed = {};
  for (const key of INCLUDED_HINTS) if (value.dismissed?.[key] === true) dismissed[key] = true;
  return { schemaVersion:TUTORIAL_SCHEMA_VERSION, activated:Boolean(value.activated), dismissed };
}

function readTutorialState() {
  try {
    const raw = platform.storage.local?.getItem(TUTORIAL_STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyState();
  }
}

function writeTutorialState(state) {
  const normalized = normalizeState(state);
  try { platform.storage.local?.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(normalized)); }
  catch (error) { console.warn('[RPChess] tutorial state write failed', error); }
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:tutorial-updated', { detail:{ state:normalized } }));
  }
  return normalized;
}

function activateOnboarding() {
  const state = readTutorialState();
  if (state.activated) return state;
  return writeTutorialState({ ...state, activated:true });
}

function copyFor(key) {
  const language = currentLanguage() === 'en' ? 'en' : 'ru';
  return { ...COPY[language][key], dismiss:COPY[language].dismiss };
}

function ensureStyles() {
  if (document.querySelector('[data-rpchess-onboarding-style]')) return;
  const style = document.createElement('style');
  style.dataset.rpchessOnboardingStyle = '';
  style.textContent = `
.rpchess-onboarding[hidden]{display:none!important}
.rpchess-onboarding{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;box-sizing:border-box;padding:clamp(12px,2.5vw,28px);background:rgba(2,6,12,.78);backdrop-filter:blur(3px)}
.rpchess-onboarding__card{width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 24px);box-sizing:border-box;overflow:hidden;padding:22px 24px 20px;border:1px solid rgba(210,180,112,.72);border-radius:14px;background:rgba(7,13,22,.98);box-shadow:0 22px 72px rgba(0,0,0,.52);display:grid;gap:12px;text-align:left}
.rpchess-onboarding__kicker{font:700 11px/1.1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#d9bd7b}
.rpchess-onboarding__title{margin:0;font-size:clamp(24px,3vw,34px);line-height:1.05}
.rpchess-onboarding__body{margin:0;font:500 16px/1.45 system-ui,sans-serif;color:rgba(244,247,250,.88)}
.rpchess-onboarding__actions{display:flex;justify-content:flex-end;margin-top:2px}
.rpchess-onboarding__button{min-width:148px}
body.rpchess-onboarding-open{overflow:hidden!important}
@media (max-height:430px){.rpchess-onboarding{padding:10px 14px}.rpchess-onboarding__card{width:min(620px,calc(100vw - 28px));max-height:calc(100dvh - 20px);padding:12px 16px;gap:7px;border-radius:10px}.rpchess-onboarding__kicker{font-size:9px}.rpchess-onboarding__title{font-size:22px}.rpchess-onboarding__body{font-size:13px;line-height:1.3}.rpchess-onboarding__actions{margin-top:0}.rpchess-onboarding__button{min-width:128px;min-height:34px;padding-top:6px!important;padding-bottom:6px!important}}
`;
  document.head.append(style);
}

function ensureOverlay() {
  if (overlay) return overlay;
  ensureStyles();
  overlay = document.createElement('div');
  overlay.className = 'rpchess-onboarding';
  overlay.dataset.tutorialOverlay = '';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="rpchess-onboarding__card ui-panel-surface" role="dialog" aria-modal="true" aria-labelledby="rpchess-onboarding-title" aria-describedby="rpchess-onboarding-body">
      <div class="rpchess-onboarding__kicker" data-tutorial-kicker>RPCHESS · GUIDE</div>
      <h2 class="rpchess-onboarding__title" id="rpchess-onboarding-title" data-tutorial-title></h2>
      <p class="rpchess-onboarding__body" id="rpchess-onboarding-body" data-tutorial-body></p>
      <div class="rpchess-onboarding__actions">
        <button class="reboot-button reboot-button--primary rpchess-onboarding__button" type="button" data-tutorial-dismiss></button>
      </div>
    </section>`;
  overlay.querySelector('[data-tutorial-dismiss]')?.addEventListener('click', dismissCurrentHint);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      overlay.querySelector('[data-tutorial-dismiss]')?.focus();
    }
  });
  document.body.append(overlay);
  return overlay;
}

function renderCurrentHint() {
  if (!overlay || !currentHint) return;
  const copy = copyFor(currentHint);
  const title = overlay.querySelector('[data-tutorial-title]');
  const body = overlay.querySelector('[data-tutorial-body]');
  const dismiss = overlay.querySelector('[data-tutorial-dismiss]');
  const kicker = overlay.querySelector('[data-tutorial-kicker]');
  if (title) title.textContent = copy.title;
  if (body) body.textContent = copy.body;
  if (dismiss) dismiss.textContent = copy.dismiss;
  if (kicker) kicker.textContent = currentLanguage() === 'en' ? 'RPCHESS · GUIDE' : 'RPCHESS · ОБУЧЕНИЕ';
}

function showHint(key) {
  if (!INCLUDED_HINT_SET.has(key)) return false;
  const state = readTutorialState();
  if (!state.activated || state.dismissed[key] || currentHint) return false;
  const root = ensureOverlay();
  currentHint = key;
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root.dataset.tutorialHint = key;
  renderCurrentHint();
  root.hidden = false;
  document.body.classList.add('rpchess-onboarding-open');
  requestAnimationFrame(() => root.querySelector('[data-tutorial-dismiss]')?.focus());
  return true;
}

function dismissCurrentHint() {
  if (!currentHint) return false;
  const key = currentHint;
  const state = readTutorialState();
  writeTutorialState({ ...state, activated:true, dismissed:{ ...state.dismissed, [key]:true } });
  currentHint = null;
  if (overlay) {
    overlay.hidden = true;
    delete overlay.dataset.tutorialHint;
  }
  document.body.classList.remove('rpchess-onboarding-open');
  previousFocus?.focus?.();
  previousFocus = null;
  return true;
}

function scheduleHint(key) {
  requestAnimationFrame(() => showHint(key));
}

function installOnboarding() {
  if (installed) return;
  installed = true;
  ensureOverlay();
  const eventHints = Object.freeze({
    'rpchess:run-new':'roster',
    'rpchess:travel-open':'travel',
    'rpchess:skirmish-open':'skirmishPrep',
    'rpchess:battle-open':'battlePrep',
    'rpchess:event-open':'event',
    'rpchess:settlement-open':'settlement',
    'rpchess:puzzle-open':'puzzle'
  });
  for (const [eventName, hint] of Object.entries(eventHints)) {
    globalThis.addEventListener?.(eventName, () => scheduleHint(hint));
  }
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-skirmish-start]')) scheduleHint('skirmishChess');
    if (target?.closest('[data-battle-start]')) scheduleHint('battleChess');
  });
  unsubscribeLanguage = subscribe(() => renderCurrentHint());
}

function destroyOnboarding() {
  unsubscribeLanguage?.();
  unsubscribeLanguage = null;
}

function onboardingStatus() {
  const state = readTutorialState();
  return Object.freeze({
    activated:state.activated,
    dismissed:Object.freeze({ ...state.dismissed }),
    included:Object.freeze([...INCLUDED_HINTS]),
    current:currentHint
  });
}

export {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_SCHEMA_VERSION,
  INCLUDED_HINTS,
  activateOnboarding,
  readTutorialState,
  writeTutorialState,
  showHint,
  dismissCurrentHint,
  installOnboarding,
  destroyOnboarding,
  onboardingStatus
};
