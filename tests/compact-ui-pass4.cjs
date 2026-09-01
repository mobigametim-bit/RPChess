const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),game=path.join(root,'game');
const css=fs.readFileSync(path.join(game,'css/compact-ui-pass4.css'),'utf8');
const ui=fs.readFileSync(path.join(game,'js/compact-ui-pass4.mjs'),'utf8');
const loader=fs.readFileSync(path.join(game,'js/post-redesign-playtest-pass1b.mjs'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');

assert(css.includes('width:101px!important')&&css.includes('height:101px!important'),'Settlement service icons must be reduced by about 30% from the 144px experiment');
assert(css.includes('top:-36px!important'),'Settlement service icons must sit above descriptive copy instead of overlapping it');
assert(css.includes('body.events-active [data-events-roster]')&&css.includes('body.events-active [data-events-settings]'),'Event Roster and Settings controls must be hidden visually while preserving their hooks');
assert(css.includes('height:100svh!important')&&css.includes('overflow:hidden!important'),'Desktop Event screen must fit inside one viewport');
assert(css.includes('left:0!important')&&css.includes('bottom:0!important')&&css.includes('width:min(860px,49vw)!important'),'Event literary copy must anchor to the lower-left area');
assert(css.includes('right:0!important')&&css.includes('width:min(820px,46vw)!important'),'Event choices must anchor to the lower-right area');
assert(css.includes('.events-copy-frame')&&css.includes('.events-choice-frame'),'Event copy and choices must render as separate visual frames');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'),'Event choices must render two per row on desktop');
assert(css.includes('.events-choice:last-child:nth-child(odd)')&&css.includes('grid-column:1 / -1!important'),'Odd final Event choice must span the full choice-frame width');
assert(css.includes('body.events-active .events-choice-frame{')&&css.includes('overflow:visible!important'),'Event choice frame must show every option without an internal scrollbar');
assert(css.includes('font-size:clamp(18px,1.22vw,22px)!important'),'Event literary copy must use the larger approved desktop typography');
assert(ui.includes("copyFrame.className = 'events-copy-frame'")&&ui.includes("choiceFrame.className = 'events-choice-frame'"),'Event presentation module must create separate copy and choice wrappers');
assert(ui.includes('choiceFrame.append(choices)'),'Existing runtime choice container must be reparented rather than replaced');
assert(ui.includes('choiceFrame.dataset.choiceCount = String(choiceCount)'),'Event presentation must expose option count for adaptive dense layouts');
assert(!ui.includes('writeRun')&&!ui.includes('resolveEventChoice'),'Event presentation pass must not change event resolution or persistence');
assert(loader.indexOf('ensureCss();') < loader.indexOf("import('./compact-ui-pass4.mjs')"),'Pass 4 must load after the late playtest stylesheet so its corrections win the cascade');
assert(build.includes("'css/compact-ui-pass4.css'")&&build.includes("'js/compact-ui-pass4.mjs'"),'Production build must package pass 4 CSS and JS');

console.log('Compact UI pass 4 Settlement/Event contract: PASS');
