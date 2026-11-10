/* Economy tuning shared by the game and Atlas Lab v6.
 * Atlas edits are sandbox-only; exported presets require explicit promotion
 * to these canonical defaults by the developer after author acceptance.
 */
const PIECE_TYPES=Object.freeze(['pawn','knight','bishop','rook','queen']);
const PIECE_LABELS=Object.freeze({pawn:'Пешка',knight:'Конь',bishop:'Слон',rook:'Ладья',queen:'Ферзь'});
const NAMED_HERO_LABELS=Object.freeze({
  "hero.aldric_wall": "Альдрик Стена · Ладья",
  "hero.mara_chain": "Мара Цепь · Пешка",
  "hero.brother_orell": "Брат Орелл · Слон",
  "hero.vael_hammer": "Ваэль Молот · Конь",
  "hero.lady_sorn": "Леди Сорн · Ферзь",
  "hero.seraph_lyra": "Серафима Лира · Слон",
  "hero.ivar_lens": "Ивар Линза · Ладья",
  "hero.nemea_quill": "Немея Перо · Пешка",
  "hero.orion_step": "Орион Шаг · Конь",
  "hero.abbess_celene": "Аббатиса Селена · Ферзь",
  "hero.deacon_mirel": "Диакон Мирель · Слон",
  "hero.cassian_coin": "Кассиан Монета · Ладья",
  "hero.viola_mask": "Виола Маска · Ферзь",
  "hero.renzo_bridge": "Ренцо Мост · Пешка",
  "hero.tessa_gull": "Тесса Чайка · Конь",
  "hero.old_marin": "Старый Марин · Слон",
  "hero.elio_silk": "Элио Шёлк · Пешка",
  "hero.briar_sister": "Сестра Терн · Слон",
  "hero.roan_stag": "Роан Олень · Конь",
  "hero.maeve_root": "Мейв Корень · Ладья",
  "hero.puck_ember": "Пак Уголёк · Пешка",
  "hero.ysra_moss": "Исра Мох · Ферзь",
  "hero.kael_cinder": "Каэль Уголь · Пешка",
  "hero.velka_urn": "Велька Урна · Слон",
  "hero.rath_banner": "Рат Знамя · Ладья",
  "hero.suri_ash": "Сури Пепел · Конь",
  "hero.empress_nahla": "Императрица Нахла · Ферзь",
  "hero.daro_last": "Даро Последний · Пешка",
  "hero.temur_wind": "Темур Ветер · Конь",
  "hero.altana_bow": "Алтана Лук · Слон",
  "hero.batu_cliff": "Бату Утёс · Ладья",
  "hero.saran_dawn": "Саран Рассвет · Пешка",
  "hero.khulan_star": "Хулан Звезда · Ферзь"
});
const DEFAULT_KINGDOM_ECONOMY=Object.freeze({
  schemaVersion:1,
  starting:{gold:80,supplies:30,shards:0,kingPower:600},
  travel:{foreignCellSupplies:1,ownedCellSupplies:0,starvationCharacterLoss:1},
  combat:{battleGoldBase:36,battleGoldPerStar:9,skirmishGoldBase:12,skirmishGoldPerStar:4,drawRewardPercent:50,puzzleGoldBase:9,puzzleGoldPerStar:3,puzzleError1Percent:70,puzzleError2Percent:40,puzzleError3Percent:0,
    caravanRewardGoldBase:40,caravanRewardGoldPerStar:9,caravanRewardSuppliesBase:4,
    caravanRewardSuppliesPer3Stars:2,caravanRewardArtifactBase:1,caravanRewardArtifactPer5Stars:1},
  settlementServices:{
    supplyUnitGold:12,supplyStock:15,
    artifactGoldPerCharge:{'tactics.fork_master':15,'threat.defense':18,'threat.attack':18,'threat.great':30,'vision.piercing':15},
    healing:{pawn:6,knight:18,bishop:18,rook:30,queen:54},
    namedHeroPrices:{
    "hero.aldric_wall": 134,
    "hero.mara_chain": 50,
    "hero.brother_orell": 88,
    "hero.vael_hammer": 88,
    "hero.lady_sorn": 202,
    "hero.seraph_lyra": 88,
    "hero.ivar_lens": 134,
    "hero.nemea_quill": 50,
    "hero.orion_step": 88,
    "hero.abbess_celene": 202,
    "hero.deacon_mirel": 88,
    "hero.cassian_coin": 134,
    "hero.viola_mask": 202,
    "hero.renzo_bridge": 50,
    "hero.tessa_gull": 88,
    "hero.old_marin": 88,
    "hero.elio_silk": 50,
    "hero.briar_sister": 88,
    "hero.roan_stag": 88,
    "hero.maeve_root": 134,
    "hero.puck_ember": 50,
    "hero.ysra_moss": 202,
    "hero.kael_cinder": 50,
    "hero.velka_urn": 88,
    "hero.rath_banner": 134,
    "hero.suri_ash": 88,
    "hero.empress_nahla": 202,
    "hero.daro_last": 50,
    "hero.temur_wind": 88,
    "hero.altana_bow": 88,
    "hero.batu_cliff": 134,
    "hero.saran_dawn": 50,
    "hero.khulan_star": 202
}
  },
  castle:{recruitGold:{pawn:1,knight:3,bishop:3,rook:5,queen:9}},
  mercenaries:{goldCost:{pawn:2,knight:6,bishop:6,rook:10,queen:18,king:0},reserveReplacementGold:{pawn:2,knight:6,bishop:6,rook:10,queen:18},supplyGoldValue:20},
  building:{
    outpostShards:30,outpostGold:0,
    settlementOwnedGold:80,settlementOwnedShards:15,
    settlementForeignGold:160,settlementForeignShards:30
  },
  production:{
    weekDays:7,
    settlementGold:20,
    caravanGold:12,caravanSupplies:5,
    eventGold:10,eventSupplies:4,
    puzzleShards:5,
    skirmishRecruits:1,
    battleRespawnWeeks:1
  },
  arena:{
    firstWinShardsBase:30,firstWinShardsPer7:5,
    repeatWinShardsBase:15,repeatWinShardsPer7:2,
    rewardedAdMultiplier:2,
    squadShards:{elves:120,orcs:160,undead:200,dark_elves:240,dwarves:280,demons:320,angels:360,dragonborn:400,beastfolk:440,constructs:480,animals:520,fae:560,goblins:600},
    artifactShards:{'threat.defense':8,'threat.attack':8,'threat.great':14,'vision.piercing':7,'tactics.fork_master':7}
  },
  recruits:{
    levelWeights:{
      I:{pawn:100,knight:0,bishop:0,rook:0,queen:0},
      II:{pawn:50,knight:50,bishop:0,rook:0,queen:0},
      III:{pawn:40,knight:30,bishop:30,rook:0,queen:0},
      IV:{pawn:30,knight:25,bishop:25,rook:20,queen:0},
      V:{pawn:30,knight:20,bishop:20,rook:20,queen:10}
    }
  }
});
const ECONOMY_GROUPS=Object.freeze([
 ['Стартовый баланс','starting'],
 ['Путешествие и истощение','travel'],
 ['Награды боёв, задач и Каравана','combat'],
 ['Поселение · товары и лечение','settlementServices','supplyUnitGold','supplyStock','healing'],
 ['Именные герои · цены отдельно','settlementServices','namedHeroPrices'],
 ['Артефакты · цены в золоте','settlementServices','artifactGoldPerCharge'],
 ['Замок · найм обычных фигур','castle'],
 ['Автоматический найм наёмников','mercenaries'],
 ['Строительство · внутри / вне владений','building'],
 ['Недельное производство','production'],
 ['Арена · награды и покупки','arena'],
 ['Стычки · вероятность бесплатного рекрута','recruits']
]);
const ECONOMY_LABELS=Object.freeze({
  gold:'Золото',supplies:'Припасы',shards:'Осколки чести',kingPower:'Мощь короля',
  foreignCellSupplies:'Шаг вне владений · припасы',ownedCellSupplies:'Шаг по своим землям · припасы',starvationCharacterLoss:'Жертвы от истощения',
  battleGoldBase:'Битва · золото за победу (база)',battleGoldPerStar:'Битва · золото за звезду',skirmishGoldBase:'Стычка · золото за победу (база)',skirmishGoldPerStar:'Стычка · золото за звезду',drawRewardPercent:'Ничья · % награды',puzzleGoldBase:'Задача · базовое золото',puzzleGoldPerStar:'Задача · золото за звезду',puzzleError1Percent:'Задача · награда после 1 ошибки (%)',puzzleError2Percent:'Задача · после 2 ошибок (%)',puzzleError3Percent:'Задача · после 3 ошибок (%)',
  caravanRewardGoldBase:'Караван · награда золотом (база)',caravanRewardGoldPerStar:'Караван · золото за звезду',caravanRewardSuppliesBase:'Караван · припасы (база)',caravanRewardSuppliesPer3Stars:'Караван · припасы каждые 3 звезды',caravanRewardArtifactBase:'Караван · заряд артефакта (база)',caravanRewardArtifactPer5Stars:'Караван · заряд каждые 5 звёзд',
  supplyUnitGold:'Лавка · золото за 1 припас',supplyStock:'Лавка · запас припасов',healing:'Лечение',namedHeroPrices:'Именные герои',artifactGoldPerCharge:'Артефакты · золото за заряд',recruitGold:'Цена рекрута · золото',
  goldCost:'Наёмники · золото по типу',reserveReplacementGold:'Замена именного из резерва · золото',supplyGoldValue:'Наёмники · курс 1 Припаса к золоту',outpostShards:'Аванпост · осколки',outpostGold:'Аванпост · золото',settlementOwnedGold:'Поселение на своей земле · золото',settlementOwnedShards:'Поселение на своей земле · осколки',settlementForeignGold:'Поселение за границей · золото',settlementForeignShards:'Поселение за границей · осколки',
  weekDays:'Игровых дней за неделю',settlementGold:'Поселение · золото',caravanGold:'Караван · золото',caravanSupplies:'Караван · припасы',eventGold:'Событие · золото',eventSupplies:'Событие · припасы',puzzleShards:'Задача · осколки',skirmishRecruits:'Стычка · рекрутов за неделю',battleRespawnWeeks:'Битва · недель до возвращения защитника',
  firstWinShardsBase:'Арена · первая победа (база)',firstWinShardsPer7:'Арена · первая победа, плюс каждые 7 соперников',repeatWinShardsBase:'Арена · повторная победа (база)',repeatWinShardsPer7:'Арена · повторная победа, плюс каждые 7',rewardedAdMultiplier:'Арена · множитель рекламы',squadShards:'Арена · купить расовый отряд',artifactShards:'Арена · артефакты',levelWeights:'Тип фигуры по уровню Стычки',...PIECE_LABELS,...NAMED_HERO_LABELS
});
function economyClone(value=DEFAULT_KINGDOM_ECONOMY){return JSON.parse(JSON.stringify(value));}
function normalizeKingdomEconomy(candidate,base=DEFAULT_KINGDOM_ECONOMY){
  function normalize(expected,actual){
    if(typeof expected==='number')return Number.isSafeInteger(actual)&&actual>=0&&actual<=1000000?actual:expected;
    if(!expected||typeof expected!=='object'||Array.isArray(expected))return expected;
    const output={};
    for(const [key,value] of Object.entries(expected))output[key]=normalize(value,actual?.[key]);
    return output;
  }
  const result=normalize(base,candidate);
  if(result.building.settlementForeignGold<=result.building.settlementOwnedGold)result.building.settlementForeignGold=Math.max(base.building.settlementForeignGold,result.building.settlementOwnedGold+1);
  if(result.building.settlementForeignShards<=result.building.settlementOwnedShards)result.building.settlementForeignShards=Math.max(base.building.settlementForeignShards,result.building.settlementOwnedShards+1);
  for(const weights of Object.values(result.recruits.levelWeights))if(!PIECE_TYPES.some(type=>weights[type]>0))weights.pawn=100;
  return result;
}
function economyValue(path,settings=DEFAULT_KINGDOM_ECONOMY){
  return path.split('.').reduce((obj,key)=>obj?.[key],settings);
}
function recruitTypeForLevel(level,seed,settings=DEFAULT_KINGDOM_ECONOMY){
  const key=['I','II','III','IV','V'][Math.max(0,Math.min(4,Math.round(level||1)-1))];
  const weights=settings.recruits.levelWeights[key],sum=PIECE_TYPES.reduce((n,type)=>n+weights[type],0);
  let hash=2166136261;
  for(const c of String(seed)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}
  let roll=(hash/4294967296)*sum;
  for(const type of PIECE_TYPES){roll-=weights[type];if(roll<0)return type;}
  return 'pawn';
}
export {PIECE_TYPES,PIECE_LABELS,NAMED_HERO_LABELS,DEFAULT_KINGDOM_ECONOMY,ECONOMY_GROUPS,ECONOMY_LABELS,economyClone,normalizeKingdomEconomy,economyValue,recruitTypeForLevel};
