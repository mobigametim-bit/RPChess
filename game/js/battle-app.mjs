import { PIECE_GLYPHS, PIECE_LABELS, STATUS_LABELS } from './roster-data.mjs';
import { readRun, writeRun } from './run-persistence.mjs';
import { pieceArtForTheme, racePiecePath } from './race-assets.mjs';
import { starsText } from './encounter-difficulty.mjs';
import {
  BATTLE_ARMY_POINTS,
  BATTLE_PIECE_COUNT,
  SLOT_CAPACITY,
  applyBattleOutcome,
  createBattleEncounter,
  createBattlePlan,
  defaultBattleSelection,
  formationFor,
  selectedTypeCounts,
  validateBattleSelection
} from './battle-core.mjs';

if (!document.querySelector('[data-battle-css]')) {
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = 'css/battle.css?v=20260829-battle-2';
  cssLink.dataset.battleCss = '';
  document.head.append(cssLink);
}

const menu = document.querySelector('[data-reboot-foundation]');
const rosterScreen = document.querySelector('[data-roster-screen]');
const skirmishScreen = document.querySelector('[data-skirmish-screen]');
const skirmishAftermath = document.querySelector('[data-skirmish-aftermath]');
const classicScreen = document.querySelector('[data-classic-screen]');
const board = document.querySelector('[data-chess-board]');
const classicNewButton = document.querySelector('[data-classic-new]');
const classicMenuButton = document.querySelector('[data-classic-menu]');

let prepScreen = null;
let aftermathScreen = null;
let runEndScreen = null;
let activeRun = null;
let encounter = null;
let selectedIds = new Set();
let battlePlan = null;
let playerBySquare = new Map();
let enemyBySquare = new Map();
let capturedIds = new Set();
let processedMoves = 0;
let battleFinalized = false;
let finalizeTimer = null;
let toastTimer = null;
let lastCapturedVisual = null;

function audio() { return globalThis.RPChessRebootAudio; }
function characterForId(id) { return activeRun?.roster?.find((character) => character.id === id) || null; }
function slotLabel(type) { return `${PIECE_LABELS[type] || type}: ${SLOT_CAPACITY[type] || 0}`; }
function playerColor() { return battlePlan?.playerColor || encounter?.playerColor || 'w'; }
function enemyColor() { return battlePlan?.enemyColor || (playerColor() === 'w' ? 'b' : 'w'); }
function playerGenericArt(pieceType, color = playerColor()) { return racePiecePath('humans', pieceType, color); }
function enemyArt(pieceType) { return pieceArtForTheme(battlePlan?.encounter || encounter, pieceType, enemyColor()); }
function combatDifficultyLabel() { return String(encounter?.label || '').split(' · ')[0].trim(); }

