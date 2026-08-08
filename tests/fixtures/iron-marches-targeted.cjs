'use strict';

module.exports = Object.freeze({
  events:Object.freeze({
    'event.cracked_bell':Object.freeze({seed:1,path:Object.freeze(['l1_n2'])}),
    'event.prisoners_pass':Object.freeze({seed:1,path:Object.freeze(['l1_n2','l2_n1','l3_n1','l4_n1'])}),
    'event.furnace_oath':Object.freeze({seed:1,path:Object.freeze(['l1_n2','l2_n1','l3_n1','l4_n1','l5_n2','l6_n1','l7_n1','l8_n1'])}),
    'event.duel_masons':Object.freeze({seed:1,path:Object.freeze(['l1_n2','l2_n1','l3_n1','l4_n1','l5_n2','l6_n1','l7_n1','l8_n2'])}),
    'event.empty_armory':Object.freeze({seed:2,path:Object.freeze(['l1_n1','l2_n3','l3_n1','l4_n3','l5_n1'])}),
    'event.miners_on_strike':Object.freeze({seed:4,path:Object.freeze(['l1_n2'])}),
    'event.disputed_standard':Object.freeze({seed:5,path:Object.freeze(['l1_n1','l2_n1','l3_n1','l4_n2'])})
  }),
  services:Object.freeze({
    camp:Object.freeze({seed:1,path:Object.freeze(['l1_n2','l2_n1','l3_n1','l4_n1','l5_n2','l6_n1','l7_n1','l8_n3']),type:'camp'}),
    forge:Object.freeze({seed:3,path:Object.freeze(['l1_n1','l2_n1','l3_n1','l4_n2','l5_n2','l6_n1','l7_n1','l8_n1']),type:'forge'})
  }),
  secret:Object.freeze({seed:1,path:Object.freeze(['l1_n2','l2_n1','l3_n1'])}),
  pieces:Object.freeze({
    pawn:Object.freeze({seed:11,path:Object.freeze(['l1_n1']),move:Object.freeze({from:'e2',to:'e3',promotion:null}),scenarioId:'encounter_iron_broken_formation_l1_n1',draftHeroId:'hero.mara_chain'}),
    knight:Object.freeze({seed:3,path:Object.freeze(['l1_n1']),move:Object.freeze({from:'f3',to:'d2',promotion:null}),scenarioId:'encounter_iron_forward_outpost_l1_n1',draftHeroId:'hero.vael_hammer'})
  })
});
