import { BACKGROUND_POOLS, RACE_TAGS, hashString, normalizeRaceTag } from './race-assets.mjs';

const VICTORY_FANFARE = 'SFX/win_fanfare.mp3';

function backdropPath(seed, raceTag = null, { generic = false } = {}) {
  if (generic) {
    const pool = BACKGROUND_POOLS.generic;
    return `assets/events/register-04/backgrounds/generic/${pool[hashString(`${seed}:generic-backdrop`) % pool.length]}`;
  }
  let race = normalizeRaceTag(raceTag);
  if (race === 'mixed') race = RACE_TAGS[hashString(`${seed}:backdrop-race`) % RACE_TAGS.length];
  const pool = BACKGROUND_POOLS[race] || BACKGROUND_POOLS.generic;
  const folder = BACKGROUND_POOLS[race] ? race : 'generic';
  return `assets/events/register-04/backgrounds/${folder}/${pool[hashString(`${seed}:backdrop`) % pool.length]}`;
}

function installStyles() {
  if (document.querySelector('[data-cross-scene-visuals]')) return;
  const style = document.createElement('style');
  style.dataset.crossSceneVisuals = '';
  style.textContent = `
    .travel-choice-screen{
      background:linear-gradient(180deg,rgba(2,7,13,.58),rgba(2,7,13,.86)),url('generated_assets/scene_campaign.jpg') center/cover fixed no-repeat!important;
    }
    .travel-choice-card__visual{
      background:linear-gradient(180deg,rgba(4,10,17,.10),rgba(4,8,15,.94)),var(--travel-card-backdrop,url('generated_assets/scene_campaign.jpg')) center/cover no-repeat!important;
    }
    .settlement-screen{
      background:linear-gradient(180deg,rgba(3,10,8,.54),rgba(3,8,12,.90)),var(--settlement-scene-backdrop,url('generated_assets/scene_shop.jpg')) center/cover fixed no-repeat!important;
    }
    .classic-screen{
      background:linear-gradient(90deg,rgba(3,7,15,.92),rgba(7,15,26,.60) 46%,rgba(3,7,15,.86)),var(--classic-scene-backdrop,url('generated_assets/scene_battle.jpg')) center/cover fixed no-repeat!important;
    }
    .puzzle-screen{
      background:linear-gradient(90deg,rgba(3,7,15,.90),rgba(7,15,26,.62) 48%,rgba(3,7,15,.88)),url('generated_assets/splash_poster.jpg') center/cover fixed no-repeat!important;
    }
    .puzzles-active .puzzle-board-wrap{width:min(100%,820px,calc(100vh - 126px))!important;}
    .skirmish-aftermath.is-victory,.battle-aftermath.is-victory{
      background:linear-gradient(90deg,rgba(3,7,15,.76),rgba(5,13,21,.45) 52%,rgba(3,7,15,.78)),url('generated_assets/scene_reward.jpg') center/cover fixed no-repeat!important;
    }
    .skirmish-aftermath.is-defeat,.battle-aftermath.is-defeat{
      background:linear-gradient(90deg,rgba(3,7,15,.82),rgba(18,8,11,.54) 52%,rgba(3,7,15,.86)),url('generated_assets/scene_defeat.jpg') center/cover fixed no-repeat!important;
    }
    .skirmish-aftermath.is-victory h1,.battle-aftermath.is-victory h1{
      font-family:'BrahmsGotischCyr',Georgia,serif!important;font-weight:400!important;color:#fff0c5!important;text-shadow:0 4px 18px rgba(0,0,0,.78)!important;
    }
    .classic-piece-marker,.puzzle-piece-marker{font-size:clamp(19.5px,1.575vw,25.5px)!important;}
    @media(max-width:620px){.classic-piece-marker,.puzzle-piece-marker{font-size:19.5px!important;}}
  `;
  document.head.append(style);
}

function choiceForCard(card) {
  const id = card?.dataset?.travelChoice;
  return id ? globalThis.RPChessTravelChoice?.choices?.find?.((choice) => choice.id === id) || null : null;
}