function ensureBattleScreens() {
  if (prepScreen && aftermathScreen && runEndScreen) return;
  const app = document.querySelector('#app');
  if (!app) return;

  prepScreen = document.createElement('main');
  prepScreen.className = 'battle-screen';
  prepScreen.dataset.battleScreen = '';
  prepScreen.setAttribute('aria-label', 'Подготовка к битве');
  prepScreen.hidden = true;
  prepScreen.innerHTML = `
    <div class="battle-shell">
      <header class="battle-topbar">
        <img class="battle-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
        <button class="reboot-button reboot-button--primary" type="button" data-battle-back>Вернуться к отряду</button>
      </header>
      <header class="battle-heading">
        <div>
          <div class="reboot-eyebrow">ПОДГОТОВКА К БИТВЕ</div>
          <h1 data-battle-title>Битва</h1>
          <p data-battle-description></p>
        </div>
        <div class="battle-threat-card ui-panel-safe">
          <strong data-battle-stars></strong>
          <span>ПОЛНАЯ АРМИЯ · 16 ФИГУР · 39 ОЧКОВ</span>
          <small data-battle-tactic>Тактика противника: —</small>
        </div>
      </header>
      <div class="battle-layout">
        <section class="battle-roster ui-panel-safe" aria-label="Персональные бойцы">
          <header class="battle-section-head">
            <div><div class="reboot-eyebrow">РОСТЕР</div><h2>Персональные бойцы</h2></div>
            <span>Здоровые бойцы выбраны по умолчанию. Снимите тех, кем не хотите рисковать.</span>
          </header>
          <div class="battle-grid" data-battle-available></div>
        </section>
        <aside class="battle-army ui-panel-safe" aria-label="Ваша полная армия">
          <header class="battle-section-head">
            <div><div class="reboot-eyebrow">СТАНДАРТНЫЙ КОМПЛЕКТ</div><h2>Ваша армия</h2></div>
            <span>Персональные бойцы заменяют временные фигуры того же типа.</span>
          </header>
          <div class="battle-slot-summary" data-battle-slot-summary></div>
          <div class="battle-formation" data-battle-formation aria-label="Стандартная стартовая армия"></div>
          <div class="battle-participants" data-battle-participants></div>
        </aside>
      </div>
      <div class="battle-notice" data-battle-notice role="status" hidden></div>
      <footer class="battle-actionbar" aria-label="Параметры полной армии">
        <div class="battle-counter"><span>ИМЕННЫЕ</span><strong data-battle-personalized-count>1</strong></div>
        <div class="battle-counter"><span>АРМИЯ</span><strong>16 ФИГУР</strong></div>
        <div class="battle-counter"><span>МАТЕРИАЛ</span><strong>39 ОЧКОВ</strong></div>
        <button class="reboot-button reboot-button--primary battle-start" type="button" data-battle-start>Начать битву</button>
      </footer>
    </div>`;

  aftermathScreen = document.createElement('main');
  aftermathScreen.className = 'battle-aftermath';
  aftermathScreen.dataset.battleAftermath = '';
  aftermathScreen.setAttribute('aria-label', 'Итоги битвы');
  aftermathScreen.hidden = true;
  aftermathScreen.innerHTML = `
    <div class="battle-aftermath-shell"><img class="battle-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
      <section class="battle-aftermath-panel ui-panel-safe">
        <div class="reboot-eyebrow">БИТВА ЗАВЕРШЕНА</div><h1 data-battle-aftermath-result>ИТОГ</h1><p data-battle-aftermath-text></p>
        <div class="battle-aftermath-columns"><section><h2>Выжили</h2><div class="battle-aftermath-list" data-battle-survivors></div></section><section><h2>Тяжело ранены</h2><div class="battle-aftermath-list" data-battle-wounded></div></section></div>
        <button class="reboot-button reboot-button--primary battle-aftermath-button" type="button" data-battle-continue>Продолжить путь</button>
      </section>
    </div>`;

  runEndScreen = document.createElement('main');
  runEndScreen.className = 'battle-aftermath battle-run-end';
  runEndScreen.dataset.battleRunEnd = '';
  runEndScreen.hidden = true;
  runEndScreen.innerHTML = `
    <div class="battle-aftermath-shell"><img class="battle-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
      <section class="battle-aftermath-panel ui-panel-safe"><div class="reboot-eyebrow">ЗАБЕГ ЗАВЕРШЁН</div><h1>КОРОЛЬ ПОГИБ</h1><p data-battle-run-end-text></p>
        <div class="battle-aftermath-columns battle-run-end-metrics"><section><h2>Сражений завершено</h2><div class="battle-aftermath-empty" data-battle-run-metric="combats">0</div></section><section><h2>Сохранили строй</h2><div class="battle-aftermath-empty" data-battle-run-metric="healthy">0</div></section><section><h2>Тяжело ранены</h2><div class="battle-aftermath-empty" data-battle-run-metric="wounded">0</div></section></div>
        <button class="reboot-button reboot-button--primary battle-aftermath-button" type="button" data-battle-run-end-continue>Главное меню</button>
      </section>
    </div>`;

  app.append(prepScreen, aftermathScreen, runEndScreen);
  prepScreen.querySelector('[data-battle-back]')?.addEventListener('click', returnToRoster);
  prepScreen.querySelector('[data-battle-start]')?.addEventListener('click', startBattle);
  aftermathScreen.querySelector('[data-battle-continue]')?.addEventListener('click', leaveAftermath);
  runEndScreen.querySelector('[data-battle-run-end-continue]')?.addEventListener('click', leaveRunEnd);
}

