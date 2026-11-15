/* Commander mastery is separate from road level (I–V) and player Power.
 * Twelve existing Elo tiers are preserved; a rank displays up to three stars.
 */
const THREAT_RANKS=Object.freeze([
 Object.freeze({id:'bronze',min:1,max:3,color:'#bd8252',ru:'Бронза',en:'Bronze'}),
 Object.freeze({id:'silver',min:4,max:6,color:'#bdc9d5',ru:'Серебро',en:'Silver'}),
 Object.freeze({id:'gold',min:7,max:9,color:'#edbf60',ru:'Золото',en:'Gold'}),
 Object.freeze({id:'diamond',min:10,max:12,color:'#76def4',ru:'Алмаз',en:'Diamond'})
]);
const MASTERY_XP_PER_LEVEL=100;
const STARTING_THREAT_BY_PIECE=Object.freeze({pawn:1,knight:3,bishop:3,rook:5,queen:9,king:1});
function initialHeroThreat(pieceType){return STARTING_THREAT_BY_PIECE[pieceType]||1;}
function threatLevel(value){return Number.isInteger(value)?Math.max(1,Math.min(12,value)):1;}
function threatRank(value){
 const level=threatLevel(value),rank=THREAT_RANKS[Math.floor((level-1)/3)];
 return {...rank,level,stars:((level-1)%3)+1,elo:200*(level+1)};
}
function threatStarsText(level){return '★'.repeat(threatRank(level).stars);}
function normalizeHeroMastery(hero){
 const level=Number.isInteger(hero?.threatLevel)?threatLevel(hero.threatLevel):initialHeroThreat(hero?.pieceType);
 const xp=Number.isSafeInteger(hero?.threatXp)&&hero.threatXp>=0
  ?Math.min(MASTERY_XP_PER_LEVEL-1,hero.threatXp):0;
 const previous=hero?.weeklyBattleStats||{};
 const stats={wins:0,draws:0,losses:0,highestDefeatedThreat:0};
 for(const field of Object.keys(stats)){
  const n=previous[field];
  if(Number.isSafeInteger(n)&&n>=0)stats[field]=Math.min(1000000,n);
 }
 const history=Array.isArray(hero?.weeklyBattleHistory)?
  hero.weeklyBattleHistory.filter(entry=>entry&&typeof entry.receiptId==='string').slice(-20):[];
 const week=hero?.weeklyCommandedWeek;
 return {...hero,threatLevel:level,threatXp:level===12?0:xp,
  weeklyCommandedWeek:Number.isSafeInteger(week)&&week>=0?week:null,
  weeklyBattleStats:stats,weeklyBattleHistory:history};
}
function awardMastery(hero,enemyLevel){
 const current=normalizeHeroMastery(hero),enemy=threatLevel(enemyLevel);
 const points=Math.max(5,Math.min(35,15+(enemy-current.threatLevel)*4));
 if(current.threatLevel>=12)return {...current,earnedMastery:0};
 let level=current.threatLevel,xp=current.threatXp+points;
 while(level<12&&xp>=MASTERY_XP_PER_LEVEL){xp-=MASTERY_XP_PER_LEVEL;level++;}
 if(level===12)xp=0;
 return {...current,threatLevel:level,threatXp:xp,earnedMastery:points};
}
function decorateThreat(element,level,{language='ru',xp=null}={}){
 if(!element||typeof document==='undefined')return;
 const rank=threatRank(level);
 element.textContent=threatStarsText(level);
 element.style.color=rank.color;
 element.dataset.threatRank=rank.id;
 element.title=(language==='en'?rank.en:rank.ru)+' '+rank.stars+'/3 · '+rank.level+'/12 · '+rank.elo+' Elo'+
  (Number.isSafeInteger(xp)&&rank.level<12?' · '+xp+'/'+MASTERY_XP_PER_LEVEL+' XP':'');
 element.setAttribute('aria-label',element.title);
}
export {THREAT_RANKS,MASTERY_XP_PER_LEVEL,STARTING_THREAT_BY_PIECE,initialHeroThreat,threatLevel,threatRank,threatStarsText,normalizeHeroMastery,awardMastery,decorateThreat};