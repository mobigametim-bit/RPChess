import { readRun, writeRun } from './run-persistence.mjs';
import { PIECE_GLYPHS, PIECE_LABELS } from './roster-data.mjs';
import { eventBackgroundPath } from './race-assets.mjs';
import { literaryStory } from './event-narrative.mjs';
import { playerNameForRun, personalizePlayerNarrative, personalizePlayerTitle } from './player-identity-core.mjs';
import { EVENT_CONTENT_V3, applyEventContentV3, formatHeroReaction } from './events/event-content-v3.mjs';
import {
  choiceAvailability,
  completeEvent,
  createEventState,
  eventCombatCompleted,
  markEventCombatStarted,
  normalizedEvent,
  resolveEventChoice
} from './events-core.mjs';

let screen = null;
let activeRun = null;
let busy = false;
let syncingCombat = false;

function audio() { return globalThis.RPChessRebootAudio; }
function playerName() { return playerNameForRun(activeRun); }
function ensureCss() {
  if (!document.querySelector('[data-events-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/events.css?v=20260830-events-v3';
    link.dataset.eventsCss = '';
    document.head.append(link);
  }
  if (!document.querySelector('[data-events-v5-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/events-v5.css?v=20260831-events-v5';
    link.dataset.eventsV5Css = '';
    document.head.append(link);
  }
}

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;
  ensureCss();
  screen = document.createElement('main');
  screen.className = 'events-screen';
  screen.dataset.eventsScreen = '';
  screen.hidden = true;
  screen.setAttribute('aria-label', 'Дорожное событие');
  screen.innerHTML = `
    <div class="events-backdrop" aria-hidden="true">
      <img data-events-background alt="">
    </div>
    <div class="events-shell">
      <header class="events-topbar">
        <img class="events-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
        <div class="events-topbar__actions">
          <button class="reboot-button reboot-button--primary" type="button" data-events-roster>Отряд</button>
          <button class="reboot-button reboot-button--primary" type="button" data-events-settings>Настройки</button>
        </div>
      </header>
      <section class="events-panel">
        <div class="events-copy-frame ui-panel-safe">
          <div class="events-kicker"><span>СОБЫТИЕ</span><strong data-events-race></strong></div>
          <h1 data-events-title></h1>
          <div class="events-story" data-events-story></div>
          <div class="events-reaction events-reaction--king" data-events-king-reaction hidden></div>
        </div>
        <div class="events-choice-frame ui-panel-safe" data-events-choice-frame>
          <div class="events-choices" data-events-choices></div>
        </div>
      </section>
    </div>
    <div class="events-outcome-modal" data-events-outcome hidden>
      <section class="events-outcome-card ui-panel-safe" role="dialog" aria-modal="true" aria-labelledby="events-outcome-title">
        <div class="reboot-eyebrow" data-events-outcome-eyebrow>ИСХОД</div>
        <h2 id="events-outcome-title" data-events-outcome-title></h2>
        <div class="events-roll" data-events-roll></div>
        <div class="events-outcome-notes" data-events-outcome-notes></div>
        <button class="reboot-button reboot-button--primary events-continue" type="button" data-events-continue>ПРОДОЛЖИТЬ ПУТЬ</button>
      </section>
    </div>`;
  app.append(screen);
  screen.querySelector('[data-events-roster]')?.addEventListener('click', openRoster);
  screen.querySelector('[data-events-settings]')?.addEventListener('click', () => { audio()?.click?.(); globalThis.RPChessOpenSettings?.(); });
  screen.querySelector('[data-events-continue]')?.addEventListener('click', continueOutcome);
  screen.addEventListener('click', handleChoice);
  return screen;
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove('roster-active','skirmish-active','battle-active','classic-chess-active','settlement-active','starvation-active','travel-choice-active');
}
function showEvents() {
  const root = ensureScreen();
  if (!root) return;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('events-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
}
function hideEvents() { if (screen) screen.hidden = true; document.body.classList.remove('events-active'); }

function riskLabel(choice) {
  const warnings = [...(choice.warnings || [])];
  if (choice.kingRisk && !warnings.some((x) => x.includes('КОРОЛЬ'))) warnings.push('КОРОЛЬ МОЖЕТ ПОГИБНУТЬ');
  return warnings.join(' · ');
}
function costLabel(choice) {
  const parts=[];
  if(choice.cost?.gold)parts.push(`${choice.cost.gold} Gold`);
  if(choice.cost?.supplies)parts.push(`${choice.cost.supplies} Supplies`);
  return parts.join(' · ');
}
function reactionHero(choice, availability) {
  if (availability?.hero) return availability.hero;
  if (!choice?.role) return null;
  return (activeRun?.roster || [])
    .filter((hero) => hero.pieceType === choice.role && hero.status === 'healthy' && !hero.isRunKing)
    .sort((a,b) => String(a.id).localeCompare(String(b.id)))[0] || null;
}
function v5HeroState(choice) {
  if (!choice?.requiredHeroId) return null;
  const hero = (activeRun?.roster || []).find((entry) => entry?.id === choice.requiredHeroId) || null;
  const name = choice.requiredHeroName || hero?.name || 'Именной герой';
  if (!hero) return { hero:null, name, state:'missing', locked:true, label:'🔒' };
  if (hero.status === 'dead') return { hero, name, state:'dead', locked:true, label:`🔒 ${name} — ПОГИБ` };
  if (hero.status !== 'healthy') return { hero, name, state:'wounded', locked:true, label:`🔒 ${name} — РАНЕН` };
  return { hero, name, state:'healthy', locked:false, label:name };
}
function displayedChoiceAction(choice) {
  if (!choice?.sourceChoiceId) return choice?.action || '';
  return EVENT_CONTENT_V3[activeRun?.currentEvent?.eventId]?.choices?.[choice.sourceChoiceId]?.action || choice.action || '';
}

function choiceButton(eventChoice) {
  const availability = choiceAvailability(activeRun, eventChoice);
  const choice = availability.choice;
  const heroState = v5HeroState(choice);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'events-choice';
  if (heroState) button.classList.add('events-choice--hero', `events-choice--hero-${heroState.state}`);
  if (heroState?.locked) button.classList.add('events-choice--hero-locked');
  button.dataset.eventChoice = choice.id;
  if (choice.requiredHeroId) button.dataset.requiredHeroId = choice.requiredHeroId;
  if (heroState?.state) button.dataset.heroState = heroState.state;
  button.disabled = !availability.enabled || busy;
  button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
  const role = heroState ? '' : availability.hero ? `${PIECE_GLYPHS[availability.hero.pieceType] || ''} ${availability.hero.name}` : choice.role ? `${PIECE_GLYPHS[choice.role] || ''} ${PIECE_LABELS[choice.role] || choice.role}` : '';
  const chance = choice.chance < 100 ? `${choice.chance}% УСПЕХА` : 'ГАРАНТИРОВАННО';
  const cost = costLabel(choice), risk = riskLabel(choice);
  button.innerHTML = `<span class="events-choice__head"><strong></strong><span>${chance}</span></span><span class="events-choice__meta">${[role,cost,risk].filter(Boolean).map((x)=>`<small>${x}</small>`).join('')}</span>${availability.enabled?'':`<span class="events-choice__disabled">${availability.reason}</span>`}`;
  button.querySelector('strong').textContent = personalizePlayerNarrative(displayedChoiceAction(choice), playerName());

  if (heroState) {
    const heroBlock = document.createElement('span');
    heroBlock.className = 'events-choice__hero';
    const heroName = document.createElement('b');
    heroName.className = 'events-choice__hero-name';
    heroName.textContent = heroState.label;
    const heroLine = document.createElement('span');
    heroLine.className = 'events-choice__hero-line';
    heroLine.textContent = `«${personalizePlayerNarrative(String(choice.heroLine || '').trim(), playerName())}»`;
    heroBlock.append(heroName, heroLine);
    button.prepend(heroBlock);
  } else {
    const reactionText = formatHeroReaction(choice.heroReaction, reactionHero(choice, availability));
    if (reactionText) {
      const reaction = document.createElement('span');
      reaction.className = 'events-choice__reaction';
      reaction.textContent = personalizePlayerNarrative(reactionText, playerName());
      button.prepend(reaction);
    }
  }
  return button;
}

function renderStory(event) {
  const root = screen?.querySelector('[data-events-story]');
  if (!root) return;
  root.replaceChildren();
  const paragraphs = Array.isArray(event.storyParagraphs) && event.storyParagraphs.length ? event.storyParagraphs : literaryStory(event);
  for (const paragraph of paragraphs) {
    const p=document.createElement('p');
    p.textContent=personalizePlayerNarrative(paragraph, playerName());
    root.append(p);
  }
}

function renderKingReaction(event) {
  const root = screen?.querySelector('[data-events-king-reaction]');
  if (!root) return;
  const text = personalizePlayerNarrative(String(event?.kingReaction || '').trim(), playerName());
  root.hidden = !text;
  root.textContent = text;
}

function renderBackground(event) {
  const image = screen?.querySelector('[data-events-background]');
  if (!image) return;
  const assetPath = eventBackgroundPath(event);
  const fallbackPath = 'assets/events/register-04/backgrounds/generic/forest_crossroad.png';
  image.dataset.assetPath = assetPath;
  image.dataset.fallbackApplied = '0';
  image.onerror = () => {
    if (image.dataset.fallbackApplied === '1') return;
    image.dataset.fallbackApplied = '1';
    image.src = new URL(fallbackPath, document.baseURI).href;
  };
  image.src = new URL(assetPath, document.baseURI).href;
  screen.dataset.eventsBackgroundPath = assetPath;
}

function renderEvent() {
  if (!screen || !activeRun?.currentEvent) return;
  const event = applyEventContentV3(normalizedEvent(activeRun.currentEvent.eventId));
  if (!event) return;
  renderBackground(event);
  screen.querySelector('[data-events-title]').textContent = personalizePlayerTitle(event.title, playerName());
  screen.querySelector('[data-events-race]').textContent = String(event.race || 'Смешанное').toUpperCase();
  renderStory(event);
  renderKingReaction(event);
  const choices = screen.querySelector('[data-events-choices]');
  choices.replaceChildren(...event.choices.map(choiceButton));
  const choiceFrame=screen.querySelector('[data-events-choice-frame]');
  if(choiceFrame)choiceFrame.dataset.choiceCount=String(event.choices.length);
  const copyFrame=screen.querySelector('.events-copy-frame');
  if(copyFrame)copyFrame.scrollTop=0;
  renderOutcome(event);
}

function renderOutcome(event) {
  const state = activeRun?.currentEvent, outcome = state?.outcome;
  const root = screen?.querySelector('[data-events-outcome]');
  if (!root) return;
  if (!state?.resolved || !outcome) {
    root.hidden = true;
    document.body.classList.remove('events-outcome-open');
    return;
  }
  root.hidden = false;
  document.body.classList.add('events-outcome-open');
  const title=root.querySelector('[data-events-outcome-title]'),roll=root.querySelector('[data-events-roll]'),notes=root.querySelector('[data-events-outcome-notes]'),button=root.querySelector('[data-events-continue]');
  if(title) title.textContent = outcome.success ? 'УСПЕХ' : 'НЕУДАЧА';
  if(roll) roll.textContent = outcome.chance < 100 ? `Бросок: ${outcome.roll} · шанс: ${outcome.chance}%` : 'Гарантированный исход';
  if(notes){
    notes.replaceChildren();
    const list=outcome.notes?.length?outcome.notes:['Ничего не изменилось.'];
    for(const text of list){const p=document.createElement('p');p.textContent=text;notes.append(p);}
  }
  if(button){
    if(activeRun.ended)button.textContent='ИТОГИ ЗАБЕГА';
    else if(state.combat)button.textContent=state.combat.type==='battle'?'К БИТВЕ':'К СТЫЧКЕ';
    else button.textContent='ПРОДОЛЖИТЬ ПУТЬ';
  }
}

function handleChoice(event) {
  const button = event.target?.closest?.('[data-event-choice]');
  if (!button || busy) return;
  const current = readRun();
  if (!current || current.ended || current.activeTravelChoice?.type !== 'event' || current.currentEvent?.resolved) return;
  busy = true;
  audio()?.click?.();
  const result = resolveEventChoice(current, button.dataset.eventChoice);
  if (!result.success) { busy = false; renderEvent(); return; }
  activeRun = writeRun(result.run);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  globalThis.RPChessResources?.render?.();
  renderEvent();
  busy = false;
}

function dispatchCombat() {
  const current = readRun(), combat = current?.currentEvent?.combat;
  if (!current || !combat || current.ended) return;
  activeRun = writeRun(markEventCombatStarted(current));
  const routed = { type:combat.type, stars:combat.stars, seed:combat.seed, playerColor:combat.playerColor, enemyColor:combat.enemyColor, enemyRaceTag:combat.enemyRaceTag, enemyRoleRaces:combat.enemyRoleRaces, mixedArmy:combat.mixedArmy, sideNarrative:combat.sideNarrative, sourceEventId:combat.sourceEventId, sourceEventTitle:combat.sourceEventTitle };
  globalThis.RPChessTravelEncounterOverride = routed;
  document.body.classList.remove('events-outcome-open');
  hideEvents();
  const detail={source:'event',runId:activeRun.id,choice:routed,eventId:activeRun.currentEvent.eventId};
  globalThis.dispatchEvent(new CustomEvent(combat.type==='battle'?'rpchess:battle-open':'rpchess:skirmish-open',{detail}));
}

function continueOutcome() {
  if (busy) return;
  const current = readRun();
  if (!current?.currentEvent?.resolved) return;
  audio()?.click?.();
  if (current.ended) {
    document.body.classList.remove('events-outcome-open');
    hideEvents();
    if (globalThis.RPChessEndlessRun?.open?.(current)) return;
    const menu=document.querySelector('[data-reboot-foundation]');
    if(menu)menu.hidden=false;
    return;
  }
  if (current.currentEvent.combat) { dispatchCombat(); return; }
  activeRun=writeRun(completeEvent(current));
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  document.body.classList.remove('events-outcome-open');
  hideEvents();
  globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open',{detail:{source:'event-complete',runId:activeRun.id}}));
}

function openRoster() {
  if(busy)return;
  audio()?.click?.();
  document.body.classList.remove('events-outcome-open');
  hideEvents();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue',{detail:{source:'event'}}));
}
function openEvent(event=null) {
  busy=false;
  activeRun=readRun();
  if(!activeRun||activeRun.ended)return;
  const route=activeRun.activeTravelChoice||event?.detail?.choice;
  if(!route||route.type!=='event')return;
  const created=createEventState(activeRun,route);
  if(created.run!==activeRun){
    activeRun=writeRun(created.run);
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }
  showEvents();
  renderEvent();
}
function syncRun() {
  if(syncingCombat)return;
  activeRun=readRun();
  if(!activeRun)return;
  if(eventCombatCompleted(activeRun)){
    syncingCombat=true;
    activeRun=writeRun(completeEvent(activeRun));
    syncingCombat=false;
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    return;
  }
  if(screen&&!screen.hidden&&activeRun.activeTravelChoice?.type==='event')renderEvent();
}

ensureScreen();
addEventListener('rpchess:event-open',openEvent);
addEventListener('rpchess:run-updated',syncRun);
globalThis.RPChessEvents=Object.freeze({open:openEvent,render:renderEvent,get run(){return activeRun;},get state(){return activeRun?.currentEvent||null;}});
