import { heroPortraitArt,boardRacePiecePath,RACE_LABELS } from './race-assets.mjs';
import {PIECE_TYPES,PIECE_LABELS} from './kingdom-economy-config.mjs';
import {normalizeArmy} from './kingdom-army-core.mjs';
import { STATUS_LABELS, PIECE_GLYPHS } from './roster-data.mjs';
import { createRun, readRun, writeRun } from './run-persistence.mjs';
import { applyNewRunPowerCarryover } from './player-rating.mjs';
import { subscribe, t, translateLegacy } from './i18n.mjs';
import { heroNoteForId } from './content/hero-notes.mjs';
import { commanderTitle,commanderDescription,commanderPortrait } from './commander-portraits.mjs';
import { currentLanguage } from './i18n.mjs';
import { renderFormationUI } from './roster-formation-ui.mjs';
import { normalizedFormation } from './roster-formation-core.mjs';

const menu = document.querySelector('[data-reboot-foundation]');
const classicScreen = document.querySelector('[data-classic-screen]');
const rosterScreen = document.querySelector('[data-roster-screen]');
const skirmishScreen = document.querySelector('[data-skirmish-screen]');
const aftermathScreen = document.querySelector('[data-skirmish-aftermath]');
const travelScreen = document.querySelector('[data-travel-choice-screen]');
const continueButton = document.querySelector('[data-continue-run]');
const journeyButton = document.querySelector('[data-roster-travel]');
const rosterList = document.querySelector('[data-roster-list]');
const rosterDetail = document.querySelector('[data-roster-detail]');
const rosterCount = document.querySelector('[data-roster-count]');

let activeRun = readRun();
let journeyPending = false;

function audio() { return globalThis.RPChessRebootAudio; }
function contentText(value) { return translateLegacy(String(value || '')); }
function statusLabel(status) { return t(`status.${status}`) || STATUS_LABELS[status] || status; }

function applyStaticCopy() {
  if (!rosterScreen) return;
  rosterScreen.setAttribute('aria-label', t('roster.ariaLabel'));
  const kicker = rosterScreen.querySelector('.roster-heading .reboot-eyebrow');
  const title = rosterScreen.querySelector('.roster-heading h1');
  const catalog = rosterScreen.querySelector('.roster-catalog');
  const catalogTitle = rosterScreen.querySelector('.roster-catalog__head h2');
  const filters = rosterScreen.querySelector('.roster-filters');
  const menuButton = rosterScreen.querySelector('[data-roster-menu]');
  if (kicker) kicker.textContent = t('roster.kicker');
  if (title) title.textContent = t('roster.title');
  if (catalog) catalog.setAttribute('aria-label', t('roster.catalogLabel'));
  if (catalogTitle) catalogTitle.textContent = t('roster.catalogTitle');
  if (filters) filters.setAttribute('aria-label', t('roster.filtersLabel'));
  if (menuButton) menuButton.textContent = t('roster.menu');
}

function setScene(target) {
  if (menu) menu.hidden = target !== 'menu';
  if (classicScreen) classicScreen.hidden = target !== 'classic';
  if (rosterScreen) rosterScreen.hidden = target !== 'roster';
  if (skirmishScreen) skirmishScreen.hidden = target !== 'skirmish';
  if (aftermathScreen) aftermathScreen.hidden = target !== 'aftermath';
  if (travelScreen) travelScreen.hidden = target !== 'travel';
  document.body.classList.toggle('roster-active', target === 'roster');
  if (target === 'roster') window.scrollTo(0, 0);
  globalThis.dispatchEvent(new CustomEvent('rpchess:scene-changed', { detail:{ scene:target, source:'roster' } }));
}

function updateContinueState() {
  activeRun = readRun();
  if (!continueButton) return;
  const enabled = Boolean(activeRun && !activeRun.ended);
  // The Journey icon is always enabled: new run or resume from the same control.
  continueButton.disabled = false;
  continueButton.setAttribute('aria-disabled','false');
  continueButton.dataset.journeyActive = enabled ? 'true' : 'false';
}

function updateJourneyLabel() {
  if (!journeyButton || journeyPending) return;
  journeyButton.textContent = activeRun?.activeTravelChoice?.type === 'settlement' ? t('roster.returnSettlement') : t('roster.journey');
}

function selectedCharacter() {
  if (!activeRun) return null;
  return activeRun.roster.find((character) => character.id === activeRun.selectedCharacterId) || activeRun.roster[0] || null;
}

