import { platform } from '../platform.mjs';
import { currentLanguage, subscribe } from '../i18n.mjs';

const TUTORIAL_STORAGE_KEY = 'rpchess.reboot.v1.tutorial';
const TUTORIAL_SCHEMA_VERSION = 1;
const INCLUDED_HINTS = Object.freeze(["identity","roster","kingdomMap","kingdomCastle","kingdomProduction","artifact","skirmishChess","battleChess","event","settlement","puzzle","caravanChess","starvation","chronicle","arenaCatalog","arenaFoe","arenaArtifact","arenaChess"]);
const INCLUDED_HINT_SET = new Set(INCLUDED_HINTS);

const COPY = Object.freeze({
  "ru": {
    "identity": {
      "title": "«Для начала выбери имя и короля. Имя попадёт в летопись, а король — во все неприятности!»",
      "body": "Назови героя и выбери портрет короля. Это начало нового похода."
    },
    "roster": {
      "title": "«Знакомься, это твой отряд. Короля береги: запасного не выдадут!»",
      "body": "Здесь живут именные герои: смотри их состояние и выбирай состав. Раненых лечат в поселениях, а безымянную армию нанимают в замке."
    },
    "kingdomMap": {
      "title": "«Мир огромный, а ноги у короля короткие. Придётся путешествовать!»",
      "body": "Перетаскивай короля на соседнюю клетку в любом из 8 направлений. Туман скрывает встречи; касание клетки лишь показывает описание. За шаг вне владений тратится 1 припас."
    },
    "kingdomCastle": {
      "title": "«Замок — сердце королевства. И моя любимая безопасная крепость!»",
      "body": "Нажми на замок: здесь за золото нанимают безымянные фигуры. Значок ×N показывает их количество. Именные герои остаются в Отряде."
    },
    "kingdomProduction": {
      "title": "«Смотри-ка, трудятся без нас! Вот бы и мои носки так стирались.»",
      "body": "Раз в игровую неделю освоенные места могут приносить золото, припасы, бойцов и осколки. Нажимай на значок сбора над клеткой, чтобы забрать награду."
    },
    "artifact": {
      "title": "«Магические безделушки! Хороший артефакт спасает даже тех, кто слушает мои советы.»",
      "body": "Выбери доступный артефакт на этот бой или продолжи без него."
    },
    "skirmishChess": {
      "title": "«Маленькая драка — тоже искусство. Особенно если дерутся другие!»",
      "body": "Стычка следует шахматным правилам. Именные герои могут получить ранения."
    },
    "battleChess": {
      "title": "«Вот теперь всё серьёзно. Я, пожалуй, буду командовать из обоза!»",
      "body": "Это полноценная шахматная битва. Береги короля и ценных героев."
    },
    "event": {
      "title": "«Тут решения принимают словами. Я однажды не прочёл условия и женился!»",
      "body": "Сравни варианты, требования, цену и указанный шанс успеха."
    },
    "settlement": {
      "title": "«Цивилизация! Бесплатно здесь только мои советы. И то не всегда.»",
      "body": "У знахарки лечат именных героев, в таверне нанимают новых, на рынке покупают припасы. В освоенном поселении услуги можно открыть снова без платы за вход."
    },
    "puzzle": {
      "title": "«Проверим, что у тебя под короной! Не волнуйся, я никому не скажу.»",
      "body": "Реши шахматную задачу. Ошибок разрешено немного; точная игра даёт больше наград."
    },
    "caravanChess": {
      "title": "«Фигуры стоят как попало! Это не беспорядок, это шахматы Фишера!»",
      "body": "Фигуры ходят по шахматным правилам, но начальная позиция и рокировка особенные."
    },
    "starvation": {
      "title": "«Пустой мешок — плохой спутник. Особенно если он наш!»",
      "body": "На шаге без припасов случайный именной герой может погибнуть. Даже король: тогда поход закончится. Следи за запасами перед выходом за границу."
    },
    "chronicle": {
      "title": "«Я записал все подвиги. Мои, разумеется, самые крупные!»",
      "body": "Летопись показывает достижения текущего похода и историю завершённых. Заглядывай сюда, чтобы оценить, как выросло твоё королевство."
    },
    "arenaCatalog": {
      "title": "«Добро пожаловать на Арену! Здесь за тумаки дают Осколки чести.»",
      "body": "Побеждай соперников, получай осколки и открывай новые отряды."
    },
    "arenaFoe": {
      "title": "«Посмотри на этого красавца! Он явно уверен в победе. Попробуем переубедить.»",
      "body": "Оцени мощь и статистику соперника перед началом партии."
    },
    "arenaArtifact": {
      "title": "«На Арене даже волшебство платное. Моё обаяние пока бесплатно.»",
      "body": "Выбери артефакт за Осколки чести или начни без него."
    },
    "arenaChess": {
      "title": "«На доску, герой! Я буду болеть за тебя с безопасного расстояния.»",
      "body": "Играй по шахматным правилам. Победа приносит осколки и открывает новых соперников."
    }
  },
  "en": {
    "identity": {
      "title": "“First, choose a name and a king. The name goes into the Chronicle; the king gets all the trouble!”",
      "body": "Name your hero and choose the king’s portrait to begin a new journey."
    },
    "roster": {
      "title": "“Meet your squad. Guard the King: we do not get a spare!”",
      "body": "Named heroes live here. Check their condition and choose your formation. Heal wounds in Settlements; hire unnamed troops at the Castle."
    },
    "kingdomMap": {
      "title": "“The world is huge, and our King has tiny legs. Off we go!”",
      "body": "Drag the King to any adjacent tile, in all 8 directions. Fog hides encounters; tapping a tile only inspects it. Each step outside your territory costs 1 Supply."
    },
    "kingdomCastle": {
      "title": "“The Castle is our kingdom's heart. And my favorite safe place!”",
      "body": "Tap the Castle to recruit unnamed chess pieces for Gold. The ×N badge shows how many you own. Your named heroes stay in the Squad."
    },
    "kingdomProduction": {
      "title": "“Look at them working without us! If only my socks did that.”",
      "body": "Once per game week, cleared sites may yield Gold, Supplies, troops or Honor Shards. Tap the collection icon above a tile to claim its reward."
    },
    "artifact": {
      "title": "“Magical trinkets! A good artifact can even save someone who follows my advice.”",
      "body": "Choose an available artifact for this fight or continue without one."
    },
    "skirmishChess": {
      "title": "“A small skirmish is still an art. Especially if other people do the fighting!”",
      "body": "Normal chess rules apply. Named heroes can suffer lasting wounds."
    },
    "battleChess": {
      "title": "“Now this is serious. I shall command from the safety of the supply wagon!”",
      "body": "This is a full chess battle. Protect your king and valuable heroes."
    },
    "event": {
      "title": "“Here we fight with words. I once failed to read the fine print and got married!”",
      "body": "Check each option’s requirements, costs and displayed success chance."
    },
    "settlement": {
      "title": "“Civilization! My advice may be the only free thing around.”",
      "body": "Heal named heroes at the Healer, recruit in the Tavern, buy Supplies at the Market. Reopen services in a cleared Settlement without a new entry fee."
    },
    "puzzle": {
      "title": "“Let us see what is under that crown! I promise I will not tell anyone.”",
      "body": "Solve the chess puzzle. Mistakes are limited; more accurate play earns a better reward."
    },
    "caravanChess": {
      "title": "“The pieces are all scrambled! It is not a mess; it is Fischer Random Chess!”",
      "body": "Pieces move as usual, but the starting arrangement and castling are different."
    },
    "starvation": {
      "title": "“An empty bag is a terrible traveling companion. Especially ours!”",
      "body": "If you move without enough Supplies, a random named hero may die. Even the King, ending the run. Watch your stock before leaving your borders."
    },
    "chronicle": {
      "title": "“I recorded all heroic deeds. Mine in especially large letters!”",
      "body": "The Chronicle shows your current run's progress and the history of completed journeys. Check how your kingdom has grown."
    },
    "arenaCatalog": {
      "title": "“Welcome to the Arena! Here they pay you in Honor Shards for getting bruised.”",
      "body": "Defeat opponents, earn shards and unlock new squads."
    },
    "arenaFoe": {
      "title": "“Look at this one! So confident. Shall we disappoint them?”",
      "body": "Check the opponent’s Power and match record before the fight."
    },
    "arenaArtifact": {
      "title": "“Even magic costs money in the Arena. My charm is still free.”",
      "body": "Spend Honor Shards on an artifact, or fight without one."
    },
    "arenaChess": {
      "title": "“To the board! I shall cheer from a safe distance.”",
      "body": "Play by chess rules. Wins earn shards and unlock tougher opponents."
    }
  }
});
const DISMISS = Object.freeze({ru:'Понятно',en:'Got it'});

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
  return { ...COPY[language][key], dismiss:DISMISS[language] };
}

