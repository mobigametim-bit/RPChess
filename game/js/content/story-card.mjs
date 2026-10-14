import { summarizeRun } from '../endless-run-core.mjs';
import { brandLogoSrc } from '../brand-logo.mjs';

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const ICONS = Object.freeze({
  weeks:'generated_assets/node_story.png',
  goldEarned:'generated_assets/reward_gold.png',
  skirmishWins:'generated_assets/node_battle.png',
  battleWins:'generated_assets/node_elite.png',
  puzzlesSolved:'generated_assets/node_training.png',
  eventsResolved:'generated_assets/node_story.png',
  heroesRecruited:'generated_assets/reward_recruit.png',
  finalPower:'assets/doctrines/royal_court/emblem.png',
  caravansDefended:'assets/doctrines/cavalry/emblem.png'
});
const ORDER = Object.freeze([
  'weeks','goldEarned','skirmishWins','battleWins',
  'puzzlesSolved','eventsResolved','heroesRecruited','finalPower',
  'caravansDefended'
]);
const COPY = Object.freeze({
  ru:{
    heading:'ИТОГИ ПУТЕШЕСТВИЯ',
    subheading:'Шахматное приключение',
    end:'Финал',
    callToAction:'ПРОВЕРЬ СВОИ СИЛЫ',
    address:'vk.com/app54754579',
    metrics:{
      weeks:'НЕДЕЛЬ В ПУТИ',goldEarned:'ЗОЛОТА ДОБЫТО',
      skirmishWins:'ПОБЕД В СТЫЧКАХ',battleWins:'ПОБЕД В БИТВАХ',
      puzzlesSolved:'ЗАДАЧ РЕШЕНО',eventsResolved:'СОБЫТИЙ ПРОЙДЕНО',
      heroesRecruited:'ГЕРОЕВ НАНЯТО',finalPower:'ИТОГОВАЯ МОЩЬ',
      caravansDefended:'КАРАВАНОВ ЗАЩИЩЕНО'
    }
  },
  en:{
    heading:'JOURNEY COMPLETE',
    subheading:'A chess fantasy adventure',
    end:'The end',
    callToAction:'CAN YOU GO FURTHER?',
    address:'vk.com/app54754579',
    metrics:{
      weeks:'WEEKS TRAVELED',goldEarned:'GOLD EARNED',
      skirmishWins:'SKIRMISH WINS',battleWins:'BATTLE WINS',
      puzzlesSolved:'PUZZLES SOLVED',eventsResolved:'EVENTS RESOLVED',
      heroesRecruited:'HEROES RECRUITED',finalPower:'FINAL POWER',
      caravansDefended:'CARAVANS DEFENDED'
    }
  }
});

function loadImage(path) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = new URL(path, document.baseURI).href;
  });
}
function cover(ctx, image, x, y, width, height) {
  if (!image) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}
function contain(ctx, image, x, y, width, height) {
  if (!image) return;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}
function rounded(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width/2, height/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+width-r,y);ctx.quadraticCurveTo(x+width,y,x+width,y+r);
  ctx.lineTo(x+width,y+height-r);ctx.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  ctx.lineTo(x+r,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function fitText(ctx, value, maxWidth) {
  let text = String(value || '');
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length && ctx.measureText(text + '…').width > maxWidth) text = text.slice(0,-1);
  return text + '…';
}
function centered(ctx, value, x, y, maxWidth) {
  ctx.textAlign = 'center';
  ctx.fillText(fitText(ctx,value,maxWidth),x,y);
}
function metric(ctx, title, value, icon, x, y, width) {
  ctx.strokeStyle = 'rgba(234,186,104,.48)';
  ctx.lineWidth = 2;
  ctx.beginPath();ctx.moveTo(x,y+118);ctx.lineTo(x+width,y+118);ctx.stroke();
  if (icon) contain(ctx,icon,x,y+6,66,70);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f1d49a';
  ctx.font = 'bold 23px Georgia,serif';
  ctx.fillText(fitText(ctx,title,width-76),x+76,y+35);
  ctx.font = 'bold 51px Georgia,serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(value ?? 0),x+76,y+95);
}

/**
 * Generates a 1080×1920 story locally, using the existing RPChess art.
 * No uploads, no storage writes and no dependency on the VK host.
 */