function statusNote(character) {
  if (character.status === 'wounded') return t('roster.statusNote.wounded');
  if (character.status === 'dead') return t('roster.statusNote.dead');
  return '';
}

function renderDetail() {
  if (!rosterDetail) return;
  const character = selectedCharacter();
  rosterDetail.replaceChildren();
  if (!character) return;
  const displayName = character.isRunKing?commanderTitle(activeRun?.commanderId,currentLanguage()):contentText(character.name);

  const media = document.createElement('div');
  media.className = 'roster-detail__media';
  const portrait = document.createElement('img');
  portrait.className = 'roster-detail__portrait';
  portrait.src = character.isRunKing?commanderPortrait(activeRun?.commanderId):heroPortraitArt(character);
  portrait.alt = displayName;
  media.append(portrait);

  const body = document.createElement('div');
  body.className = 'roster-detail__body';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'roster-kicker';
  eyebrow.textContent = character.isRunKing ? t('roster.kingKicker') : t('roster.namedPieceKicker');
  const title = document.createElement('h2');
  title.textContent = displayName;
  const facts = document.createElement('div');
  facts.className = 'roster-detail__facts';
  const role = document.createElement('span');
  role.innerHTML = `<strong>${contentText(character.origin)}</strong>`;
  const glyph = document.createElement('span');
  glyph.className = 'roster-detail__piece-glyph';
  glyph.textContent = PIECE_GLYPHS[character.pieceType] || PIECE_GLYPHS.pawn;
  glyph.setAttribute('role','img');
  glyph.setAttribute('aria-label',t(`piece.${character.pieceType}`));
  facts.append(role, glyph);

  const status = document.createElement('div');
  status.className = `roster-status roster-status--${character.status}`;
  status.textContent = statusLabel(character.status);
  const description = document.createElement('p');
  description.className = 'roster-detail__description';
  description.textContent = character.isRunKing?commanderDescription(activeRun?.commanderId,currentLanguage()):contentText(heroNoteForId(character.id) || character.description);

  body.append(eyebrow, title, facts, status);
  const noteText = statusNote(character);
  if (noteText) {
    const note = document.createElement('p');
    note.className = 'roster-status-note';
    note.textContent = noteText;
    body.append(note);
  }
  body.append(description);
  rosterDetail.append(media, body);
}