function showOnly(target) {
  ensureBattleScreens();
  if (menu) menu.hidden = target !== 'menu';
  if (rosterScreen) rosterScreen.hidden = target !== 'roster';
  if (skirmishScreen) skirmishScreen.hidden = target !== 'skirmish';
  if (skirmishAftermath) skirmishAftermath.hidden = target !== 'skirmishAftermath';
  if (classicScreen) classicScreen.hidden = target !== 'classic';
  if (prepScreen) prepScreen.hidden = target !== 'battle';
  if (aftermathScreen) aftermathScreen.hidden = target !== 'battleAftermath';
  if (runEndScreen) runEndScreen.hidden = target !== 'battleRunEnd';
  document.body.classList.toggle('battle-active', ['battle','battleAftermath','battleRunEnd'].includes(target));
  if (target !== 'classic') document.body.classList.remove('classic-chess-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function setBattleNavigationLocked(locked) {
  for (const button of [classicNewButton, classicMenuButton]) {
    if (!button) continue;
    button.hidden = Boolean(locked);
    button.setAttribute('aria-hidden', locked ? 'true' : 'false');
  }
}
function setNotice(text = '') { const root = prepScreen?.querySelector('[data-battle-notice]'); if (!root) return; root.textContent = text; root.hidden = !text; }
function battleReason(result) {
  if (!result) return 'Состав нельзя использовать в этой битве.';
  if (result.reason === 'king_unavailable') return 'Король недоступен. Забег не может продолжаться.';
  if (result.reason === 'king_required') return 'Король обязан участвовать в каждой битве.';
  if (result.reason === 'character_unavailable') return 'Эта фигура сейчас не может участвовать в битве.';
  if (result.reason === 'slot_limit') return `ВСЕ ${result.capacity} СЛОТА · ${String(PIECE_LABELS[result.pieceType] || result.pieceType).toUpperCase()} ЗАНЯТЫ`;
  return 'Состав нельзя использовать в этой битве.';
}

function encounterForRun(run) {
  const count = Number.isInteger(run?.battleCount) ? run.battleCount : 0;
  const stars = Math.min(12, 2 + Math.floor(count / 2));
  return createBattleEncounter({ seed: `${run.id}:battle:${count + 1}`, stars });
}
function renderEncounter() {
  if (!prepScreen || !encounter) return;
  prepScreen.querySelector('[data-battle-title]').textContent = encounter.label;
  prepScreen.querySelector('[data-battle-description]').textContent = `${encounter.description} ${encounter.sideNarrative || ''}`.trim();
  const stars = prepScreen.querySelector('[data-battle-stars]');
  stars.textContent = starsText(encounter.stars);
  stars.setAttribute('aria-label', `Сложность ${encounter.stars} из 12`);
  prepScreen.querySelector('[data-battle-tactic]').textContent = `Тактика противника: ${encounter.tactic}`;
}

function tryToggle(character) {
  if (!activeRun || (character.status !== 'healthy' && !character.isRunKing)) return;
  if (character.isRunKing) { setNotice('Король обязан участвовать в каждой битве.'); return; }
  const next = new Set(selectedIds);
  next.has(character.id) ? next.delete(character.id) : next.add(character.id);
  const validation = validateBattleSelection(activeRun.roster, [...next]);
  if (!validation.ok) { setNotice(battleReason(validation)); return; }
  selectedIds = next; setNotice(''); audio()?.click?.(); renderComposition();
}

function battleCard(character) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `battle-card battle-card--${character.status}`; button.dataset.battleCharacter = character.id;
  const selected = selectedIds.has(character.id); button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const unavailable = character.status !== 'healthy' && !character.isRunKing;
  button.disabled = unavailable; button.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
  const art = document.createElement('img'); art.className = 'battle-card__art'; art.src = character.pieceArt; art.alt = '';
  const body = document.createElement('span'); body.className = 'battle-card__body';
  const name = document.createElement('strong'); name.textContent = character.name;
  const meta = document.createElement('span'); meta.className = 'battle-card__meta'; meta.textContent = `${PIECE_GLYPHS[character.pieceType] || ''} ${PIECE_LABELS[character.pieceType]} · слот ${slotLabel(character.pieceType)}`;
  const state = document.createElement('span'); state.className = `battle-card__status battle-card__status--${character.status}`; state.textContent = character.isRunKing ? '♔ КОРОЛЬ · ОБЯЗАТЕЛЕН' : STATUS_LABELS[character.status];
  body.append(name, meta, state); button.append(art, body); if (!unavailable) button.addEventListener('click', () => tryToggle(character)); return button;
}
function renderAvailable() { const root=prepScreen?.querySelector('[data-battle-available]'); if(!root||!activeRun)return; root.replaceChildren(); const order={healthy:0,wounded:1,dead:2}; for(const c of [...activeRun.roster].sort((a,b)=>order[a.status]-order[b.status]))root.append(battleCard(c)); }
function renderSlotSummary() { const root=prepScreen?.querySelector('[data-battle-slot-summary]'); if(!root||!activeRun)return; root.replaceChildren(); const counts=selectedTypeCounts(activeRun.roster,[...selectedIds]); for(const type of ['king','queen','rook','bishop','knight','pawn']){const chip=document.createElement('span');chip.className='battle-slot-chip';chip.dataset.battleSlotType=type;chip.textContent=`${PIECE_GLYPHS[type]||''} ${PIECE_LABELS[type]} ${counts[type]} / ${SLOT_CAPACITY[type]}`;root.append(chip);} }
function renderFormation() {
  const root=prepScreen?.querySelector('[data-battle-formation]'); if(!root||!activeRun||!encounter)return; root.replaceChildren();
  const color=encounter.playerColor||'w'; let formation=[]; try{formation=formationFor(color,activeRun.roster,[...selectedIds],color);}catch{return;}
  const bySquare=new Map(formation.map((piece)=>[piece.square,piece])),ranks=color==='w'?['2','1']:['7','8'];
  for(const rank of ranks)for(const file of 'abcdefgh'){const square=`${file}${rank}`,piece=bySquare.get(square),cell=document.createElement('div');cell.className='battle-formation-cell';cell.dataset.battlePreviewSquare=square;if(piece){const image=document.createElement('img');image.src=piece.id?(characterForId(piece.id)?.pieceArt||playerGenericArt(piece.pieceType,color)):playerGenericArt(piece.pieceType,color);image.alt='';if(piece.id)image.dataset.personalizedId=piece.id;const glyph=document.createElement('span');glyph.textContent=PIECE_GLYPHS[piece.pieceType]||'';cell.append(image,glyph);cell.title=piece.id?(characterForId(piece.id)?.name||piece.name):piece.name;}root.append(cell);}
}
function renderParticipants() { const root=prepScreen?.querySelector('[data-battle-participants]'); if(!root||!activeRun)return; root.replaceChildren(); const validation=validateBattleSelection(activeRun.roster,[...selectedIds]);if(!validation.ok)return;for(const c of validation.members){const row=document.createElement('button');row.type='button';row.className='battle-participant-row';row.disabled=c.isRunKing;row.dataset.battleParticipant=c.id;const glyph=document.createElement('span');glyph.textContent=PIECE_GLYPHS[c.pieceType]||'';const name=document.createElement('strong');name.textContent=c.name;const state=document.createElement('small');state.textContent=c.isRunKing?'ОБЯЗАТЕЛЕН':'ИМЕННОЙ';row.append(glyph,name,state);if(!c.isRunKing)row.addEventListener('click',()=>tryToggle(c));root.append(row);} }
function renderCounters() { const validation=validateBattleSelection(activeRun?.roster||[],[...selectedIds]);const count=prepScreen?.querySelector('[data-battle-personalized-count]');if(count)count.textContent=String(validation.members?.length||0);const start=prepScreen?.querySelector('[data-battle-start]');if(start){start.disabled=!validation.ok;start.setAttribute('aria-disabled',validation.ok?'false':'true');} }
function renderComposition(){renderAvailable();renderSlotSummary();renderFormation();renderParticipants();renderCounters();}

