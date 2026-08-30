const RACE_TAG_BY_LABEL=Object.freeze({
  'Люди':'humans',
  'Эльфы':'elves',
  'Орки':'orcs',
  'Нежить':'undead',
  'Тёмные эльфы':'dark_elves',
  'Дварфы':'dwarves',
  'Гномы':'dwarves',
  'Демоны':'demons',
  'Ангелы':'angels',
  'Драконорождённые':'dragonborn',
  'Дракониды':'dragonborn',
  'Зверолюди':'beastfolk',
  'Конструкты':'constructs',
  'Животные':'animals',
  'Феи':'fae',
  'Гоблины':'goblins',
  'Нейтральные и смешанные':'mixed',
  'Смешанные':'mixed',
  'Нейтральные':'mixed'
});

function expandEffect(code){
  const parts=String(code||'').split(':');
  if(parts[0]==='g')return Object.freeze({type:'gold',delta:Number(parts[1])||0});
  if(parts[0]==='s')return Object.freeze({type:'supplies',delta:Number(parts[1])||0});
  if(parts[0]==='r')return Object.freeze({type:'recruit'});
  if(parts[0]==='c')return Object.freeze({type:'combat',combatType:parts[1]==='b'?'battle':'skirmish',threatMod:Number(parts[2])||0});
  if(parts[0]==='w'&&parts[1]==='n')return Object.freeze({type:'wound',target:'randomNonKing'});
  if(parts[0]==='w'&&parts[1]==='k')return Object.freeze({type:'wound',target:'king'});
  if(parts[0]==='w'&&parts[1]==='r')return Object.freeze({type:'wound',target:'roleHero',role:parts[2]});
  throw new Error(`Unknown Events v4 effect code: ${code}`);
}

function choiceObject(id,action,chance,role,gold,supplies,success,failure,warnings,reaction){
  return Object.freeze({
    id,action,chance,role,
    cost:Object.freeze({gold,supplies}),
    successEffects:Object.freeze((success||[]).map(expandEffect)),
    failureEffects:Object.freeze((failure||[]).map(expandEffect)),
    kingRisk:false,
    warnings:Object.freeze(warnings||[]),
    ...(reaction?{heroReaction:Object.freeze({role:reaction[0],text:reaction[1]})}:{})
  });
}

function buildChoice(row){return choiceObject(...row);}
function buildEvent(row){
  const [id,title,race,raceTag,tone,actors,storyParagraphs,kingReaction,choices]=row;
  return Object.freeze({
    id,title,race,raceTag,tone,actors,
    storyParagraphs:Object.freeze(storyParagraphs),
    kingReaction:kingReaction||null,
    choices:Object.freeze(choices.map(buildChoice))
  });
}
function makeEvents(rows){return Object.freeze(rows.map(buildEvent));}

function raceTagForLabel(race){return RACE_TAG_BY_LABEL[race]||'mixed';}
function buildEvent3(row){
  const [id,title,race,tone,actors,storyParagraphs,kingReaction,choices]=row;
  return Object.freeze({
    id,title,race,raceTag:raceTagForLabel(race),tone,actors,
    storyParagraphs:Object.freeze(storyParagraphs),
    kingReaction:kingReaction||null,
    choices:Object.freeze(choices.map((choice,index)=>{
      const [action,chance,role,gold,supplies,success,failure,warning,reactionText]=choice;
      return choiceObject(`${id}.${index+1}`,action,chance,role,gold,supplies,success,failure,warning?[warning]:[],reactionText?[role,reactionText]:null);
    }))
  });
}
function makeEvents3(rows){return Object.freeze(rows.map(buildEvent3));}

export {makeEvents,makeEvents3};