let activeRosterTab='named';
function armyEnglishType(type){return {pawn:'Pawn',knight:'Knight',bishop:'Bishop',rook:'Rook',queen:'Queen'}[type]||type;}
function ensureRosterTabs(){
  if(!rosterScreen)return;
  let nav=rosterScreen.querySelector('[data-roster-army-tabs]');
  if(!nav){
    nav=document.createElement('div');nav.className='roster-army-tabs';nav.dataset.rosterArmyTabs='';
    for(const key of ['named','army']){
      const button=document.createElement('button');button.type='button';button.dataset.rosterArmTab=key;
      button.addEventListener('click',()=>{activeRosterTab=key;renderRoster();});
      nav.append(button);
    }
    (rosterScreen.querySelector('.roster-catalog__head')||rosterScreen.querySelector('.roster-heading')||rosterScreen).append(nav);
  }
  for(const button of nav.querySelectorAll('[data-roster-arm-tab]')){
    const named=button.dataset.rosterArmTab==='named';
    button.textContent=named?(currentLanguage()==='en'?'Heroes':'Герои'):(currentLanguage()==='en'?'Army':'Армия');
    button.classList.toggle('is-active',button.dataset.rosterArmTab===activeRosterTab);
    button.setAttribute('aria-pressed',String(button.dataset.rosterArmTab===activeRosterTab));
  }
}
function renderArmyRoster(){
  const english=currentLanguage()==='en',army=normalizeArmy(activeRun?.army),total=army.reduce((n,u)=>n+u.count,0);
  rosterList.replaceChildren();rosterList.className='roster-army-list';
  rosterDetail.replaceChildren();
  const title=document.createElement('h2');title.textContent=english?'Army reserves':'Запас Армии';rosterDetail.append(title);
  const intro=document.createElement('p');intro.textContent=english?
    'Permanent recruits grouped by race and chess role. Captured recruits are lost permanently; temporary mercenaries are not stored.':
    'Постоянные рекруты по расам и типам. Взятые фигуры погибают безвозвратно; временные наёмники не сохраняются.';
  rosterDetail.append(intro);
  const summary=document.createElement('p');summary.textContent=(english?'Total recruits: ':'Всего рекрутов: ')+total;rosterDetail.append(summary);
  if(rosterCount)rosterCount.textContent=String(total);
  if(!army.length){const empty=document.createElement('p');empty.className='roster-army-empty';empty.textContent=english?'No recruits yet. Hire them in the Castle or collect them from friendly cleared Skirmishes.':'Рекрутов пока нет. Нанимай в Замке или собирай в освоенных своих Стычках.';rosterList.append(empty);return;}
  for(const raceTag of [...new Set(army.map(entry=>entry.raceTag))]){
    const group=document.createElement('section');group.className='roster-army-race';
    const h=document.createElement('h3');h.textContent=english?raceTag.replaceAll('_',' '):RACE_LABELS[raceTag]||raceTag;group.append(h);
    const grid=document.createElement('div');grid.className='roster-army-grid';
    for(const pieceType of PIECE_TYPES){
      const count=army.find(x=>x.raceTag===raceTag&&x.pieceType===pieceType)?.count||0;
      const item=document.createElement('article');item.className='roster-army-tile';
      const image=document.createElement('img');image.src=boardRacePiecePath(raceTag,pieceType,'w');
      image.alt='';image.loading='lazy';
      const name=document.createElement('span');name.textContent=english?armyEnglishType(pieceType):PIECE_LABELS[pieceType];
      const number=document.createElement('strong');number.textContent='×'+count;
      item.append(image,name,number);grid.append(item);
    }
    group.append(grid);rosterList.append(group);
  }
}
function renderRoster() {
  if (!activeRun || !rosterList) return;
  applyStaticCopy();
  updateJourneyLabel();
  ensureRosterTabs();
  if(activeRosterTab==='army'){renderArmyRoster();return;}
  renderDetail();
  const formation=normalizedFormation(activeRun);
  if (rosterCount) rosterCount.textContent = `${formation.members.length} / 16`;
  renderFormationUI(rosterList,activeRun,{
    onSelect:(id)=>{
      if (activeRun.selectedCharacterId===id) return;
      audio()?.click?.();
      activeRun=writeRun({...activeRun,selectedCharacterId:id});
      renderDetail();
      renderRoster();
    },
    onCommit:(next)=>{
      audio()?.click?.();
      activeRun=writeRun(next);
      renderRoster();
    }
  });
}

function beginRun(event = null) {
  const previousRun = readRun();
  if (previousRun?.ended) applyNewRunPowerCarryover();
  activeRun = writeRun(createRun({ playerName:event?.detail?.playerName,commanderId:event?.detail?.commanderId }));
  updateContinueState();
  setScene('roster');
  renderRoster();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated', { detail: { source: 'run-new', runId: activeRun.id } }));
}

function continueRun() {
  activeRun = readRun();
  if (!activeRun || activeRun.ended) {
    updateContinueState();
    return;
  }
  if ((activeRun.currentCombat && activeRun.activeTravelChoice?.type === activeRun.currentCombat.type) ||
      (activeRun.currentCaravan?.phase === 'combat' && activeRun.activeTravelChoice?.type === 'caravan')) {
    // A saved fight is the current scene, even when Continue is pressed on another device.
    void resumeCurrentCombat(activeRun.id);
    return;
  }
  setScene('roster');
  renderRoster();
}

async function resumeCurrentCombat(runId) {
  const travelChoice = await ensureTravelChoiceReady();
  const current = readRun();
  if (current?.id !== runId || current.ended || !travelChoice) return;
  travelChoice.open({ detail:{ source:'run-continue', runId } });
}

async function ensureTravelChoiceReady() {
  const routeReady = globalThis.RPChessRouteReady;
  if (routeReady && typeof routeReady.then === 'function') await routeReady;
  if (globalThis.RPChessTravelChoice?.open) return globalThis.RPChessTravelChoice;
  try {
    await import('./travel-choice-app.mjs?v=20261110-pre-entry-starvation-v1');
  } catch (error) {
    console.error('[RPChess] Travel Choice bootstrap failed', error);
    return null;
  }
  return globalThis.RPChessTravelChoice?.open ? globalThis.RPChessTravelChoice : null;
}

