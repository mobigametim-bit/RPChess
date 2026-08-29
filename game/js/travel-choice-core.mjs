import { MAX_ENCOUNTER_STARS, clampStars, difficultyForStars } from './encounter-difficulty.mjs';
import { RACE_TAGS, combatTheme, hashString } from './race-assets.mjs';

const TRAVEL_ENCOUNTER_TYPES = Object.freeze(['skirmish', 'battle', 'event', 'settlement', 'puzzle']);
const PLAYABLE_TRAVEL_TYPES = Object.freeze(['skirmish', 'battle', 'settlement', 'event']);
const TRAVEL_CHOICE_COUNT = 3;

const ENCOUNTER_LABELS = Object.freeze({ skirmish:'СТЫЧКА', battle:'БИТВА', event:'СОБЫТИЕ', settlement:'ПОСЕЛЕНИЕ', puzzle:'ЗАДАЧА' });
const MECHANICAL_HINTS = Object.freeze({
  skirmish:'Нестандартный состав противника.',
  battle:'Полная армия противника.',
  event:'',
  settlement:'Место для передышки и подготовки.',
  puzzle:'Шахматное испытание с заданной позицией.'
});
const THREAT_LABELS = Object.freeze(Object.fromEntries(Array.from({ length: MAX_ENCOUNTER_STARS }, (_, index) => {
  const stars = index + 1;
  return [stars, difficultyForStars(stars).threat];
})));

const FLAVOR_POOLS = Object.freeze({
  skirmish:Object.freeze([
    'Разведчики заметили впереди небольшой вражеский отряд.',
    'На дороге видны следы вооружённого патруля.',
    'Из-за холмов доносится лязг оружия небольшой группы.',
    'Вражеские дозорные заняли проход впереди.',
    'По дороге движется отряд, ещё не успевший развернуть основные силы.',
    'Небольшая группа противника готовит засаду у переправы.',
    'Разведчики сообщают о мобильном отряде неподалёку.',
    'На пути замечены несколько вражеских знамён и лёгкая охрана.',
    'Впереди расположился небольшой боевой дозор.',
    'Противник контролирует дорогу силами ограниченного отряда.',
    'Из леса показались разведчики неприятеля и их прикрытие.',
    'Узкий проход удерживает небольшой, но готовый к бою отряд.'
  ]),
  battle:Object.freeze([
    'Дорогу перекрывает полностью развёрнутая армия противника.',
    'Впереди выстроились основные силы неприятеля.',
    'Вражеские знамёна закрывают весь путь через долину.',
    'Противник подготовил полноценный боевой строй.',
    'За укреплениями ожидает армия, готовая принять сражение.',
    'Разведчики обнаружили крупные силы, занявшие дорогу.',
    'Впереди начинается поле боя — противник уже построен.',
    'Основная армия неприятеля готовится удерживать этот рубеж.',
    'Путь проходит прямо через позиции полноценных вражеских сил.',
    'На горизонте видны боевые порядки целой армии.',
    'Враг собрал полный строй и явно не собирается отступать.',
    'Дальнейший путь лежит через большое открытое сражение.'
  ]),
  event:Object.freeze([
    'У дороги происходит нечто, чего не было на картах.',
    'Странная находка заставляет отряд остановиться.',
    'В стороне от пути замечено необычное движение.',
    'На дороге осталось свидетельство недавних событий.',
    'Впереди ждёт встреча, исход которой трудно предсказать.',
    'Разведчики обнаружили нечто, заслуживающее внимания.',
    'Неожиданное происшествие преграждает привычный маршрут.',
    'У старого перекрёстка кто-то ожидает путников.',
    'Путь приводит к месту с необычно свежими следами.',
    'Впереди возникает возможность, которой ещё мгновение назад не было.',
    'С дороги доносится шум, не похожий на звуки сражения.',
    'Что-то заставляет отряд свернуть с привычного маршрута.'
  ]),
  settlement:Object.freeze([
    'За холмом видны огни укреплённого поселения.',
    'Вдалеке показались стены и дым жилых очагов.',
    'Дорога ведёт к месту, где путники могут найти передышку.',
    'На горизонте появляются башни небольшого поселения.',
    'Впереди расположен населённый укреплённый пункт.',
    'Следы телег и торговцев ведут к ближайшему поселению.',
    'За поворотом открывается дорога к обитаемым землям.',
    'Разведчики сообщают о поселении неподалёку.',
    'Вдалеке видны ворота, лавки и крыши жилых домов.',
    'Этот путь ведёт туда, где можно пополнить силы перед дорогой.',
    'За частоколом впереди кипит обычная мирная жизнь.',
    'Дорога постепенно становится оживлённее — рядом поселение.'
  ]),
  puzzle:Object.freeze([
    'Путь преграждает древняя шахматная печать.',
    'На дороге обнаружена позиция, требующая точного решения.',
    'Древний механизм откроет путь только после верного хода.'
  ])
});

