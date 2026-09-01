const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),game=path.join(root,'game');
const source=fs.readFileSync(path.join(game,'js/travel-choice-commandbar-pass.mjs'),'utf8');
const css=fs.readFileSync(path.join(game,'css/travel-choice-commandbar-pass.css'),'utf8');
const loader=fs.readFileSync(path.join(game,'js/post-redesign-playtest-pass1b.mjs'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');

assert(loader.includes("import './travel-choice-commandbar-pass.mjs'"),'Travel command-bar pass must load with the accepted presentation layer');
assert(source.includes("import { readRun } from './run-persistence.mjs'"),'Travel command bar must read current run resources');
assert(source.includes("import { TRAVEL_SUPPLY_COST } from './resources-core.mjs'"),'Travel inline route cost must reuse the canonical Supply cost');
assert(!source.includes('writeRun')&&!source.includes('applyTravelSupplyCost'),'Travel command-bar pass must remain presentation-only');
assert(source.includes('data-travel-commandbar')&&source.includes('data-travel-inline-gold')&&source.includes('data-travel-inline-supplies'),'Travel header must expose command-bar resource presentation hooks');
assert(source.includes("generated_assets/reward_gold.png")&&source.includes("generated_assets/node_shop.png"),'Travel header and route cost must use existing Gold/Supplies assets');
assert(source.includes('`-${TRAVEL_SUPPLY_COST}`'),'Travel card cost must present the canonical cost as a negative value');
assert(css.includes('body.travel-choice-active .resource-hud')&&css.includes('display:none!important'),'fixed Resources HUD must be hidden only while Travel Choice is active');
assert(css.includes('.travel-choice-screen .travel-choice-logo')&&css.includes('display:none!important'),'Travel Choice logo must be removed visually without changing other screens');
assert(css.includes('grid-template-columns:minmax(240px,.56fr) minmax(0,2.44fr)'),'desktop Week + command bar must share one horizontal row');
assert(css.includes('.travel-choice-card__cost-amount')&&css.includes('.travel-choice-card__cost-icon'),'route cost must render compactly beside the reward row');
assert(css.includes('height:min(720px,calc(100svh - 132px))'),'desktop route cards must adapt to viewport height instead of forcing page scroll');
assert(build.includes("'css/travel-choice-commandbar-pass.css'")&&build.includes("'js/travel-choice-commandbar-pass.mjs'"),'production build must package and verify the Travel command-bar pass');

console.log('Travel Choice command bar, inline resources/cost and viewport-fit presentation contract: PASS');