async function beginJourney() {
  if (journeyPending) return;
  activeRun = readRun();
  if (!activeRun || activeRun.ended) return;
  audio()?.click();
  journeyPending = true;
  rosterScreen?.querySelector('[data-roster-journey-error]')?.remove();
  if (journeyButton) {
    journeyButton.disabled = true;
    journeyButton.textContent = t('roster.journeyLoading');
  }
  try {
    const runId = activeRun.id;
    const legacyTravel = new URLSearchParams(location.search).has('legacy_travel') ||
      globalThis.sessionStorage?.getItem('rpchess.test.legacyTravel') === '1';
    // The Kingdom map is the normal Roster destination. Do not hold its
    // navigation behind the unrelated battle/encounter route bootstrap:
    // slow cloud/platform initialization otherwise leaves the icon inert.
    // Active encounters and the explicitly requested legacy Travel stay
    // with their existing route owner, including starvation recovery.
    const resume=activeRun.activeTravelChoice;
    const settled=resume?.type==='settlement' && resume.kingdomCell &&
      activeRun.kingdomMap?.cells?.[resume.kingdomCell]?.status==='completed' &&
      activeRun.kingdomMap.cells[resume.kingdomCell].selectedEncounter?.id===resume.id;
    if (settled) {
      // Recover the exact save produced by older broken "Services" clicks.
      // Do not wait for the whole combat-route bootstrap to reach a completed Settlement.
      await import('./settlement-app.mjs');
      const current=readRun();
      if (!current || current.ended || current.id!==runId ||
          current.activeTravelChoice?.id!==resume.id) return;
      const owner=globalThis.RPChessSettlement;
      if(!owner?.open)throw new Error('Settlement scene owner is unavailable');
      owner.open({detail:{source:'roster',runId,choice:current.activeTravelChoice}});
      if(document.querySelector('[data-settlement-screen]')?.hidden!==false)
        throw new Error('Saved Settlement scene did not become active');
    } else if (!legacyTravel && !activeRun.activeTravelChoice) {
      const { openMap } = await import('./kingdom-map-app.mjs?v=20261112-province-colors-v1');
      const current = readRun();
      if (!current || current.ended || current.id !== runId) return;
      openMap({ detail:{ source:'roster', runId } });
      if (document.querySelector('[data-kingdom-map-screen]')?.hidden !== false) {
        throw new Error('Kingdom map did not become active');
      }
    } else {
      const travelChoice = await ensureTravelChoiceReady();
      const current = readRun();
      if (!travelChoice || !current || current.ended || current.id !== runId) return;
      travelChoice.open({ detail:{ source:'roster', runId } });
    }
  } catch (error) {
    console.error('[RPChess] Start Journey failed', error);
    // A failed dynamic import should never look like an unresponsive button.
    const notice = document.createElement('p');
    notice.dataset.rosterJourneyError = '';
    notice.setAttribute('role', 'alert');
    notice.className = 'roster-journey-error';
    notice.textContent = currentLanguage() === 'en' ?
      'Journey could not open. Please try again.' :
      'Не удалось открыть Путешествие. Попробуйте ещё раз.';
    rosterScreen?.querySelector('.roster-heading')?.append(notice);
  } finally {
    journeyPending = false;
    if (journeyButton) journeyButton.disabled = false;
    updateJourneyLabel();
  }
}

function returnToMenu() {
  audio()?.click();
  updateContinueState();
  setScene('menu');
}

function syncRun() {
  activeRun = readRun();
  updateContinueState();
  updateJourneyLabel();
  if (rosterScreen && !rosterScreen.hidden && activeRun && !activeRun.ended) renderRoster();
}


document.querySelector('[data-roster-menu]')?.addEventListener('click', returnToMenu);
journeyButton?.addEventListener('click', beginJourney);
addEventListener('rpchess:run-new', beginRun);
addEventListener('rpchess:run-continue', continueRun);
addEventListener('rpchess:run-updated', syncRun);
subscribe(() => {
  applyStaticCopy();
  updateJourneyLabel();
  if (rosterScreen && !rosterScreen.hidden && activeRun && !activeRun.ended) renderRoster();
});

applyStaticCopy();
updateContinueState();
updateJourneyLabel();

globalThis.RPChessRoster = Object.freeze({
  get run() { return activeRun; },
  render: renderRoster,
  beginRun,
  continueRun,
  beginJourney,
  returnToMenu,
  syncRun
});

// Cloud Save may restore the run after Roster's initial menu check. Read the same
// persisted run again once reconciliation finishes, regardless of script load order.
void globalThis.RPChessCloudReady?.then(syncRun, syncRun);