function resetBattleTracking(){battlePlan=null;playerBySquare=new Map();enemyBySquare=new Map();capturedIds=new Set();processedMoves=0;battleFinalized=false;lastCapturedVisual=null;clearTimeout(finalizeTimer);finalizeTimer=null;setBattleNavigationLocked(false);}
function openBattle(){ensureBattleScreens();activeRun=readRun();if(!activeRun||activeRun.ended)return;encounter=encounterForRun(activeRun);selectedIds=new Set(defaultBattleSelection(activeRun.roster));resetBattleTracking();setNotice('');renderEncounter();renderComposition();showOnly('battle');}
function returnToRoster(){audio()?.click?.();resetBattleTracking();showOnly('menu');globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));}

function pieceImage(piece, side) {
  if (side === 'player') {
    if (piece.id) return characterForId(piece.id)?.pieceArt || playerGenericArt(piece.pieceType, battlePlan.playerColor);
    return playerGenericArt(piece.pieceType, battlePlan.playerColor);
  }
  return enemyArt(piece.pieceType);
}
function applyBoardArt() {
  if (!board || !battlePlan) return;
  for (const [square,piece] of playerBySquare) {
    const cell=board.querySelector(`[data-square="${square}"]`),image=cell?.querySelector('.classic-piece');if(!image)continue;image.src=pieceImage(piece,'player');if(piece.id){image.dataset.personalizedId=piece.id;image.classList.add('classic-piece--personalized');cell.dataset.personalizedId=piece.id;const character=characterForId(piece.id);cell.setAttribute('aria-label',`${square}: ${character?.name||piece.name}, ${PIECE_LABELS[piece.pieceType]||piece.pieceType}`);}
  }
  for (const [square,piece] of enemyBySquare) { const image=board.querySelector(`[data-square="${square}"] .classic-piece`); if(image)image.src=pieceImage(piece,'enemy'); }
}
function patchTransientBattleArt() {
  if (!battlePlan || !globalThis.RPChessClassicChess) return;
  const log=globalThis.RPChessClassicChess.moveLog||[],last=log[log.length-1];if(!last)return;
  for(const flyer of document.querySelectorAll('.classic-piece-flyer:not([data-battle-visualized])')){const map=last.color===battlePlan.playerColor?playerBySquare:enemyBySquare,piece=map.get(last.move?.to)||map.get(last.move?.from);if(piece)flyer.src=pieceImage(piece,last.color===battlePlan.playerColor?'player':'enemy');flyer.dataset.battleVisualized='1';}
  for(const ghost of document.querySelectorAll('.classic-captured-ghost:not([data-battle-visualized])')){if(last.color===battlePlan.enemyColor&&lastCapturedVisual?.logLength===log.length&&lastCapturedVisual.art)ghost.src=lastCapturedVisual.art;else if(last.color===battlePlan.playerColor&&last.captured){const code=String(last.captured).toLowerCase(),type={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[code]||'pawn';ghost.src=enemyArt(type);}ghost.dataset.battleVisualized='1';}
}

function startBattle() {
  activeRun=readRun();if(!activeRun||activeRun.ended)return;const validation=validateBattleSelection(activeRun.roster,[...selectedIds]);if(!validation.ok){setNotice(battleReason(validation));return;}
  battlePlan=createBattlePlan({roster:activeRun.roster,selectedIds:[...selectedIds],encounter});
  playerBySquare=new Map(battlePlan.playerFormation.map((piece)=>[piece.square,piece])); enemyBySquare=new Map(battlePlan.enemyFormation.map((piece)=>[piece.square,piece]));
  capturedIds=new Set();processedMoves=0;battleFinalized=false;lastCapturedVisual=null;clearTimeout(finalizeTimer);audio()?.click?.();showOnly('classic');setBattleNavigationLocked(true);
  globalThis.RPChessClassicChess?.newGame(battlePlan.fen,{mode:'ai',playerColor:battlePlan.playerColor,aiElo:encounter.aiElo});applyBoardArt();
  const mode=document.querySelector('[data-game-mode]');if(mode)mode.textContent=combatDifficultyLabel();
}

function showWoundToast(id){let toast=document.querySelector('[data-battle-toast]');if(!toast){toast=document.createElement('div');toast.className='battle-toast';toast.dataset.battleToast='';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;document.body.append(toast);}const c=characterForId(id);if(!c)return;toast.textContent=`${c.name} — ТЯЖЕЛО РАНЕН`;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);}
function processMove(entry) {
  if(!entry?.move||!battlePlan)return;const{from,to,capture}=entry.move;
  if(entry.color===battlePlan.playerColor){const piece=playerBySquare.get(from);if(piece){playerBySquare.delete(from);playerBySquare.set(to,{...piece,square:to});}if(entry.captured)enemyBySquare.delete(capture||to);}
  else if(entry.color===battlePlan.enemyColor){const piece=enemyBySquare.get(from);if(piece){enemyBySquare.delete(from);enemyBySquare.set(to,{...piece,square:to});}if(entry.captured){const capturedSquare=capture||to,captured=playerBySquare.get(capturedSquare);if(captured){playerBySquare.delete(capturedSquare);if(captured.id){const character=characterForId(captured.id);lastCapturedVisual=character?{id:captured.id,art:character.pieceArt,logLength:processedMoves+1}:null;if(character&&!character.isRunKing){capturedIds.add(captured.id);showWoundToast(captured.id);}}}}}
}
function syncBattleFromChess(){if(!battlePlan||battleFinalized||!globalThis.RPChessClassicChess)return;const log=globalThis.RPChessClassicChess.moveLog||[];while(processedMoves<log.length){processMove(log[processedMoves]);processedMoves++;}applyBoardArt();const mode=document.querySelector('[data-game-mode]');if(mode&&encounter)mode.textContent=combatDifficultyLabel();const status=globalThis.RPChessClassicChess.snapshot()?.status;if(status?.over&&!finalizeTimer)finalizeTimer=setTimeout(()=>finishBattle(status),320);}

