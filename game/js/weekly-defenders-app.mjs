/* Weekly defender UX: this scene is isolated from the first-conquest Battle. */
import {readRun,writeRun} from './run-persistence.mjs';
import {weeklyState,eligibleWeeklySite,weeklyQuote,startWeeklyBattle,recordWeeklyMove,settleWeeklyBattle} from './weekly-defenders-core.mjs';
import {weekForDay} from './kingdom-map-core.mjs';
import {threatRank,decorateThreat,normalizeHeroMastery} from './hero-threat.mjs';
import {ClassicChessEngine} from './classic-chess-engine.mjs';
import {ChessAIAdapter} from './chess-ai-adapter.mjs';
import {trainingMoveQualityWinChance} from './mentor-training-history.mjs';
import {kingdomEncounterSprite} from './kingdom-map-assets.mjs';
import {boardRacePiecePath,boardPieceArtForTheme,boardPieceArtForCharacter,heroPortraitArt,raceBoardTiles} from './race-assets.mjs';
import {fantasyPiecePath} from './fantasy-piece.mjs';
import {makeToggle,syncToggles} from './board-view-toggle.mjs';
import {classifyStrongMove,reviewMoveJournal} from './finished-game-review.mjs';
import {combatGoldReward} from './resources-core.mjs';
import {armyCandidates} from './kingdom-army-core.mjs';
import {currentLanguage} from './i18n.mjs';

