function buildChoice(row){
  const [id,action,chance,role,gold,supplies,success,failure,warnings,reaction]=row;
  return Object.freeze({
    id,action,chance,role,
    cost:Object.freeze({gold,supplies}),
    success,failure,
    kingRisk:false,
    warnings:Object.freeze(warnings),
    ...(reaction?{heroReaction:Object.freeze({role:reaction[0],text:reaction[1]})}:{})
  });
}
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
export {makeEvents};
