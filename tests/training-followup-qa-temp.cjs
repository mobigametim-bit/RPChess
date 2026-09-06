const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';
const MATRIX=[[1920,1080],[1024,768],[844,390]];

async function fresh(page){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.evaluate(key=>localStorage.removeItem(key),RUN_KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}

async function openTraining(page){
  await fresh(page);
  await startNewRun(page,{playerName:'Training geometry QA'});
  const route={id:'training.followup.qa',step:3,type:'puzzle',label:'ТРЕНИРОВКА',stars:7,threatLabel:'ОПАСНАЯ',flavor:'QA',mechanicalHint:'',seed:'training-followup-qa',difficultyModel:'power-v1',supplyCostAtSelection:1,supplyPaid:1};
  await page.evaluate(([key,route])=>{
    const run=JSON.parse(localStorage.getItem(key));
    run.supplies=Math.max(6,Number(run.supplies||0));
    run.gold=Math.max(100,Number(run.gold||0));
    run.journeyStep=route.step;
    run.currentTravelChoices=null;
    run.activeTravelChoice=route;
    localStorage.setItem(key,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
    dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:route}}));
  },[RUN_KEY,route]);
  await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
}

async function resolveTraining(page){
  await page.evaluate(key=>{
    const run=JSON.parse(localStorage.getItem(key));
    run.currentPuzzle={...run.currentPuzzle,resolved:true,result:'solved',errors:0,goldReward:15,rewardSettled:true};
    localStorage.setItem(key,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
    dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:run.activeTravelChoice}}));
  },RUN_KEY);
  await page.locator('[data-puzzle-outcome]:not([hidden])').waitFor();
  await page.waitForTimeout(180);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const [width,height] of MATRIX){
      const page=await browser.newPage({viewport:{width,height}});
      try{
        await openTraining(page);
        const conditionWidth=await page.locator('.puzzle-layout>.puzzle-panel:first-child').evaluate(node=>node.getBoundingClientRect().width);
        assert(conditionWidth>0,`${width}x${height}: condition frame must have visible width before resolve`);
        await resolveTraining(page);
        const geometry=await page.evaluate(()=>{
          const outcome=document.querySelector('[data-puzzle-outcome]')?.getBoundingClientRect();
          const gold=document.querySelector('[data-puzzle-outcome-gold]')?.getBoundingClientRect();
          const button=document.querySelector('[data-puzzle-continue]')?.getBoundingClientRect();
          const board=document.querySelector('[data-puzzle-board]')?.getBoundingClientRect();
          return {outcome:outcome&&{left:outcome.left,right:outcome.right,width:outcome.width},gold:gold&&{left:gold.left,right:gold.right,top:gold.top,bottom:gold.bottom},button:button&&{left:button.left,right:button.right,top:button.top,bottom:button.bottom},board:board&&{left:board.left}};
        });
        console.log(`[training-followup] ${width}x${height} condition=${conditionWidth} outcome=${geometry.outcome?.width} gap=${geometry.board&&geometry.outcome?geometry.board.left-geometry.outcome.right:null}`);
        assert(geometry.outcome&&geometry.gold&&geometry.button&&geometry.board,`${width}x${height}: resolved Training geometry missing`);
        assert(Math.abs(conditionWidth-geometry.outcome.width)<=2,`${width}x${height}: resolved frame width ${geometry.outcome.width} must equal condition width ${conditionWidth}`);
        assert(geometry.outcome.right<=geometry.board.left-4,`${width}x${height}: resolved frame must not touch the board`);
        assert(geometry.button.left>=geometry.gold.right-2,`${width}x${height}: Continue Journey must be right of Gold`);
        const overlap=Math.min(geometry.gold.bottom,geometry.button.bottom)-Math.max(geometry.gold.top,geometry.button.top);
        assert(overlap>0,`${width}x${height}: Gold and Continue Journey must share one row`);
      }finally{await page.close();}
    }
  }finally{await browser.close();}
  console.log('Training follow-up geometry: PASS');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});