function routeBackdrop(choice, card) {
  const type = choice?.type || card?.dataset?.travelType || 'event';
  const seed = choice?.seed || choice?.id || card?.dataset?.travelChoice || `${type}:route`;
  if (type === 'puzzle') return 'generated_assets/splash_poster.jpg';
  if (type === 'event') return backdropPath(seed, null, { generic: true });
  if (type === 'settlement') return backdropPath(seed);
  return backdropPath(seed, choice?.enemyRaceTag || null);
}

function decorateTravelCards() {
  for (const card of document.querySelectorAll('[data-travel-choice]')) {
    const path = routeBackdrop(choiceForCard(card), card);
    if (card.dataset.travelBackdrop === path) continue;
    card.style.setProperty('--travel-card-backdrop', `url("${path}")`);
    card.dataset.travelBackdrop = path;
  }
}

function setCombatBackdrop(choice = null) {
  const screen = document.querySelector('[data-classic-screen]');
  if (!screen) return;
  const resolved = choice || globalThis.RPChessTravelEncounterOverride || null;
  const seed = resolved?.seed || resolved?.id || 'rpchess:combat';
  const path = backdropPath(seed, resolved?.enemyRaceTag || null);
  screen.style.setProperty('--classic-scene-backdrop', `url("${path}")`);
  screen.dataset.combatBackdrop = path;
}

function setSettlementBackdrop(choice = null) {
  const screen = document.querySelector('[data-settlement-screen]');
  if (!screen) return;
  const resolved = choice || globalThis.RPChessTravelChoice?.activeChoice || null;
  const seed = resolved?.seed || resolved?.id || 'rpchess:settlement';
  const path = backdropPath(seed);
  screen.style.setProperty('--settlement-scene-backdrop', `url("${path}")`);
  screen.dataset.settlementBackdrop = path;
}

function playVictoryFanfare(root) {
  if (!root || root.dataset.victoryFanfarePlayed === '1') return;
  const audio = globalThis.RPChessRebootAudio;
  const sfx = Number(audio?.settings?.sfx ?? 80);
  root.dataset.victoryFanfarePlayed = '1';
  if (!audio?.activated || sfx <= 0 || typeof Audio !== 'function') return;
  const fanfare = new Audio(VICTORY_FANFARE);
  fanfare.volume = Math.min(1, Math.max(0, sfx / 100) * .78);
  fanfare.play().catch(() => {});
}

function syncOutcomeScreens() {
  for (const root of document.querySelectorAll('[data-skirmish-aftermath],[data-battle-aftermath],[data-skirmish-run-end],[data-battle-run-end]')) {
    const runEnd = root.matches('[data-skirmish-run-end],[data-battle-run-end]');
    const title = root.querySelector('[data-aftermath-result],[data-battle-aftermath-result],[data-run-end-title]');
    const outcome = String(title?.textContent || '').trim().toUpperCase();
    const visible = !root.hidden;
    const victory = visible && outcome === 'ПОБЕДА';
    const defeat = visible && (runEnd || outcome === 'ПОРАЖЕНИЕ');
    root.classList.toggle('is-victory', victory);
    root.classList.toggle('is-defeat', defeat);
    if (victory) playVictoryFanfare(root);
    else delete root.dataset.victoryFanfarePlayed;
  }
}

function refresh() {
  decorateTravelCards();
  syncOutcomeScreens();
}

installStyles();
queueMicrotask(refresh);
addEventListener('rpchess:travel-open', () => queueMicrotask(decorateTravelCards));
addEventListener('rpchess:run-updated', () => queueMicrotask(refresh));
addEventListener('rpchess:skirmish-open', (event) => setCombatBackdrop(event?.detail?.choice));
addEventListener('rpchess:battle-open', (event) => setCombatBackdrop(event?.detail?.choice));
addEventListener('rpchess:settlement-open', (event) => setSettlementBackdrop(event?.detail?.choice));

const observer = new MutationObserver(() => queueMicrotask(refresh));
observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['hidden'] });

globalThis.RPChessSceneVisuals = Object.freeze({
  VICTORY_FANFARE,
  backdropPath,
  decorateTravelCards,
  setCombatBackdrop,
  setSettlementBackdrop,
  refresh
});