async function renderRunStory(run, { power = 0, language = 'ru', endReason = '' } = {}) {
  const copy = COPY[language === 'en' ? 'en' : 'ru'];
  const summary = summarizeRun(run, { power });
  const paths = [
    'generated_assets/scene_defeat.jpg',
    'assets/ui/royal_run_flag.png',
    brandLogoSrc(language),
    ...ORDER.map(key => ICONS[key])
  ];
  const images = await Promise.all(paths.map(loadImage));
  const [backdrop,flag,logo,...icons] = images;
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH; canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha:false });
  if (!ctx) throw new Error('Canvas 2D is unavailable');

  ctx.fillStyle = '#050b17';
  ctx.fillRect(0,0,STORY_WIDTH,STORY_HEIGHT);
  cover(ctx,backdrop,0,0,STORY_WIDTH,STORY_HEIGHT);
  const shade = ctx.createLinearGradient(0,0,0,STORY_HEIGHT);
  shade.addColorStop(0,'rgba(3,7,17,.72)');
  shade.addColorStop(.5,'rgba(3,7,17,.86)');
  shade.addColorStop(1,'rgba(3,7,17,.94)');
  ctx.fillStyle=shade;ctx.fillRect(0,0,STORY_WIDTH,STORY_HEIGHT);

  ctx.save();ctx.globalAlpha=.80;
  contain(ctx,flag,43,440,994,1258);
  ctx.restore();
  const cloth = ctx.createLinearGradient(0,580,0,1720);
  cloth.addColorStop(0,'rgba(11,49,102,.92)');
  cloth.addColorStop(.5,'rgba(8,46,109,.94)');
  cloth.addColorStop(1,'rgba(4,26,70,.94)');
  ctx.fillStyle=cloth;rounded(ctx,143,554,794,1112,24);ctx.fill();
  ctx.lineWidth=5;ctx.strokeStyle='#c79c52';ctx.stroke();
  ctx.lineWidth=1;ctx.strokeStyle='rgba(255,221,146,.7)';
  rounded(ctx,155,566,770,1088,18);ctx.stroke();

  if (logo) contain(ctx,logo,140,80,800,360);
  else {ctx.font='bold 78px Georgia,serif';ctx.fillStyle='#f9d88e';centered(ctx,'HEROES OF CHESS & MATE',540,290,900);}
  ctx.fillStyle='#edd09c';ctx.font='32px Georgia,serif';
  centered(ctx,copy.subheading,540,463,820);

  ctx.fillStyle='#ffdc91';ctx.font='bold 51px Georgia,serif';
  centered(ctx,copy.heading,540,643,736);
  ctx.fillStyle='#f6ead2';ctx.font='30px Georgia,serif';
  const player = String(run?.playerName || '').trim();
  centered(ctx,player,540,697,730);
  ctx.fillStyle='#d7dff1';ctx.font='25px Georgia,serif';
  centered(ctx,copy.end+': '+String(endReason||summary.endReasonLabel),540,749,718);

  const metricImages = Object.fromEntries(ORDER.map((key,index)=>[key,icons[index]]));
  for (let i=0;i<8;i++) {
    const key=ORDER[i],column=i%2,row=Math.floor(i/2);
    metric(ctx,copy.metrics[key],summary[key],metricImages[key],193+column*374,808+row*173,324);
  }
  metric(ctx,copy.metrics.caravansDefended,summary.caravansDefended,metricImages.caravansDefended,375,1500,344);

  ctx.strokeStyle='rgba(241,199,113,.85)';
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(170,1754);ctx.lineTo(910,1754);ctx.stroke();
  ctx.fillStyle='#ffe1a2';ctx.font='bold 44px Georgia,serif';
  centered(ctx,copy.callToAction,540,1825,940);
  ctx.fillStyle='#ffffff';ctx.font='31px Arial,sans-serif';
  centered(ctx,copy.address,540,1881,950);

  return Object.freeze({
    dataUrl:canvas.toDataURL('image/jpeg',0.88),
    width:STORY_WIDTH,
    height:STORY_HEIGHT
  });
}
export { STORY_WIDTH, STORY_HEIGHT, renderRunStory };
