// Cosmetic commander profiles. IDs, not paths or user-entered text, are persisted
// and sent to the public leaderboard. A commander never changes combat rules.
const DEFAULT_COMMANDER_ID='oathkeeper';
const COMMANDERS=Object.freeze([
  {id:'oathkeeper',titleRu:'Хранитель Клятвы',titleEn:'Oathkeeper',descriptionRu:'Последний хранитель древней присяги Железных Маршей. После падения крепости он собрал тех, кто ещё верит, что данное слово важнее трона.',descriptionEn:'Last keeper of an ancient oath of the Iron Marches. After the fortress fell, he gathered those who still believe a promise matters more than a throne.'},
  {id:'stone_crown',titleRu:'Каменная Корона',titleEn:'Stone Crown',descriptionRu:'Владыка каменных цитаделей. Его слово редко, зато стены и союзники под его защитой стоят до конца.',descriptionEn:'Sovereign of the stone citadels. He speaks little, but his walls and allies hold their ground to the last.'},
  {id:'wanderer_queen',titleRu:'Странствующая Королева',titleEn:'Wandering Queen',descriptionRu:'Королева без дворца. Она собирает верных людей в дороге и предпочитает доверие золочёным гербам.',descriptionEn:'A queen without a palace. She gathers loyal companions on the road and values trust over gilded heraldry.'},
  {id:'pilgrim',titleRu:'Паломник Света',titleEn:'Pilgrim of Light',descriptionRu:'Его корона потускнела в долгих странствиях. Он ведёт войско туда, где надежда нужнее победных знамен.',descriptionEn:'His crown has dulled over countless journeys. He leads where hope is needed more than victory banners.'},
  {id:'fox_prince',titleRu:'Лисий Принц',titleEn:'Fox Prince',descriptionRu:'Наследник, для которого хитрый манёвр дороже прямого удара. Даже противники не всегда понимают, когда сыграли по его правилам.',descriptionEn:'An heir who favors clever maneuvers over frontal blows. Even his foes rarely know when they have played by his rules.'},
  {id:'ash_regent',titleRu:'Пепельный Регент',titleEn:'Ash Regent',descriptionRu:'Он возглавил уцелевших после пожара престола. Под пепельной короной скрывается воля вернуть утраченное.',descriptionEn:'He took command of the survivors after the throne burned. Beneath the ash crown rests a will to reclaim what was lost.'},
  {id:'nameless_heir',titleRu:'Безымянный Наследник',titleEn:'Nameless Heir',descriptionRu:'Он не называет прежнего имени. Серебряная корона и верные ему люди — всё, что напоминает о потерянном королевстве.',descriptionEn:'He speaks nothing of his former name. A silver crown and loyal followers are all that remain of a lost kingdom.'}
].map(row=>Object.freeze({...row,portrait:`assets/kings/${row.id}/portrait.png`})));
const COMMANDER_IDS=Object.freeze(COMMANDERS.map(row=>row.id));
function normalizeCommanderId(id){return COMMANDER_IDS.includes(id)?id:DEFAULT_COMMANDER_ID;}
function commanderById(id){return COMMANDERS.find(row=>row.id===normalizeCommanderId(id))||COMMANDERS[0];}
function commanderTitle(id,language='ru'){const c=commanderById(id);return language==='en'?c.titleEn:c.titleRu;}
function commanderDescription(id,language='ru'){const c=commanderById(id);return language==='en'?c.descriptionEn:c.descriptionRu;}
function commanderPortrait(id){return commanderById(id).portrait;}
export {DEFAULT_COMMANDER_ID,COMMANDERS,COMMANDER_IDS,normalizeCommanderId,commanderById,commanderTitle,commanderDescription,commanderPortrait};