function ensureStyles() {
  if (document.querySelector('[data-rpchess-onboarding-style]')) return;
  const style = document.createElement('style');
  style.dataset.rpchessOnboardingStyle = '';
  style.textContent = `
.rpchess-onboarding[hidden]{display:none!important}
.rpchess-onboarding{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;box-sizing:border-box;padding:12px;background:rgba(2,5,9,.76);backdrop-filter:blur(2px)}
.rpchess-onboarding__layout{
 position:relative;isolation:isolate;box-sizing:border-box;min-width:0;
 width:min(730px,calc(100vw - 28px));
 --rpchess-jester-card-start:clamp(122px,21vh,165px);
 padding-top:var(--rpchess-jester-card-start);
}
.rpchess-onboarding__portrait{
 position:absolute;z-index:1;top:auto;left:clamp(20px,5.5vw,66px);
 bottom:calc(100% - var(--rpchess-jester-card-start) - 18px);
 display:block;width:min(clamp(185px,25vw,240px),42vh);height:auto;
 max-height:calc(100dvh - 14px);object-fit:contain;object-position:top;
 pointer-events:none;user-select:none;filter:drop-shadow(0 12px 18px rgba(0,0,0,.52));
}
.rpchess-onboarding__card{
 position:relative;z-index:2;box-sizing:border-box;width:100%;min-width:0;
 min-height:clamp(205px,29vh,282px);max-height:calc(100dvh - 160px);
 overflow:hidden;display:grid;align-content:center;gap:clamp(10px,1.7vw,18px);
 padding:clamp(16px,2vw,24px)!important;
 border:1px solid rgba(224,181,85,.75)!important;border-radius:22px!important;
 background:linear-gradient(145deg,rgba(34,27,20,.985),rgba(8,11,15,.99) 61%)!important;
 box-shadow:0 22px 72px rgba(0,0,0,.7),inset 0 1px rgba(240,204,128,.12)!important;
 text-align:left;
}
.rpchess-onboarding__card:before{
 content:'';position:absolute;top:0;left:16px;width:125px;height:2px;
 background:linear-gradient(90deg,#e8bf60,transparent);pointer-events:none;
}
.rpchess-onboarding__title{margin:0!important;color:#f7e9c9!important;font:700 clamp(17px,2vw,24px)/1.34 system-ui,sans-serif!important;letter-spacing:normal!important}
.rpchess-onboarding__tip{display:flex;align-items:flex-start;gap:12px;margin:0;padding:clamp(9px,1.25vw,15px);border:1px solid rgba(222,187,92,.26);border-radius:12px;background:rgba(239,201,125,.07)}
.rpchess-onboarding__tip-dot{flex:0 0 auto;width:9px;height:9px;margin-top:7px;border-radius:50%;background:#d8b15d;box-shadow:0 0 0 5px rgba(216,177,93,.13)}
.rpchess-onboarding__body{margin:0!important;font:500 clamp(12px,1.4vw,16px)/1.43 system-ui,sans-serif!important;color:#ded3be!important}
.rpchess-onboarding__actions{display:flex;justify-content:flex-end;margin:0}
.rpchess-onboarding__button.reboot-button{
 flex:0 0 auto;width:auto!important;max-width:180px;min-width:clamp(125px,15vw,170px);
 min-height:44px;padding:8px 18px!important;justify-self:end;
}
body.rpchess-onboarding-open{overflow:hidden!important}
@media (max-height:430px){
 .rpchess-onboarding{padding:7px}
 .rpchess-onboarding__layout{width:min(660px,calc(100vw - 14px));--rpchess-jester-card-start:94px;padding-top:var(--rpchess-jester-card-start)}
 .rpchess-onboarding__portrait{top:auto;bottom:calc(100% - var(--rpchess-jester-card-start) - 16px);left:clamp(14px,3vw,30px);width:clamp(132px,18vw,155px);max-height:155px}
 .rpchess-onboarding__card{min-height:0;max-height:calc(100dvh - 108px);padding:12px 16px!important;gap:9px;border-radius:15px!important}
 .rpchess-onboarding__title{font-size:clamp(14px,1.95vw,19px)!important;line-height:1.23!important}
 .rpchess-onboarding__tip{padding:7px 10px;gap:9px}
 .rpchess-onboarding__body{font-size:clamp(11px,1.6vw,13px)!important;line-height:1.3!important}
 .rpchess-onboarding__button.reboot-button{min-width:115px;min-height:34px;padding:5px 12px!important}
}
@media (orientation:portrait) and (max-width:620px){
 .rpchess-onboarding__layout{width:min(420px,calc(100vw - 20px));--rpchess-jester-card-start:112px;padding-top:var(--rpchess-jester-card-start)}
 .rpchess-onboarding__portrait{left:18px;top:auto;bottom:calc(100% - var(--rpchess-jester-card-start) - 16px);width:165px;max-height:175px}
 .rpchess-onboarding__card{min-height:0;max-height:calc(100dvh - 125px);padding:16px!important}
 .rpchess-onboarding__title{font-size:19px!important}
 .rpchess-onboarding__body{font-size:14px!important}
}
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
    <div class="rpchess-onboarding__layout">
      <img class="rpchess-onboarding__portrait" src="assets/ui/jester-patrick.webp" alt="" aria-hidden="true">
      <section class="rpchess-onboarding__card ui-panel-surface" role="dialog" aria-modal="true" aria-labelledby="rpchess-onboarding-title" aria-describedby="rpchess-onboarding-body">
        <p class="rpchess-onboarding__title" id="rpchess-onboarding-title" data-tutorial-title></p>
        <div class="rpchess-onboarding__tip"><span class="rpchess-onboarding__tip-dot" aria-hidden="true"></span><p class="rpchess-onboarding__body" id="rpchess-onboarding-body" data-tutorial-body></p></div>
        <div class="rpchess-onboarding__actions">
          <button class="reboot-button reboot-button--primary rpchess-onboarding__button" type="button" data-tutorial-dismiss></button>
        </div>
      </section>
    </div>`;
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
  if (title) title.textContent = copy.title;
  if (body) body.textContent = copy.body;
  if (dismiss) dismiss.textContent = copy.dismiss;
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

function scheduleHint(key, requiredVisible = null) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (requiredVisible && !document.querySelector(requiredVisible)) return;
    showHint(key);
  }));
}
function installOnboarding() {
  if (installed) return;
  installed = true;
  ensureOverlay();
  const eventHints = Object.freeze({
    'rpchess:run-new':['roster','[data-roster-screen]:not([hidden])'],
    'rpchess:kingdom-map-shown':['kingdomMap','[data-kingdom-map-screen]:not([hidden])'],
    'rpchess:kingdom-castle-inspected':['kingdomCastle','[data-kingdom-map-screen]:not([hidden])'],
    'rpchess:kingdom-production-collected':['kingdomProduction','[data-kingdom-map-screen]:not([hidden])'],
    'rpchess:event-open':['event','[data-events-screen]:not([hidden])'],
    'rpchess:settlement-shown':['settlement','[data-settlement-screen]:not([hidden])'],
    'rpchess:puzzle-shown':['puzzle','[data-puzzle-screen]:not([hidden])'],
    'rpchess:artifact-offer':['artifact','[data-artifact-choice-modal]'],
    'rpchess:starvation-shown':['starvation','[data-starvation-screen]:not([hidden])'],
    'rpchess:chronicle-visible':['chronicle','[data-chronicle-panel]'],
    'rpchess:arena-foe-shown':['arenaFoe'],
    'rpchess:arena-artifact-shown':['arenaArtifact']
  });
  for (const [eventName, [hint, selector]] of Object.entries(eventHints)) {
    globalThis.addEventListener?.(eventName, () => scheduleHint(hint, selector||null));
  }
  globalThis.addEventListener?.('rpchess:combat-started', (event) => {
    const type=event?.detail?.combatType;
    scheduleHint(type==='caravan'?'caravanChess':type==='skirmish'?'skirmishChess':'battleChess',
      '[data-classic-screen]:not([hidden])');
  });
  globalThis.addEventListener?.('rpchess:arena-catalog-shown', () => {
    activateOnboarding(); scheduleHint('arenaCatalog','[data-arena-catalog]:not([hidden])');
  });
  globalThis.addEventListener?.('rpchess:arena-battle-shown', () =>
    scheduleHint('arenaChess','[data-arena-battle]:not([hidden])'));
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
