#!/usr/bin/env node
'use strict';
// Focused PR test selection: changed code + directly coupled gameplay systems.
// CI supplies RPCHESS_BASE_SHA and full git history (checkout fetch-depth: 0).
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const groups=[
  {name:'kingdom',patterns:[/^game\/(?:js|css)\/kingdom-/i,/^game\/js\/(?:travel|resources|settlement|starvation)/i,/^game\/assets\/kingdom/i,/^tests\/kingdom-map-browser\.cjs$/],node:['travel-choice.cjs','resources.cjs','settlement.cjs','starvation.cjs'],browser:['kingdom-map-browser.cjs','travel-choice-browser.cjs','settlement-browser.cjs','starvation-browser.cjs']},
  {name:'combat',patterns:[/^game\/(?:js|css)\/(?:combat|battle|skirmish|classic-chess|chess-ai|arena|caravan|chess960|artifacts|fork-master|piercing-vision|king-pin-ice)/i,/^tests\/(?:battle|skirmish|combat|classic-chess|chess-ai|arena|caravan|artifacts|fork-master|piercing-vision|king-pin-ice)/i],node:['classic-chess-engine.cjs','skirmish.cjs','battle.cjs','combat-checkpoint.cjs','artifacts.cjs','arena.cjs'],browser:['classic-chess-browser.cjs','skirmish-browser.cjs','battle-browser.cjs','combat-resume-browser.cjs','skirmish-artifact-browser.cjs','arena-browser.cjs']},
  {name:'economy',patterns:[/^game\/js\/(?:economy|monetization|resources|settlement|starvation)/i,/^game\/js\/content\/(?:monetization|economy)/i,/^tests\/(?:resources|settlement|starvation|monetization)/],node:['resources.cjs','settlement.cjs','starvation.cjs','monetization.cjs'],browser:['resources-browser.cjs','settlement-browser.cjs','starvation-browser.cjs']},
  {name:'events',patterns:[/^game\/js\/(?:events?|content\/events?)/i,/^game\/assets\/events?/i,/^tests\/events?/],node:['events.cjs','events-v5.cjs','event-combat-race.cjs'],browser:['events-browser.cjs','travel-choice-browser.cjs']},
  {name:'puzzles',patterns:[/^game\/js\/(?:puzzles?|content\/puzzles?)/i,/^scripts\/(?:materialize-puzzle|validate-puzzle|import-lichess)/i,/^tests\/puzzles?/],node:['puzzles.cjs','puzzles-rules.cjs','puzzles-catalog.cjs'],browser:['puzzles-browser.cjs']},
  {name:'localization',patterns:[/^game\/(?:locali|lang)/i,/^game\/js\/(?:localization|i18n)/i,/^tests\/(?:localization|chronicle-localization|event-localization)/i],node:['localization-foundation.cjs','localization-owner-contract.cjs','localization-gameplay-content.cjs'],browser:['localization-ui-browser.cjs','chronicle-localization-browser.cjs']},
  {name:'mentor',patterns:[/^game\/js\/mentor/i,/^mentor-/i,/^tests\/mentor-/i],node:['mentor-training.cjs','mentor-training-feedback.cjs'],browser:['mentor-training-browser.cjs']},
  {name:'identity-pvp',patterns:[/^game\/js\/(?:tournament|profile|identity|cloud-save)/i,/^(?:profile-worker|tournament-worker)\//i,/^tests\/(?:tournament|profile|cloud-save)/i],node:['profile-worker.cjs','tournament-shadow.cjs','cloud-save.cjs'],browser:['tournament-v4-browser.cjs','cloud-continue-browser.cjs']},
  {name:'persistence',patterns:[/^game\/js\/(?:run-persistence|run-lifecycle|player-identity|cloud)/i,/^tests\/(?:run-lifecycle|cloud-continue|player-identity)/i],node:['run-lifecycle.cjs','cloud-save.cjs'],browser:['cloud-continue-browser.cjs','roster-browser.cjs']},
  {name:'ui',patterns:[/^game\/(?:css|index\.html|assets\/ui|assets\/fonts)/i,/^tests\/(?:responsive|portrait|reboot-foundation|mobile-run-summary|ui-redesign)/i],node:['ui-redesign-final.cjs','reboot-foundation.cjs'],browser:['responsive-viewport-browser.cjs','reboot-foundation-browser.cjs','portrait-key-scenes-browser.cjs']},
  {name:'assets',patterns:[/^game\/(?:assets|generated_assets)\//i,/^scripts\/(?:runtime-asset|optimize-|background-asset|piece-asset|portrait-asset|board-asset)/i,/^tests\/(?:runtime-asset|piece-asset|portrait-asset|background-asset)/i],node:['runtime-asset-cache.cjs','piece-asset-runtime.cjs','portrait-asset-runtime.cjs','background-asset-runtime.cjs'],browser:['reboot-foundation-browser.cjs']},
  {name:'platform-ads',patterns:[/^game\/js\/(?:platform|gamepush|monetization|vk-)/i,/^(?:gamepush-|yandex-|leaderboard-)/i,/^tests\/(?:monetization|gamepush|yandex-gateway)/i],node:['monetization.cjs','onboarding.cjs'],browser:['onboarding-browser.cjs','combat-menu-browser.cjs']},
  {name:'infrastructure',patterns:[/^(?:package(?:-lock)?\.json|scripts\/build\.cjs|scripts\/run-browser-tests\.cjs|scripts\/verify-source\.cjs|\.github\/workflows\/)/],node:['reboot-foundation.cjs','dependency-security.cjs'],browser:['reboot-foundation-browser.cjs']}
];
const browserRunner=fs.readFileSync(path.join(ROOT,'scripts','run-browser-tests.cjs'),'utf8');
const allowedBrowser=new Set([...browserRunner.matchAll(/'([\w-]+-browser\.cjs)'/g)].map(x=>x[1]));
function select(files){
  const node=new Set(),browser=new Set(),used=new Set(),fallback=[];
  const source=files.some(f=>/^(?:game\/|scripts\/|tests\/|package(?:-lock)?\.json|(?:profile|tournament|mentor|leaderboard|gamepush|yandex)-|\.github\/workflows\/)/.test(f));
  for(const file of files){
    const matched=groups.filter(g=>g.patterns.some(r=>r.test(file)));
    for(const g of matched){
      used.add(g.name);
      for(const t of g.node)node.add(t);
      for(const t of g.browser)browser.add(t);
    }
    if(file.startsWith('tests/')&&file.endsWith('.cjs')){
      const short=file.slice(6);
      if(short.endsWith('-browser.cjs')&&allowedBrowser.has(short))browser.add(short);
      else if(!short.endsWith('-browser.cjs')&&!/(?:helpers|preload)/.test(short))node.add(short);
    }
    if(matched.length===0&&/^(?:game\/|scripts\/|tests\/|(?:profile|tournament|mentor|leaderboard|gamepush|yandex)-)/.test(file))fallback.push(file);
  }
  if(fallback.length){
    used.add('unknown-runtime-fallback');
    node.add('reboot-foundation.cjs');
    browser.add('reboot-foundation-browser.cjs');
  }
  for(const t of node)if(!fs.existsSync(path.join(ROOT,'tests',t)))throw Error('Missing selected Node test: '+t);
  for(const t of browser)if(!allowedBrowser.has(t))throw Error('Selected Chromium test not in allowlist: '+t);
  return {changed_count:files.length,has_runtime_changes:source,groups:[...used].sort(),node_tests:[...node].sort(),browser_tests:[...browser].sort(),unmapped_runtime_files:fallback};
}
function selfTest(){
  const cases=[
    [['docs/ROADMAP.md'],[]],
    [['game/js/kingdom-map-core.mjs'],['kingdom']],
    [['game/js/mentor-training.mjs'],['mentor']],
    [['game/js/unknown-new-runtime.mjs'],['unknown-runtime-fallback']],
    [['game/css/ui.css'],['ui']],
    [['game/js/kingdom-map-core.mjs','game/js/combat.mjs'],['kingdom','combat']]
  ];
  for(const [files,want] of cases){
    const out=select(files);
    for(const x of want)if(!out.groups.includes(x))throw Error('Selector selftest failed: '+files.join(',')+' missing '+x);
    if(files[0].startsWith('docs/')&&out.has_runtime_changes)throw Error('docs-only should skip build');
  }
  console.log('PR test selector selftest: PASS ('+cases.length+' cases)');
}
if(require.main===module){
  if(process.argv.includes('--self-test')){selfTest();process.exit(0);}
  const base=process.env.RPCHESS_BASE_SHA||'origin/main';
  const mergeBase=execFileSync('git',['merge-base',base,'HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const raw=execFileSync('git',['diff','--name-only','--diff-filter=ACMR',mergeBase,'HEAD'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
  const result=select(raw?raw.split('\n').filter(Boolean):[]);
  console.log(JSON.stringify({base,merge_base:mergeBase,...result},null,2));
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,[
    'has_runtime_changes='+String(result.has_runtime_changes),
    'node_tests='+result.node_tests.join(','),
    'browser_tests='+result.browser_tests.join(','),
    'selected_groups='+result.groups.join(',')
  ].join('\n')+'\n');
}
module.exports={select};
