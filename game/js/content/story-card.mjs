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
    heading:'ЗАБЕГ ЗАВЕРШЁН',
    end:'Финал',
    callToAction:'Сумеешь лучше?',
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
    heading:'RUN COMPLETE',
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
function wrappedCentered(ctx, value, x, firstY, maxWidth, lineHeight, maxLines = 2) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.slice(0,maxLines).forEach((part,i) =>
    centered(ctx,i===maxLines-1 && lines.length>maxLines ? part+'…' : part,x,firstY+i*lineHeight,maxWidth));
}
function metric(ctx, title, value, icon, x, y, width) {
  ctx.strokeStyle = 'rgba(226,179,87,.52)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();ctx.moveTo(x,y+111);ctx.lineTo(x+width,y+111);ctx.stroke();
  if (icon) contain(ctx,icon,x+2,y+14,43,47);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe3a8';
  ctx.font = 'bold 18px Georgia,serif';
  ctx.fillText(fitText(ctx,title,width-51),x+51,y+40);
  ctx.font = 'bold 40px Georgia,serif';
  ctx.fillStyle = '#fff6dc';
  ctx.fillText(String(value ?? 0),x+51,y+88);
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
  if (!flag || !logo) throw new Error('RPChess story branding assets could not be loaded');
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

  // Keep the original royal banner visible: never cover its blue cloth with
  // synthetic panels. The text uses the same inset as endless-run.css.
  contain(ctx,flag,41,320,998,1270);
  if (globalThis.document?.fonts?.load) {
    try { await document.fonts.load('48px BrahmsGotischCyr'); } catch {}
  }

  // Separate logo above the banner: it must not crowd the gold banner rails.
  if (logo) contain(ctx,logo,145,95,790,293);
  else {
    ctx.font='bold 73px Georgia,serif';ctx.fillStyle='#ffdb8a';
    centered(ctx,'HEROES OF CHESS & MATE',540,290,920);
  }
  // The flag's fabric-safe zone is ~21% inset from both sides, 15% from top.
  // All numbers stay within that zone, above the lower golden ornament.
  ctx.shadowColor='rgba(0,5,19,.9)';
  ctx.shadowBlur=7;
  ctx.shadowOffsetY=3;
  ctx.fillStyle='#ffe1a0';
  ctx.font='48px BrahmsGotischCyr,Georgia,serif';
  centered(ctx,copy.heading,540,553,555);
  ctx.fillStyle='#fff5e1';
  ctx.font='26px Georgia,serif';
  const player = String(run?.playerName || '').trim();
  if (player) centered(ctx,player,540,594,554);
  ctx.fillStyle='#fff0d8';
  ctx.font='22px Georgia,serif';
  wrappedCentered(ctx,copy.end+': '+String(endReason||summary.endReasonLabel),
    540,player?629:612,554,27,2);
  ctx.shadowBlur=0;
  ctx.shadowOffsetY=0;

  // Four tightly paired rows + one centered caravan row, matching the game.
  const metricImages = Object.fromEntries(ORDER.map((key,index)=>[key,icons[index]]));
  for (let i=0;i<8;i++) {
    const key=ORDER[i],column=i%2,row=Math.floor(i/2);
    metric(ctx,copy.metrics[key],summary[key],metricImages[key],
      262+column*287,682+row*110,269);
  }
  metric(ctx,copy.metrics.caravansDefended,summary.caravansDefended,
    metricImages.caravansDefended,382,1122,310);

  // CTA outside the flag: below the gold tip, above the VK Stories controls.
  ctx.strokeStyle='rgba(241,199,113,.85)';
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(153,1605);ctx.lineTo(927,1605);ctx.stroke();
  ctx.fillStyle='#ffe1a2';
  ctx.font='bold 43px Georgia,serif';
  centered(ctx,copy.callToAction,540,1651,940);
  ctx.fillStyle='#ffffff';ctx.font='31px Arial,sans-serif';
  centered(ctx,copy.address,540,1711,950);

  return Object.freeze({
    dataUrl:canvas.toDataURL('image/jpeg',0.88),
    width:STORY_WIDTH,
    height:STORY_HEIGHT
  });
}
export { STORY_WIDTH, STORY_HEIGHT, renderRunStory };
