'use strict';

module.exports = Object.freeze({
  events:Object.freeze({}),
  directEvents:Object.freeze({
    'event.cracked_bell':Object.freeze({seed:1,path:Object.freeze(['l1_n2'])}),
    'event.miners_on_strike':Object.freeze({seed:4,path:Object.freeze(['l1_n2'])}),
    'event.duel_masons':Object.freeze({seed:4,path:Object.freeze(['l1_n3'])}),
    'event.empty_armory':Object.freeze({seed:12,path:Object.freeze(['l1_n3'])}),
    'event.disputed_standard':Object.freeze({seed:43,path:Object.freeze(['l1_n2'])})
  }),
  chainEvents:Object.freeze({
    'event.furnace_oath':Object.freeze({seed:4,chainStart:'event.miners_on_strike',startPath:Object.freeze(['l1_n2'])}),
    'event.prisoners_pass':Object.freeze({seed:45,chainStart:'event.disputed_standard',startPath:Object.freeze(['l1_n2']),followupPath:Object.freeze(['l2_n2','l3_n1','l4_n3'])})
  }),
  services:Object.freeze({
    forge:Object.freeze({seed:6,path:Object.freeze(['l1_n2']),type:'forge'}),
    camp:Object.freeze({seed:40,path:Object.freeze(['l1_n3']),type:'camp'})
  }),
  secret:Object.freeze({seed:7,path:Object.freeze(['l1_n1'])}),
  pieces:Object.freeze({
    pawn:Object.freeze({seed:11,path:Object.freeze(['l1_n1']),move:Object.freeze({from:'e2',to:'e3',promotion:null}),scenarioId:'encounter_iron_broken_formation_l1_n1',draftHeroId:'hero.mara_chain'}),
    knight:Object.freeze({seed:3,path:Object.freeze(['l1_n1']),move:Object.freeze({from:'f3',to:'d2',promotion:null}),scenarioId:'encounter_iron_forward_outpost_l1_n1',draftHeroId:'hero.vael_hammer'})
  })
});