function seededRandom(seed){
  let state=hashString(seed)||1;
  return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}

function isTravelChoice(value){
  return Boolean(value&&typeof value==='object'&&typeof value.id==='string'&&value.id&&TRAVEL_ENCOUNTER_TYPES.includes(value.type)&&Number.isInteger(value.step)&&value.step>=1&&Number.isInteger(value.stars)&&value.stars>=1&&value.stars<=MAX_ENCOUNTER_STARS&&typeof value.seed==='string'&&value.seed&&typeof value.flavor==='string'&&value.flavor&&typeof value.mechanicalHint==='string');
}

function createTravelChoices({runId,step=1,types=PLAYABLE_TRAVEL_TYPES}={}){
  if(!runId)throw new Error('Travel Choice requires runId');
  if(!Number.isInteger(step)||step<1)throw new Error('Travel Choice step must be a positive integer');
  const allowed=[...new Set((types||[]).filter((type)=>TRAVEL_ENCOUNTER_TYPES.includes(type)))];
  if(!allowed.length)throw new Error('Travel Choice requires at least one encounter type');
  const random=seededRandom(`${runId}:travel:${step}`);
  const typeSequence=Array.from({length:TRAVEL_CHOICE_COUNT},()=>allowed[Math.floor(random()*allowed.length)]);
  const baseThreat=clampStars(1+Math.floor((step-1)/2));
  const usedFlavorIndexes=new Map();

  return typeSequence.map((type,index)=>{
    const stars=clampStars(baseThreat+(Math.floor(random()*5)-2));
    const seed=`${runId}:travel:${step}:${index+1}:${type}`;
    const pool=FLAVOR_POOLS[type];
    const used=usedFlavorIndexes.get(type)||new Set();
    let flavorIndex=hashString(`${seed}:flavor`)%pool.length;
    while(used.has(flavorIndex)&&used.size<pool.length)flavorIndex=(flavorIndex+1)%pool.length;
    used.add(flavorIndex);
    usedFlavorIndexes.set(type,used);
    const combat = type === 'skirmish' || type === 'battle';
    const raceTag = combat ? RACE_TAGS[hashString(`${seed}:race`) % RACE_TAGS.length] : null;
    const theme = combat ? combatTheme({ seed, raceTag }) : null;
    return {
      id:`travel.${step}.${index+1}.${hashString(seed).toString(36)}`,
      step,
      type,
      label:ENCOUNTER_LABELS[type],
      stars,
      threatLabel:THREAT_LABELS[stars],
      flavor:pool[flavorIndex],
      mechanicalHint:MECHANICAL_HINTS[type],
      seed,
      ...(theme ? { playerColor:theme.playerColor, enemyRaceTag:theme.enemyRaceTag, enemyRoleRaces:theme.enemyRoleRaces, sideNarrative:theme.sideNarrative } : {})
    };
  });
}

export {TRAVEL_ENCOUNTER_TYPES,PLAYABLE_TRAVEL_TYPES,TRAVEL_CHOICE_COUNT,ENCOUNTER_LABELS,MECHANICAL_HINTS,THREAT_LABELS,FLAVOR_POOLS,hashString,seededRandom,isTravelChoice,createTravelChoices};