function renderCharacterList(root,characters,emptyText){if(!root)return;root.replaceChildren();if(!characters.length){const empty=document.createElement('div');empty.className='battle-aftermath-empty';empty.textContent=emptyText;root.append(empty);return;}for(const character of characters){const row=document.createElement('div');row.className='battle-aftermath-row';const art=document.createElement('img');art.src=character.pieceArt;art.alt='';const name=document.createElement('strong');name.textContent=character.name;const status=document.createElement('span');status.textContent=STATUS_LABELS[character.status]||character.status;row.append(art,name,status);root.append(row);}}
function renderAftermath(status){if(!activeRun||!battlePlan||!aftermathScreen)return;const participants=battlePlan.participants.map((id)=>activeRun.roster.find((c)=>c.id===id)).filter(Boolean),survivors=participants.filter((c)=>c.status==='healthy'),wounded=participants.filter((c)=>c.status==='wounded'),victory=status?.type==='checkmate'&&status.winner===battlePlan.playerColor;aftermathScreen.querySelector('[data-battle-aftermath-result]').textContent=victory?'ПОБЕДА':status?.type==='checkmate'?'ПОРАЖЕНИЕ':'НИЧЬЯ';aftermathScreen.querySelector('[data-battle-aftermath-text]').textContent=wounded.length?'Битва окончена. Временная армия распущена; тяжело раненые именные бойцы требуют лечения.':'Битва окончена. Именные участники сохранили боеспособность.';renderCharacterList(aftermathScreen.querySelector('[data-battle-survivors]'),survivors,'Нет невредимых именных участников.');renderCharacterList(aftermathScreen.querySelector('[data-battle-wounded]'),wounded,'Никто из именных участников не получил тяжёлых ранений.');}
function renderRunEnd(){if(!activeRun||!runEndScreen)return;const king=activeRun.roster.find((c)=>c.isRunKing),healthy=activeRun.roster.filter((c)=>!c.isRunKing&&c.status==='healthy').length,wounded=activeRun.roster.filter((c)=>c.status==='wounded').length;runEndScreen.querySelector('[data-battle-run-end-text]').textContent=`${king?.name||'Король'} пал в битве. Забег завершён.`;const values={combats:String((activeRun.skirmishCount||0)+(activeRun.battleCount||0)),healthy:String(healthy),wounded:String(wounded)};for(const metric of runEndScreen.querySelectorAll('[data-battle-run-metric]'))metric.textContent=values[metric.dataset.battleRunMetric]||'0';}
function finishBattle(status){finalizeTimer=null;if(battleFinalized||!battlePlan)return;battleFinalized=true;const current=readRun();if(!current)return;const outcome=applyBattleOutcome(current,{capturedIds:[...capturedIds],participantIds:battlePlan.participants,status,playerColor:battlePlan.playerColor});activeRun=writeRun({...outcome,battleCount:(Number.isInteger(current.battleCount)?current.battleCount:0)+1,lastBattle:{...(outcome.lastBattle||{}),encounterId:battlePlan.encounter.id,encounterStars:battlePlan.encounter.stars,fullArmyPieces:BATTLE_PIECE_COUNT,fullArmyPoints:BATTLE_ARMY_POINTS,playerColor:battlePlan.playerColor,enemyRaceTag:battlePlan.encounter.enemyRaceTag}});setBattleNavigationLocked(false);globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));if(activeRun.ended){renderRunEnd();showOnly('battleRunEnd');return;}renderAftermath(status);showOnly('battleAftermath');}
function leaveAftermath(){audio()?.click?.();resetBattleTracking();globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open',{detail:{source:'battle-aftermath',runId:activeRun?.id||null}}));}
function leaveRunEnd(){audio()?.click?.();resetBattleTracking();showOnly('menu');globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));}

addEventListener('rpchess:battle-open',openBattle);ensureBattleScreens();
if(board&&typeof MutationObserver!=='undefined')new MutationObserver(syncBattleFromChess).observe(board,{childList:true,subtree:true});
if(typeof MutationObserver!=='undefined'&&document.body)new MutationObserver(()=>{if(!battlePlan)return;if(!document.querySelector('.classic-piece-flyer:not([data-battle-visualized]),.classic-captured-ghost:not([data-battle-visualized])'))return;queueMicrotask(patchTransientBattleArt);}).observe(document.body,{childList:true,subtree:true});
globalThis.RPChessBattle=Object.freeze({open:openBattle,start:startBattle,get encounter(){return encounter;},get selectedIds(){return[...selectedIds];},get battlePlan(){return battlePlan;},syncBattleFromChess,finishBattle});