const C={
 ru:{title:'Возрождённый защитник',choose:'Назначьте командира',enemy:'Защитник',commander:'Ваш командир',
  empty:'Перетащите или выберите героя',army:'Армия из обычных рекрутов и наёмников',
  available:'Доступные герои',cancel:'Отмена',fight:'Бой',auto:'Автобой',week:'Неделя',
  gold:'Золото за победу',wounded:'Тяжело ранен',used:'Уже участвовал',healthy:'Здоров',
  tutorial:'Один герой — одна Битва за неделю',mercenary:'Наёмники',cost:'Стоимость найма',
  fromGold:'Золото',fromSupplies:'Припасы',debt:'Неоплаченный долг! После партии погибнет командир: ',
  kingDebt:'Гибель короля завершит путешествие!',confirm:'Подтвердить и начать',
  battle:'Битва защитников',thinking:'Движок обдумывает ход…',pause:'Пауза',resume:'Продолжить',
  result:'К результату',battleManual:'Ваш ход',battleAuto:'Идёт автобой',move:'Ход',
  win:'Победа',draw:'Ничья',loss:'Поражение',return:'К карте',
  rewards:'Награда',mastery:'Мастерство',dead:'Командир погиб из-за долга',warning:'Потери обычных рекрутов постоянны',
  error:'Не удалось начать сражение',noHeroes:'Нет доступных героев',back:'Закрыть'},
 en:{title:'Returned defender',choose:'Assign a commander',enemy:'Defender',commander:'Your commander',
  empty:'Drag or select a hero',army:'Regular recruits and mercenaries only',
  available:'Available heroes',cancel:'Cancel',fight:'Battle',auto:'Auto battle',week:'Week',
  gold:'Gold on victory',wounded:'Seriously wounded',used:'Already deployed',healthy:'Healthy',
  tutorial:'One battle per hero each week',mercenary:'Mercenaries',cost:'Hiring cost',
  fromGold:'Gold',fromSupplies:'Supplies',debt:'Unpaid debt! Commander will die after battle: ',
  kingDebt:'King death ends the run!',confirm:'Confirm and start',
  battle:'Defender battle',thinking:'Engine is thinking…',pause:'Pause',resume:'Resume',
  result:'Skip to result',battleManual:'Your move',battleAuto:'Auto battle',move:'Move',
  win:'Victory',draw:'Draw',loss:'Defeat',return:'To map',
  rewards:'Reward',mastery:'Mastery',dead:'Commander died from debt',warning:'Regular recruit losses are permanent',
  error:'Could not start battle',noHeroes:'No available heroes',back:'Close'}
};
function t(k){return C[currentLanguage()==='en'?'en':'ru'][k]||k;}
const typeToCode={king:'K',queen:'Q',rook:'R',bishop:'B',knight:'N',pawn:'P'};
let root=null,selectedHeroId=null,cellId=null,engine=null,adapter=null;
let identities=new Map(),capturedIds=new Set(),selectedSquare=null,paused=false,speed=1,skip=false,thinking=false;
let turnTimer=null,session=0,lastResult=null,movePending=false,paymentModal=null,beforeFenForMove=null;
function h(tag,cls='',text=''){
 const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;
}
function image(path,cls='',alt=''){
 const e=h('img',cls);e.src=path;e.alt=alt;e.loading='lazy';return e;
}
function ensure(){
 if(root)return root;
 const link=h('link');link.rel='stylesheet';link.href='css/weekly-defenders.css?v=20261115-a';
 document.head.append(link);
 root=h('div','wd-overlay');root.hidden=true;root.dataset.weeklyDefenders='';
 root.innerHTML='<section class="wd-dialog" role="dialog" aria-modal="true" aria-label="Weekly defender">'+
  '<header class="wd-header"><div><small class="wd-eyebrow" data-wd-week></small><h2 data-wd-title></h2></div><button data-wd-action="close" class="wd-x" aria-label="Close">×</button></header>'+
  '<div data-wd-setup><div class="wd-duel"><div class="wd-portrait wd-opponent" data-wd-enemy></div>'+
  '<div class="wd-portrait wd-commander wd-drop" data-wd-commander></div></div>'+
  '<div class="wd-section-caption"><span data-wd-available></span><span data-wd-tip></span></div>'+
  '<div class="wd-carousel-wrap"><button class="wd-arrow" data-wd-action="prev" aria-label="Previous heroes">‹</button>'+
  '<div class="wd-carousel" data-wd-carousel></div>'+
  '<button class="wd-arrow" data-wd-action="next" aria-label="Next heroes">›</button></div>'+
  '<div class="wd-foot"><div class="wd-gold"><span data-wd-gold-label></span><strong data-wd-gold></strong></div>'+
  '<div class="wd-buttons"><button data-wd-action="close" class="wd-button"></button>'+
  '<button data-wd-action="start" class="wd-button wd-primary"></button></div></div></div>'+
  '<section class="wd-payment" data-wd-payment hidden></section>'+
  '<section class="wd-play" data-wd-play hidden><div class="wd-play-layout">'+
  '<div class="wd-chess-stage"><div class="classic-board wd-chess-board" data-wd-board></div></div>'+
  '<aside class="wd-sidebar"><h3 data-wd-battle-title></h3><p data-wd-battle-info></p>'+
  '<div class="wd-view-toggle" data-wd-view-toggle></div>'+
  '<div class="wd-move-history" data-wd-moves></div>'+
  '<div class="wd-grade-legend" data-wd-grade-legend></div>'+
  '<div class="wd-play-controls"><button class="wd-button" data-wd-action="pause"></button>'+
  '<button class="wd-button" data-wd-action="speed">×1</button>'+
  '<button class="wd-button" data-wd-action="skip"></button></div></aside></div></section>'+
  '<section class="wd-results" data-wd-results hidden></section></section>';
 document.body.append(root);
 root.querySelector('[data-wd-view-toggle]').append(makeToggle());
 syncToggles();
 root.addEventListener('click',onAction);
 root.addEventListener('dragover',e=>{if(e.target.closest('.wd-drop'))e.preventDefault()});
 root.addEventListener('drop',e=>{if(!e.target.closest('.wd-drop'))return;e.preventDefault();selectHero(e.dataTransfer?.getData('text/plain'))});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!weeklyState(readRun()).active)close()});
 return root;
}
function close(){
 if(paymentModal)paymentModal.hidden=true;
 // Suspending is safe: every played half-move and the week receipt are saved.
 if(weeklyState(readRun()).active){
  paused=true;session++;clearTimeout(turnTimer);adapter?.stop?.();
  root.hidden=true;
  globalThis.RPChessKingdomMap?.open?.();
  return;
 }
 root.hidden=true;cellId=null;selectedHeroId=null;
}
function showPane(name){
 for(const n of ['setup','payment','play','results'])root.querySelector('[data-wd-'+n+']').hidden=n!==name;
}
function setText(selector,value){const e=root.querySelector(selector);if(e)e.textContent=value}
function selectHero(id){
 const run=readRun();if(!run||!run.roster.some(c=>c.id===id&&c.status==='healthy'&&c.weeklyCommandedWeek!==weekForDay(run.kingdomMap.day)))return;
 selectedHeroId=id;renderCommander();renderHeroes();
}
function renderCommander(){
 const run=readRun(),slot=root.querySelector('[data-wd-commander]');
 slot.replaceChildren();
 const hero=run?.roster?.find(c=>c.id===selectedHeroId);
 if(!hero){
  slot.append(h('div','wd-empty-icon','♔'),h('small','',t('commander')),h('p','',t('empty')));
 }else{
  slot.append(image(hero.portrait||'generated_assets/unit_king_player.png','wd-art'),h('b','',hero.name),
   h('small','',t('commander')));
  if(!hero.isRunKing){
   const stars=h('div','wd-stars');decorateThreat(stars,hero.threatLevel,{language:currentLanguage(),xp:hero.threatXp});
   slot.append(stars);
   const track=h('div','wd-progress');const fill=h('div');fill.style.width=Math.max(0,Math.min(100,hero.threatXp||0))+'%';
   track.append(fill);slot.append(track);
  }
 }
 root.querySelector('[data-wd-action="start"]').disabled=!hero;
 root.querySelector('[data-wd-action="start"]').textContent=hero?.isRunKing?t('fight'):t('auto');
}
function renderHeroes(){
 const run=readRun(),week=weekForDay(run.kingdomMap.day),carousel=root.querySelector('[data-wd-carousel]');
 carousel.replaceChildren();
 for(const hero of run.roster){
  const eligible=hero.status==='healthy'&&hero.weeklyCommandedWeek!==week;
  const button=h('button','wd-hero'+(hero.id===selectedHeroId?' is-selected':'')+(eligible?'':' is-locked'));
  button.type='button';button.disabled=!eligible;
  button.draggable=eligible;button.addEventListener('dragstart',e=>e.dataTransfer?.setData('text/plain',hero.id));
  button.addEventListener('click',()=>selectHero(hero.id));
  button.append(image(heroPortraitArt(hero),'wd-hero-art'),h('b','',hero.name));
  button.append(h('small','',hero.isRunKing?t('fight'):(!eligible?(hero.status==='healthy'?t('used'):t('wounded')):t('auto'))));
  if(!hero.isRunKing){const stars=h('div','wd-stars');decorateThreat(stars,hero.threatLevel,{language:currentLanguage()});button.append(stars);
   const progress=h('div','wd-progress'),fill=h('div');fill.style.width=(hero.threatXp||0)+'%';progress.append(fill);button.append(progress);}
  carousel.append(button);
 }
}
function renderSetup(){
 const run=readRun(),cell=run?.kingdomMap?.cells?.[cellId];if(!cell)return;
 showPane('setup');
 setText('[data-wd-week]',t('week')+' '+weekForDay(run.kingdomMap.day));
 setText('[data-wd-title]',t('title'));
 setText('[data-wd-available]',t('available'));setText('[data-wd-tip]',t('tutorial'));
 setText('[data-wd-gold-label]',t('gold'));
 const gold=Math.floor(combatGoldReward({encounterType:'battle',stars:cell.selectedEncounter.stars,playerColor:'w',status:{over:true,type:'checkmate',winner:'w'}})/2);
 setText('[data-wd-gold]',gold.toString());
 const opponent=root.querySelector('[data-wd-enemy]');opponent.replaceChildren();
 // Same level-aware pawn→knight→bishop→rook→queen→king threat figure as the map.
 const art=kingdomEncounterSprite(cell.selectedEncounter);
 const role=['pawn','knight','bishop','rook','queen','king'][
  Math.floor((Math.max(1,Math.min(12,Number(cell.selectedEncounter.stars)||1))-1)/2)];
 const defenderArt=art?.includes('/pieces/board/')?art:
  boardRacePiecePath('humans',role,'b');
 opponent.append(image(defenderArt,'wd-art'),h('b','',t('enemy')));
 const stars=h('div','wd-stars');decorateThreat(stars,cell.selectedEncounter.stars,{language:currentLanguage()});
 opponent.append(stars,h('small','',t('army')));
 root.querySelector('.wd-foot [data-wd-action="close"]').textContent=t('cancel');
 renderCommander();renderHeroes();
}
function openWeekly(id){
 const run=readRun();if(!run||!id)return false;
 if(weeklyState(run).active){resumeWeekly();return true}
 if(!eligibleWeeklySite(run.kingdomMap,id))return false;
 ensure();cellId=id;selectedHeroId=null;root.hidden=false;renderSetup();return true;
}
// Use the approved Battle mercenary dialog DOM and CSS, not a parallel design.
function ensurePaymentModal(){
 if(paymentModal)return paymentModal;
 if(!document.querySelector('[data-mercenary-hire-style],[data-wd-hire-style]')){
  const link=h('link');link.rel='stylesheet';
  link.href='css/battle-mercenary-dialog.css?v=20261114-travel-overlay-v2';
  link.dataset.wdHireStyle='';document.head.append(link);
 }
 paymentModal=h('div','rpchess-mercenary-modal');paymentModal.hidden=true;
 paymentModal.dataset.weeklyHireOverlay='';
 paymentModal.innerHTML='<div class="rpchess-mercenary-layout">'+
  '<img class="rpchess-mercenary-portrait" alt="" data-wd-orc>'+
  '<section class="rpchess-mercenary-panel" role="dialog" aria-modal="true">'+
  '<h2 class="rpchess-mercenary-title" data-wd-hire-title></h2>'+
  '<div class="rpchess-mercenary-tip"><span class="rpchess-mercenary-dot" aria-hidden="true"></span>'+
  '<div data-wd-hire-content></div></div>'+
  '<div class="rpchess-mercenary-actions" data-wd-hire-actions></div></section></div>';
 document.body.append(paymentModal);
 paymentModal.querySelector('[data-wd-orc]').src='assets/ui/orc-mercenary-recruiter.png?v=20261114-original-512';
 paymentModal.addEventListener('click',event=>{
  const action=event.target.closest('[data-wd-hire-action]')?.dataset.wdHireAction;
  if(!action)return;
  paymentModal.hidden=true;
  if(action==='no'){root.hidden=false;renderSetup();return;}
  if(action==='yes'){root.hidden=false;commitStart(true);}
 });
 return paymentModal;
}
function renderPayment(offer){
 const modal=ensurePaymentModal(),english=currentLanguage()==='en';
 root.hidden=true;modal.hidden=false;
 modal.querySelector('[data-wd-hire-title]').textContent=english?
  '"At your service, Your Majesty! For a fair price, of course…"':
  '«Мы к вашим услугам, Ваше Величество! За подходящую плату, конечно...»';
 const content=modal.querySelector('[data-wd-hire-content]');content.replaceChildren();
 const roster=h('div','rpchess-mercenary-roster');
 let count=0;
 function plus(text){roster.append(h('span','rpchess-mercenary-plus',text));}
 for(const type of ['queen','rook','bishop','knight','pawn']){
  const n=offer.quote.counts[type]||0;if(!n)continue;
  if(count++)plus('+');
  const item=h('span','rpchess-mercenary-piece'),art=image(boardRacePiecePath('orcs',type,'w'),'');
  const quantity=h('strong','',n>1?'×'+n:'');
  art.title=(english?{queen:'Queen',rook:'Rook',bishop:'Bishop',knight:'Knight',pawn:'Pawn'}:
   {queen:'Ферзь',rook:'Ладья',bishop:'Слон',knight:'Конь',pawn:'Пешка'})[type];
  item.append(art,quantity);roster.append(item);
 }
 plus('=');
 const amounts=[
  [offer.payment.chargedGold,'generated_assets/reward_gold.png',english?'Gold':'Золото'],
  [offer.payment.chargedSupplies,'generated_assets/reward_supplies.png',english?'Supplies':'Припасы']
 ];
 amounts.forEach(([n,art,label],i)=>{
  if(i)plus('+');
  const item=h('span','rpchess-mercenary-cost');
  item.append(h('strong','',String(n)),image(art,'',label));roster.append(item);
 });
 content.append(roster);
 if(offer.payment.unpaidValue>0){
  content.append(h('p','wd-debt',t('debt')+offer.hero.name+
   (offer.hero.isRunKing?' '+t('kingDebt'):'')));
 }
 content.append(h('p','',t('warning')));
 const actions=modal.querySelector('[data-wd-hire-actions]');actions.replaceChildren();
 const no=h('button','','✕'),yes=h('button','','✓');
 no.type=yes.type='button';no.dataset.wdHireAction='no';yes.dataset.wdHireAction='yes';
 no.title=no.getAttribute('aria-label')||t('cancel');no.setAttribute('aria-label',t('cancel'));
 yes.title=t('confirm');yes.setAttribute('aria-label',t('confirm'));
 actions.append(no,yes);
 yes.focus();
}
function commitStart(accepted){
 const run=readRun();if(!run||!selectedHeroId)return;
 const offer=weeklyQuote(run,cellId,selectedHeroId);
 if(!offer.ok){renderSetup();return;}
 if(offer.quote.totalCount&&!accepted){renderPayment(offer);return;}
 const started=startWeeklyBattle(run,cellId,selectedHeroId,{acceptDebt:accepted});
 if(!started.ok){renderSetup();return;}
 writeRun(started.run);resumeWeekly();
}
function newEngine(active){
 const chess=new ClassicChessEngine(active.fen||null);
 const map=new Map(active.formation.filter(p=>p.id).map(p=>[p.square,p.id]));
 const lost=new Set();
 for(const entry of active.moves){
  const legal=chess.legalMoves(entry.uci.slice(0,2));
  const candidate=legal.find(m=>m.from===entry.uci.slice(0,2)&&
   (m.uciTo||m.to)===entry.uci.slice(2,4)&&(m.promotion||'')===(entry.uci[4]||''));
  if(!candidate)throw new Error('Invalid weekly Battle move in save');
  const capturedSquare=candidate.capture;
  if(capturedSquare&&map.get(capturedSquare)?.startsWith('army:'))lost.add(map.get(capturedSquare));
  if(capturedSquare)map.delete(capturedSquare);
  const identity=map.get(candidate.from);map.delete(candidate.from);
  if(identity)map.set(candidate.to,identity);
  if(candidate.rookFrom){const rook=map.get(candidate.rookFrom);map.delete(candidate.rookFrom);if(rook)map.set(candidate.rookTo,rook);}
  const applied=chess.move(entry.uci.slice(0,2),entry.uci.slice(2,4),entry.uci[4]||null);
  if(!applied.ok)throw new Error('Corrupt weekly Battle save');
 }
 return {chess,identities:map,lost};
}
function resumeWeekly(){
 const run=readRun(),active=weeklyState(run).active;if(!active)return false;
 ensure();root.hidden=false;cellId=active.cellId;selectedHeroId=active.heroId;
 try{
  const recreated=newEngine(active);engine=recreated.chess;identities=recreated.identities;capturedIds=recreated.lost;
 }catch(e){console.error(e);return false;}
 session++;paused=false;speed=1;skip=false;thinking=false;lastResult=null;
 adapter?.destroy?.();adapter=new ChessAIAdapter();movePending=false;
 showPane('play');setText('[data-wd-title]',t('battle'));setText('[data-wd-week]',t('week')+' '+active.week);
 setText('[data-wd-battle-title]',active.heroName+' · '+t('enemy'));
 const legend=root.querySelector('[data-wd-grade-legend]');legend.replaceChildren();
 for(const grade of ['excellent','good','inaccuracy','mistake','blunder']){
  const sym={excellent:'!!',good:'!',inaccuracy:'?!',mistake:'?',blunder:'??'}[grade];
  const badge=h('span','wd-grade-caption');
  badge.append(h('em','mentor-grade mentor-grade--'+grade,sym),
   h('span','',gradeLabel(grade)));legend.append(badge);
 }
 root.querySelector('[data-wd-action="skip"]').hidden=active.mode==='manual';
 renderBattle();scheduleTurn();return true;
}
function renderBoard(){
 const board=root.querySelector('[data-wd-board]');board.replaceChildren();
 const run=readRun(),active=weeklyState(run).active;if(!active)return;
 const battlefield=active.encounter||run.kingdomMap?.cells?.[active.cellId]?.selectedEncounter||{};
 const tiles=raceBoardTiles(battlefield.enemyRaceTag||battlefield.raceTag||'humans');
 if(tiles){
  board.dataset.boardRace=tiles.raceTag;
  board.style.setProperty('--board-light-tile','url("'+new URL(tiles.light,document.baseURI).href+'")');
  board.style.setProperty('--board-dark-tile','url("'+new URL(tiles.dark,document.baseURI).href+'")');
 }
 const allies=new Map(armyCandidates(run).map(c=>[c.id,c]));
 const ranks=active.playerColor==='w'?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 const files=active.playerColor==='w'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
 const snap=engine.snapshot();
 const roles={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
 const last=active.moves.at(-1);
 const badgeMarks={inaccuracy:'?!',mistake:'?',blunder:'??',good:'!',excellent:'!!'};
 for(const rank of ranks)for(const file of files){
  const sq='abcdefgh'[file]+(rank+1),piece=snap.board[rank*8+file];
  const light=(rank+file)%2!==0;
  const button=h('button','wd-square classic-square '+(light?'classic-square--light':'classic-square--dark')+
   (sq===selectedSquare?' is-selected':'')+(last&&(last.uci.slice(0,2)===sq||last.uci.slice(2,4)===sq)?' wd-last':''));
  button.type='button';button.dataset.square=sq;button.setAttribute('aria-label',sq);
  if(piece){
   const role=roles[piece.type];let art;
   if(piece.color===active.playerColor){
    const id=identities.get(sq),recruit=allies.get(id);
    art=id==='weekly:free-king'?boardRacePiecePath('humans','king',piece.color):
      recruit?boardPieceArtForCharacter(recruit,piece.color,role):
      boardRacePiecePath('orcs',role,piece.color);
   }else art=boardPieceArtForTheme(battlefield,role,piece.color);
   button.append(image(art,'wd-battle-unit classic-piece',''));
   button.append(image(fantasyPiecePath(piece.type,piece.color),'wd-battle-simple rpchess-fantasy-piece',''));
  }
  if(last?.uci.slice(2,4)===sq&&badgeMarks[last.grade]){
   const grade=h('span','mentor-square-grade'+(['good','excellent'].includes(last.grade)?' mentor-square-grade--good':''),
    badgeMarks[last.grade]);grade.title=gradeLabel(last.grade);
   button.append(grade);
  }
  button.addEventListener('click',()=>manualSquare(sq));board.append(button);
 }
}
const GRADE_LABELS={
 ru:{good:'Хороший ход',excellent:'Блестящий ход',inaccuracy:'Неточность',mistake:'Ошибка',blunder:'Зевок'},
 en:{good:'Good move',excellent:'Brilliant move',inaccuracy:'Inaccuracy',mistake:'Mistake',blunder:'Blunder'}
};
function gradeLabel(kind){return GRADE_LABELS[currentLanguage()==='en'?'en':'ru'][kind]||'';}
function renderBattle(){
 const active=weeklyState(readRun()).active;if(!active)return;
 setText('[data-wd-battle-info]',active.mode==='auto'?t('battleAuto'):(engine.turn()===active.playerColor?t('battleManual'):t('thinking')));
 const moves=root.querySelector('[data-wd-moves]');moves.replaceChildren();
 let journal=[];
 try{journal=reviewMoveJournal(active.moves.map(m=>m.uci),{startFen:active.fen||undefined});}
 catch{journal=active.moves.map((m,i)=>({ply:i+1,san:m.uci}));}
 const marks={good:'!',excellent:'!!',inaccuracy:'?!',mistake:'?',blunder:'??'};
 journal.slice(-32).forEach((move,i)=>{
  const saved=active.moves[move.ply-1],item=h('span','wd-move');
  item.append(h('span','',Math.floor((move.ply-1)/2)+1+(move.ply%2?'...':'.')+' '+move.san));
  if(saved?.grade&&marks[saved.grade]){
   const mark=h('em','mentor-grade mentor-grade--'+saved.grade,marks[saved.grade]);
   mark.title=gradeLabel(saved.grade);mark.setAttribute('aria-label',mark.title);item.append(mark);
  }
  moves.append(item);
 });
 moves.scrollTop=moves.scrollHeight;
 root.querySelector('[data-wd-action="pause"]').textContent=paused?t('resume'):t('pause');
 root.querySelector('[data-wd-action="speed"]').textContent='×'+speed;
 root.querySelector('[data-wd-action="skip"]').textContent=t('result');
 renderBoard();
}
function manualSquare(sq){
 const active=weeklyState(readRun()).active;
 if(!active||active.mode!=='manual'||engine.turn()!==active.playerColor||thinking||movePending)return;
 if(!selectedSquare){if(engine.pieceAt(sq)?.color===active.playerColor){selectedSquare=sq;renderBoard();}return;}
 if(sq===selectedSquare){selectedSquare=null;renderBoard();return;}
 const choices=engine.legalMoves(selectedSquare).filter(m=>(m.uciTo||m.to)===sq);
 if(!choices.length){selectedSquare=engine.pieceAt(sq)?.color===active.playerColor?sq:null;renderBoard();return;}
 const promotion=choices.some(m=>m.promotion)?'q':'';
 const uci=selectedSquare+sq+promotion;selectedSquare=null;void playMove(uci);
}
async function playMove(uci){
 if(movePending)return;
 const run=readRun(),active=weeklyState(run).active;if(!active||!engine)return;
 movePending=true;
 try{
 const stamp=session;
 // Two genuine Stockfish position scores feed the Mentor win-probability grader.
 // Failed analysis yields no badge, never a fabricated move assessment.
 const beforeFen=engine.fen();
 const before=skip?null:await adapter.analyzePosition({fen:beforeFen,depth:10});
 if(stamp!==session)return;
 const move=engine.move(uci.slice(0,2),uci.slice(2,4),uci[4]||null);
 if(!move.ok)return;
 const after=skip?null:await adapter.analyzePosition({fen:engine.fen(),depth:10});
 if(stamp!==session)return;
 const quality=trainingMoveQualityWinChance(before,after,uci);
 const centipawnLoss=Number.isFinite(before?.cp)&&Number.isFinite(after?.cp)?Math.max(0,before.cp+after.cp):null;
 const strong=Number.isFinite(centipawnLoss)?
  classifyStrongMove({uci,beforeFen},before,centipawnLoss):null;
 const grade=quality?.kind||strong||
  (before?.depth>=9&&after?.depth>=9&&before.bestMove===uci&&
   centipawnLoss!==null&&centipawnLoss<=40?'good':null);
 // Symbols are render-only; persisted grades retain mentor-compatible semantic keys.
 // Persist move plus its measured score classification before the next turn.
 const saved=recordWeeklyMove(run,uci,grade);
 if(!saved.ok)return;
 writeRun(saved.run);
 const restored=newEngine(weeklyState(saved.run).active);
 identities=restored.identities;capturedIds=restored.lost;
 renderBattle();
 if(engine.status().over||weeklyState(saved.run).active.moves.length>=400){finishBattle();return;}
 scheduleTurn();
 }finally{movePending=false;}
}
function scheduleTurn(){
 clearTimeout(turnTimer);
 const run=readRun(),active=weeklyState(run).active;if(!active||!engine||engine.status().over)return;
 if(active.mode==='manual'&&engine.turn()===active.playerColor){renderBattle();return;}
 if(paused)return;
 const stamp=session;
 turnTimer=setTimeout(async()=>{
  if(stamp!==session||paused||thinking)return;thinking=true;renderBattle();
  try{
   const side=engine.turn(),elo=side===active.playerColor?threatRank(active.heroLevel).elo:threatRank(active.enemyLevel).elo;
   const uci=await adapter.chooseMove({fen:engine.fen(),elo,legalMoves:engine.legalMoves()});
   if(stamp===session&&!paused&&uci){thinking=false;await playMove(uci);}
  }catch(error){console.error('[weekly-defenders]',error);thinking=false;}
  finally{thinking=false;}
 },skip?0:Math.round(1000/speed));
}
function finishBattle(){
 clearTimeout(turnTimer);session++;adapter?.stop?.();
 const run=readRun(),active=weeklyState(run).active;if(!active)return;
 const status=engine.status();
 const result=status.over&&status.winner===active.playerColor?'win':
  status.over&&status.winner?'loss':'draw';
 const finished=settleWeeklyBattle(run,{result,capturedIds:[...capturedIds]});
 if(!finished.ok)return;
 writeRun(finished.run);lastResult=finished.results;
 showPane('results');
 const english=currentLanguage()==='en',copy=(ru,en)=>english?en:ru;
 const panel=root.querySelector('[data-wd-results]');panel.replaceChildren();
 const hero=finished.run.roster.find(x=>x.id===active.heroId);
 const kicker=h('div','wd-outcome-kicker',copy('ИТОГИ ЕЖЕНЕДЕЛЬНОЙ БИТВЫ','WEEKLY BATTLE RESULT'));
 const title=h('h2','wd-outcome-title',t(result));
 const description=h('p','wd-outcome-subtitle',copy('Неделя ','Week ')+active.week+' · '+active.heroName);
 const banner=h('div','wd-outcome-banner');
 banner.append(kicker,title,description);
 panel.append(banner);
 const heroCard=h('section','wd-result-hero');
 heroCard.append(image(heroPortraitArt(hero),'wd-result-portrait',hero?.name||active.heroName));
 const heroInfo=h('div','wd-result-hero-info');
 heroInfo.append(h('small','wd-outcome-kicker',copy('КОМАНДИР','COMMANDER')),
  h('h3','',hero?.name||active.heroName));
 if(active.mode==='auto'){
  const from=threatRank(lastResult.beforeLevel);
  const to=threatRank(lastResult.afterLevel);
  const transition=h('div','wd-result-ranks');
  const fromStars=h('span','wd-result-stars');
  decorateThreat(fromStars,lastResult.beforeLevel,{language:currentLanguage(),xp:lastResult.beforeXp});
  const afterStars=h('span','wd-result-stars');
  decorateThreat(afterStars,lastResult.afterLevel,{language:currentLanguage(),xp:lastResult.afterXp});
  const change=(lastResult.beforeLevel!==lastResult.afterLevel);
  if(change)transition.append(fromStars,h('span','wd-result-arrow','➜'));
  transition.append(afterStars);
  const nextLabel=h('div','wd-progress-caption');
  nextLabel.append(h('span','',english?to.en:to.ru),
   h('span','',(lastResult.afterXp||0)+' / 100 XP'));
  const bar=h('div','wd-result-xp-track'),fill=h('div','wd-result-xp-fill');
  fill.style.width=(lastResult.afterXp||0)+'%';fill.style.background=to.color;
  bar.append(fill);
  heroInfo.append(transition,nextLabel,bar);
  if(lastResult.mastery>0)heroInfo.append(h('strong','wd-result-xp-gained','+'+lastResult.mastery+' XP'));
 }else{
  heroInfo.append(h('p','wd-result-king-note',
   copy('Личный король · ручное управление · не получает мастерство',
    'Personal king · manual play · no mastery gained')));
 }
 let outcomeText=result==='win'?copy('Победа! Территория остаётся вашей.','Victory! The territory remains yours.'):
  result==='draw'?copy('Ничья. Командир не ранен.','Draw. Commander remains healthy.'):
  active.mode==='auto'?copy('Поражение. Командир тяжело ранен.','Defeat. Commander seriously wounded.'):
   copy('Поражение короля. Путешествие продолжается.','King defeated. The journey continues.');
 if(lastResult.killed)outcomeText=copy('Командир погиб из-за долга наёмникам.','Commander died from unpaid mercenary debt.');
 heroInfo.append(h('p','wd-outcome-status'+(lastResult.killed||result==='loss'?' wd-outcome-danger':''),outcomeText));
 heroCard.append(heroInfo);panel.append(heroCard);
 const rewards=h('div','wd-result-rewards');
 for(const [heading,value,art] of [
  [copy('ЗОЛОТО','GOLD'),'+'+lastResult.gold,'generated_assets/reward_gold.png'],
  [copy('МАСТЕРСТВО','MASTERY'),active.mode==='manual'?'—':'+'+lastResult.mastery,null],
  [copy('ПОТЕРИ РЕКРУТОВ','LOST RECRUITS'),String(lastResult.capturedIds.length),null]
 ]){
  const box=h('div','wd-result-reward');
  const top=h('small','',heading);box.append(top);
  const amount=h('strong','',value);
  if(art)amount.prepend(image(art,'wd-reward-icon'));
  box.append(amount);rewards.append(box);
 }
 panel.append(rewards);
 const stats=lastResult.stats;
 if(stats){
  panel.append(h('p','wd-outcome-record',copy('Статистика героя: ','Hero record: ')+
   stats.wins+' / '+stats.draws+' / '+stats.losses+
   '  '+copy('(победы / ничьи / поражения)','(W / D / L)')));
 }
 const action=h('div','wd-buttons wd-result-actions');
 const history=h('button','wd-button',copy('История героя','Hero history'));
 const back=h('button','wd-button wd-primary',t('return'));
 history.onclick=()=>{
  const existing=panel.querySelector('[data-wd-history]');if(existing){existing.remove();return;}
  const box=h('div','wd-result-history');box.dataset.wdHistory='';
  const records=hero?.weeklyBattleHistory||[];
  for(const row of records.slice(-8).reverse()){
   box.append(h('p','',copy('Неделя ','Week ')+row.week+' · '+row.cellId+' · '+
    ({win:t('win'),draw:t('draw'),loss:t('loss')}[row.result]||row.result)));
  }
  if(!records.length)box.append(h('p','',copy('История пока пуста','No battles yet')));
  action.before(box);
 };
 back.onclick=()=>{
  root.hidden=true;cellId=null;selectedHeroId=null;
  if(lastResult.kingDied){globalThis.RPChessEndlessRun?.open?.(readRun());}
  else{globalThis.RPChessKingdomMap?.open?.();
   globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'weekly-defenders'}}));}
 };
 action.append(history,back);panel.append(action);
}
function onAction(event){
 const button=event.target.closest('[data-wd-action]');if(!button)return;
 const act=button.dataset.wdAction;
 if(act==='close')close();
 if(act==='prev'||act==='next')root.querySelector('[data-wd-carousel]').scrollBy({left:(act==='next'?1:-1)*400,behavior:'smooth'});
 if(act==='start')commitStart(false);
 if(act==='pause'){paused=!paused;if(!paused)scheduleTurn();renderBattle();}
 if(act==='speed'){speed=speed===1?2:speed===2?4:1;renderBattle();}
 if(act==='skip'){skip=true;paused=false;scheduleTurn();renderBattle();}
}
export {openWeekly,resumeWeekly};