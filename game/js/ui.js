/* DOM and Canvas presentation. */
window.NC_UI = (() => {
  'use strict';
  const D=window.NC_DATA, NC=window.NC;

  class AudioManager {
    constructor(game){this.game=game;this.ctx=null;}
    ensure(){if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(C)this.ctx=new C();}if(this.ctx?.state==='suspended')this.ctx.resume();}
    tone(freq=440,duration=.07,type='sine',gain=.08){
      if((this.game.profile.settings.masterVolume??.5)<=0)return;
      this.ensure();if(!this.ctx)return;
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;
      o.type=type;o.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(gain*this.game.profile.settings.masterVolume,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
      o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+duration);
    }
    sweep(from=220,to=880,duration=.18,type='sine',gain=.055){
      if((this.game.profile.settings.masterVolume??.5)<=0)return;this.ensure();if(!this.ctx)return;
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;o.type=type;o.frequency.setValueAtTime(from,now);o.frequency.exponentialRampToValueAtTime(Math.max(1,to),now+duration);g.gain.setValueAtTime(gain*this.game.profile.settings.masterVolume,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+duration);
    }
    click(){this.tone(520,.045,'square',.035);} move(){this.tone(270,.06,'triangle',.045);} capture(){this.tone(120,.15,'sawtooth',.07);} win(){this.tone(620,.12,'sine',.06);setTimeout(()=>this.tone(930,.18,'sine',.06),100);} battleVictory(){this.tone(392,.18,'triangle',.055);setTimeout(()=>this.tone(523.25,.2,'triangle',.06),140);setTimeout(()=>this.tone(659.25,.22,'sine',.07),280);setTimeout(()=>{this.tone(783.99,.38,'sine',.075);this.tone(523.25,.38,'triangle',.04);},430);} error(){this.tone(90,.12,'square',.04);}
    shield(){this.sweep(980,360,.2,'sine',.045);setTimeout(()=>this.tone(720,.08,'triangle',.035),55);} ability(){this.sweep(180,980,.22,'triangle',.05);} phase(){this.sweep(120,520,.28,'sawtooth',.035);} danger(){this.tone(92,.18,'sawtooth',.045);setTimeout(()=>this.tone(138,.16,'square',.03),90);} spawn(){this.sweep(260,700,.16,'sine',.035);} defeat(){this.sweep(320,70,.45,'sawtooth',.05);} playWinFanfare(){const v=Math.max(0,Math.min(1,Number(this.game.profile.settings.masterVolume??.55)));if(v<=0)return;if(!this.winFanfare){this.winFanfare=new Audio('SFX/win_fanfare.mp3');this.winFanfare.preload='auto';}this.winFanfare.volume=v;try{this.winFanfare.pause();this.winFanfare.currentTime=0;}catch(e){}const p=this.winFanfare.play();if(p&&typeof p.catch==='function')p.catch(()=>{});}
  }


  class MusicManager {
    constructor(game){
      this.game=game;
      this.tracks=[
        'music/echoes_iron_throne_01.mp3',
        'music/echoes_iron_throne_02.mp3',
        'music/echoes_iron_throne_03.mp3',
        'music/echoes_iron_throne_04.mp3'
      ];
      this.index=Math.floor(Math.random()*this.tracks.length);
      this.audio=new Audio();
      this.audio.preload='metadata';
      this.audio.loop=false;
      this.audio.addEventListener('ended',()=>this.next());
      this.audio.addEventListener('error',()=>setTimeout(()=>this.next(),500));
      this.activated=false;
      this.started=false;
      this.loadCurrent();
      this.updateVolume();
    }
    effectiveVolume(){
      const s=this.game.profile.settings||{};
      const master=Math.max(0,Math.min(1,Number(s.masterVolume??.55)));
      const music=Math.max(0,Math.min(1,Number(s.musicVolume??.42)));
      return master*music;
    }
    loadCurrent(){this.audio.src=this.tracks[this.index];this.audio.load();}
    ensure(){
      this.activated=true;
      this.updateVolume();
      if(this.effectiveVolume()>0&&this.audio.paused)this.play();
    }
    play(){
      const p=this.audio.play();
      if(p&&typeof p.then==='function')p.then(()=>{this.started=true;}).catch(()=>{});
    }
    next(){
      this.index=(this.index+1)%this.tracks.length;
      this.loadCurrent();
      if(this.activated&&this.effectiveVolume()>0)this.play();
    }
    updateVolume(){
      const v=this.effectiveVolume();
      this.audio.volume=v;
      this.audio.muted=v<=0;
      if(this.activated&&v>0&&this.audio.paused)this.play();
      if(v<=0&&!this.audio.paused)this.audio.pause();
    }
  }

  class UI {
    constructor(game,root){
      this.game=game;this.root=root;this.view='menu';this.selectedCommander='warlord';this.difficulty='normal';this.permadeath=false;this.heroName='';this.seed=String(game.profile.settings.worldSeed||'');
      this.selectedUid=null;this.hoverCell=null;this.keyboardCell={x:2,y:5};this.audio=new AudioManager(game);this.music=new MusicManager(game);this.shopStock=null;this.images={};
      this.boardFx=null;this.boardFxFrame=0;this.lastBattleSnapshot=null;this.pendingFxHint=null;this.lastScreenType=null;this.preloadArt();
      this.game.onChange((event)=>{
        if(event==='achievement'){this.showAchievement();return;}
        const fx=this.diffBattle(this.lastBattleSnapshot,this.snapshotBattle(),event);
        this.lastBattleSnapshot=this.snapshotBattle();this.playFxAudio(fx,event);
        this.applySettings();this.render(true,fx);
      });
      this.applySettings();this.lastBattleSnapshot=this.snapshotBattle();this.render(true);this.bindGlobal();
    }
    lang(){return this.game.language();} t(ru,en){return this.lang()==='en'?en:ru;}
    applySettings(){
      const s=this.game.profile.settings;document.documentElement.style.setProperty('--scale',String(s.uiScale||1));document.body.classList.toggle('colorblind',!!s.colorblind);document.body.classList.toggle('reduce-motion',!!s.reduceMotion);this.music?.updateVolume();
    }
    bindGlobal(){
      const activateAudio=()=>{this.audio.ensure();this.music.ensure();};document.addEventListener('pointerdown',activateAudio,{once:true});document.addEventListener('keydown',activateAudio,{once:true});
      document.addEventListener('keydown',e=>{
        const type=this.screenType();if(type!=='battle'){if(e.key==='Escape'&&['settings','achievements','codex','new_run'].includes(type)){e.preventDefault();this.view=this.game.run?'auto':'menu';this.render();}return;}
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape',' '].includes(e.key))e.preventDefault();
        if(e.key==='ArrowUp')this.keyboardCell.y=Math.max(0,this.keyboardCell.y-1);
        if(e.key==='ArrowDown')this.keyboardCell.y=Math.min(5,this.keyboardCell.y+1);
        if(e.key==='ArrowLeft')this.keyboardCell.x=Math.max(0,this.keyboardCell.x-1);
        if(e.key==='ArrowRight')this.keyboardCell.x=Math.min(5,this.keyboardCell.x+1);
        if(e.key==='Enter'||e.key===' ')this.handleBoardCell(this.keyboardCell.x,this.keyboardCell.y);
        if(e.key==='Escape'){this.selectedUid=null;this.game.cancelTargeting();}
        this.drawBoard();
      });
      const input=document.getElementById('save-import');input.addEventListener('change',async()=>{const f=input.files?.[0];if(!f)return;try{this.game.profile=NC.Storage.import(await f.text());this.game.run=this.game.profile.currentRun;this.game.battle=null;this.view='menu';this.render();this.toast(this.t('Сохранение импортировано','Save imported'));}catch(e){this.toast(this.t('Не удалось импортировать сохранение','Could not import save'));}input.value='';});
    }

    screenType(){
      if(this.view==='settings'||this.view==='achievements'||this.view==='codex'||this.view==='new_run')return this.view;
      const r=this.game.run,b=this.game.battle;
      if(!r)return 'menu';if(r.completed)return 'run_complete';
      if(b){if(b.status==='active')return'battle';if(b.status==='won'&&r.pendingRewards)return'reward';if(b.status==='lost')return'defeat';}
      if(r.currentNode){return r.currentNode.type;}
      return 'campaign';
    }
    render(animate=true,fx=null){
      const type=this.screenType();
      const r=this.game.run;
      const fanfareKey=type==='reward'?`reward:${r?.seed||''}:${r?.act||0}:${r?.step||0}:${r?.stats?.battles||0}`:(type==='run_complete'&&r?.act>3?`victory:${r?.seed||''}:${r?.stats?.battles||0}`:null);
      if(fanfareKey&&fanfareKey!==this.lastFanfareKey){this.lastFanfareKey=fanfareKey;setTimeout(()=>this.audio.playWinFanfare(),80);}
      const map={menu:()=>this.menu(),new_run:()=>this.newRun(),settings:()=>this.settings(),achievements:()=>this.achievements(),codex:()=>this.codex(),campaign:()=>this.campaign(),battle:()=>this.battle(),reward:()=>this.reward(),defeat:()=>this.defeat(),event:()=>this.event(),shop:()=>this.shop(),repair:()=>this.repair(),training:()=>this.training(),vault:()=>this.vault(),bargain:()=>this.bargain(),run_complete:()=>this.runComplete()};
      this.root.innerHTML=map[type]?map[type]():this.menu();
      const screen=this.root.querySelector('.screen');if(screen&&!animate)screen.classList.add('no-enter');
      if(screen)screen.dataset.screen=type;
      this.bindScreen(type);this.applyDisplayFont();this.focusInitial();
      if(type==='battle')requestAnimationFrame(()=>{this.drawBoard();if(fx)this.startBoardFx(fx);});
      else this.stopBoardFx();
      this.lastScreenType=type;
    }

    shell(content,top=true){return `<main class="screen fantasy-screen"><div class="shell">${top?this.topbar():''}${content}<div class="footer-note">RPChess — Fantasy Edition 1.3.3 • ${this.t('автосохранение включено','autosave enabled')}</div></div></main>`;}
    topbar(){const p=this.game.profile,r=this.game.run;return `<header class="topbar"><div class="brand fantasy-brand"><img src="${this.asset('logo_main.png')}" alt=""><strong>RPChess</strong></div><div class="spacer"></div>${r?`<div class="chip chip-progress">${this.t('ГЛАВА','ACT')} ${r.act} • ${this.t('ПУТЬ','STEP')} ${r.step}/${r.maxSteps}</div><div class="chip gold-chip">● ${r.credits}</div>`:''}<div class="chip essence-chip">✧ ${p.metaFragments}</div><button class="btn ghost icon-btn" data-action="settings" aria-label="${this.t('Настройки','Settings')}">⚙</button></header>`;}
    asset(file){return `generated_assets/${file}`;}
    commanderArt(id){const map={aggressor:'aggressor'};return this.asset(`commander_${map[id]||id}.png`);}
    unitArt(type,team='player'){const map={process:'pawn',injector:'knight',scanner:'bishop',bastion:'rook',battle_ai:'queen',core:'king',machine_king:'boss_king',shield_node:'arcane_node'};if(type==='machine_king'||type==='shield_node')team='enemy';return this.asset(`unit_${map[type]||type}_${team}.png`);}
    unitVisualTuning(type,team='player'){const map={process:{scale:.82,offsetX:0,offsetY:.01},injector:{scale:.9,offsetX:0,offsetY:.005},scanner:{scale:.9,offsetX:0,offsetY:.005},bastion:{scale:.87,offsetX:0,offsetY:.01},battle_ai:{scale:.94,offsetX:0,offsetY:0},core:{scale:.92,offsetX:0,offsetY:0},machine_king:{scale:.98,offsetX:0,offsetY:0},shield_node:{scale:.86,offsetX:0,offsetY:.01}};return map[type]||{scale:.9,offsetX:0,offsetY:0};}
    unitFrameTuning(type){const map={process:{w:.60,h:.76,r:16},injector:{w:.72,h:.78,r:18},scanner:{w:.70,h:.82,r:18},bastion:{w:.66,h:.80,r:16},battle_ai:{w:.74,h:.86,r:20},core:{w:.72,h:.86,r:20},machine_king:{w:.94,h:.9,r:24},shield_node:{w:.72,h:.78,r:18}};return map[type]||{w:.70,h:.80,r:18};}
    nodeArt(type){const map={bargain:'bargain'};return this.asset(`node_${map[type]||type}.png`);}
    rewardArt(kind){const map={credits:'gold',artifact:'artifact',recruit:'recruit',upgrade:'upgrade',unit:'recruit',heal:'heal',meta:'meta',experience:'experience'};return this.asset(`reward_${map[kind]||kind}.png`);}
    sceneArt(kind){return this.asset(`scene_${kind}.jpg`);}
    sceneHeader(kind,eyebrow,title,subtitle='',extraClass=''){return `<div class="scene-header ${extraClass}"><div class="scene-header-copy"><div class="eyebrow">${eyebrow}</div><h2 class="section-title">${title}</h2>${subtitle?`<p class="section-subtitle">${subtitle}</p>`:''}</div><div class="scene-header-art"><img src="${this.sceneArt(kind)}" alt="" loading="eager"></div></div>`;}
    eventArt(id){return this.sceneArt('event');}
    shopArt(it){if(it.type==='artifact')return this.rewardArt('artifact');if(it.type==='heal')return this.rewardArt('heal');if(it.type==='recruit')return this.unitArt(it.unitType);return this.rewardArt('upgrade');}
    achievementArt(id){if(['first_blood','boss_one','run_win','flawless','survivor'].includes(id))return this.nodeArt('battle');if(['veteran','promotion','ability_master'].includes(id))return this.rewardArt('experience');if(['collector','shopper','rich'].includes(id))return this.rewardArt('artifact');if(['all_commanders','hard_win','iron_win'].includes(id))return this.rewardArt('meta');if(['event_horizon','secret_node'].includes(id))return this.nodeArt('event');return this.rewardArt('upgrade');}
    codexArt(id){if(id==='machine_king')return this.unitArt('machine_king','enemy');if(id==='process')return this.unitArt('process');if(id==='mirror_core')return this.sceneArt('event');if(id==='zero_channel')return this.nodeArt('story');return this.sceneArt('codex');}
    shortText(s,max=96){if(!s)return'';const clean=String(s).replace(/\s+/g,' ').trim();if(clean.length<=max)return clean;const cut=clean.slice(0,max-1);const i=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf(' '));return (i>max*0.55?cut.slice(0,i):cut).trim()+'…';}
    escapeAttr(v){return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    safeText(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
    isFirstLaunch(){return (this.game.profile.runs||0)===0&&(this.game.profile.victories||0)===0;}
    selectedCommanderData(){return D.commanders.find(c=>c.id===this.selectedCommander)||D.commanders[0];}
    difficultyLabel(){return this.difficulty==='hard'?this.t('Высокая','Hard'):this.t('Нормальная','Normal');}
    runProgressText(r){if(!r)return'';return this.t(`Акт ${r.act} • шаг ${r.step}/${r.maxSteps}`,`Act ${r.act} • step ${r.step}/${r.maxSteps}`);}
    focusInitial(){requestAnimationFrame(()=>{const el=this.root.querySelector('[data-autofocus]:not(:disabled)');if(el&&document.activeElement===document.body)el.focus({preventScroll:true});});}
    applyDisplayFont(){}
    preloadArt(){const player=['process','injector','scanner','bastion','battle_ai','core'];const enemy=['process','injector','scanner','bastion','battle_ai','core','machine_king','shield_node'];for(const t of player)this.loadImage(this.unitArt(t,'player'));for(const t of enemy)this.loadImage(this.unitArt(t,'enemy'));}
    loadImage(src){if(this.images[src])return this.images[src];const img=new Image();img.decoding='async';img.onload=()=>this.prepareImageMeta(img);img.src=src;this.images[src]=img;return img;}
    prepareImageMeta(img){try{if(img._ncMeta||!img.naturalWidth||!img.naturalHeight)return img._ncMeta;const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;const pts=[[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1],[Math.floor(c.width/2),0],[0,Math.floor(c.height/2)],[c.width-1,Math.floor(c.height/2)],[Math.floor(c.width/2),c.height-1]];let br=0,bg=0,bb=0,ba=0;for(const [px,py] of pts){const i=(py*c.width+px)*4;br+=d[i];bg+=d[i+1];bb+=d[i+2];ba+=d[i+3];}br/=pts.length;bg/=pts.length;bb/=pts.length;ba/=pts.length;const bgLum=.2126*br+.7152*bg+.0722*bb;let minX=c.width,minY=c.height,maxX=0,maxY=0,found=false,sumX=0,sumY=0,sumW=0;for(let py=0;py<c.height;py++){for(let px=0;px<c.width;px++){const i=(py*c.width+px)*4,a=d[i+3];if(a<10)continue;const r=d[i],g=d[i+1],b=d[i+2],dr=r-br,dg=g-bg,db=b-bb;const dist=Math.sqrt(dr*dr+dg*dg+db*db);const lum=.2126*r+.7152*g+.0722*b;const bright=Math.max(0,lum-bgLum);if(dist>34||bright>18){found=true;if(px<minX)minX=px;if(py<minY)minY=py;if(px>maxX)maxX=px;if(py>maxY)maxY=py;const w=(dist+bright+1);sumX+=px*w;sumY+=py*w;sumW+=w;}}}if(!found){img._ncMeta={sx:0,sy:0,sw:c.width,sh:c.height,cx:c.width/2,cy:c.height/2};return img._ncMeta;}const padX=Math.max(8,Math.round((maxX-minX+1)*0.12));const padY=Math.max(8,Math.round((maxY-minY+1)*0.12));minX=Math.max(0,minX-padX);minY=Math.max(0,minY-padY);maxX=Math.min(c.width-1,maxX+padX);maxY=Math.min(c.height-1,maxY+padY);img._ncMeta={sx:minX,sy:minY,sw:maxX-minX+1,sh:maxY-minY+1,cx:sumW?sumX/sumW:(minX+maxX)/2,cy:sumW?sumY/sumW:(minY+maxY)/2};return img._ncMeta;}catch(e){img._ncMeta={sx:0,sy:0,sw:img.naturalWidth||1,sh:img.naturalHeight||1,cx:(img.naturalWidth||1)/2,cy:(img.naturalHeight||1)/2};return img._ncMeta;}}
    snapshotBattle(){
      const b=this.game.battle;if(!b)return null;
      const units={};for(const u of b.units||[])units[u.uid]={uid:u.uid,type:u.type,team:u.team,name:u.name,x:u.x,y:u.y,alive:!!u.alive,shield:u.shield||0,acted:!!u.acted,phases:u.phases||0,statuses:(u.statuses||[]).map(s=>`${s.id}:${s.turns}`).sort()};
      return {units,phase:b.phase,round:b.round,status:b.status,cp:b.cp,telegraphs:(b.telegraphs||[]).map(t=>`${t.axis}:${t.index}`).sort(),hazards:(b.hazards||[]).map(h=>`${h.x}:${h.y}:${h.type}`).sort()};
    }
    diffBattle(prev,next,event='state'){
      if(!next)return null;
      const fx={event,moves:[],deaths:[],spawns:[],shieldHits:[],shieldGains:[],statusAdds:[],telegraphs:[],texts:[],phaseChanged:false,roundChanged:false,battleWon:false,hint:this.pendingFxHint};
      if(!prev){for(const u of Object.values(next.units).filter(u=>u.alive))fx.spawns.push(u);fx.phaseChanged=true;return fx;}fx.battleWon=prev.status==='active'&&next.status==='won';
      for(const u of Object.values(next.units)){
        const old=prev.units[u.uid];
        if(u.alive&&(!old||!old.alive))fx.spawns.push(u);
        if(old&&old.alive&&u.alive&&(old.x!==u.x||old.y!==u.y))fx.moves.push({uid:u.uid,from:{x:old.x,y:old.y},to:{x:u.x,y:u.y},unit:u});
        if(old&&u.alive&&u.shield<old.shield)fx.shieldHits.push(u);
        if(old&&u.alive&&u.shield>old.shield)fx.shieldGains.push(u);
        if(old&&u.alive){const before=new Set(old.statuses.map(s=>s.split(':')[0]));for(const s of u.statuses){const id=s.split(':')[0];if(!before.has(id))fx.statusAdds.push({unit:u,id});}if(u.type==='machine_king'&&u.phases<old.phases)fx.texts.push({x:u.x,y:u.y,text:this.t(`ФАЗА ${u.phases}` ,`PHASE ${u.phases}`),color:'#f2d783',size:1.0});}
      }
      for(const old of Object.values(prev.units)){const now=next.units[old.uid];if(old.alive&&(!now||!now.alive)){fx.deaths.push(old);fx.texts.push({x:old.x,y:old.y,text:this.t('УНИЧТОЖЕН','DESTROYED'),color:old.team==='player'?'#8fd3ff':'#f1a8e4',size:1.0});}}
      const oldT=new Set(prev.telegraphs||[]);for(const t of next.telegraphs||[])if(!oldT.has(t)){const [axis,index]=t.split(':');fx.telegraphs.push({axis,index:+index});}
      fx.phaseChanged=prev.phase!==next.phase;fx.roundChanged=prev.round!==next.round;
      return fx;
    }
    startBoardFx(fx){
      this.pendingFxHint=null;if(!fx||this.game.profile.settings.reduceMotion){this.drawBoard();return;}
      const meaningful=fx.moves.length||fx.deaths.length||fx.spawns.length||fx.shieldHits.length||fx.shieldGains.length||fx.statusAdds.length||fx.telegraphs.length||(fx.texts&&fx.texts.length)||fx.phaseChanged||fx.hint;
      if(!meaningful)return;
      const sequential=fx.moves.length>1;
      const moveSegmentDuration=sequential?340:620;
      const movePhaseDuration=sequential?moveSegmentDuration*fx.moves.length:moveSegmentDuration;
      const postDuration=(fx.texts&&fx.texts.length)?680:(fx.deaths.length?240:0);
      const duration=Math.max(movePhaseDuration+postDuration, (fx.deaths.length?760:620), (fx.texts&&fx.texts.length?1280:0));
      this.stopBoardFx();this.boardFx={...fx,start:performance.now(),duration,sequential,moveSegmentDuration,movePhaseDuration};
      const wrap=document.querySelector('.board-wrap');if(wrap&&fx.deaths.length){wrap.classList.add('fx-shake');setTimeout(()=>wrap.classList.remove('fx-shake'),360);}
      const loop=(now)=>{if(!this.boardFx)return;this.drawBoard(now);if(now-this.boardFx.start<this.boardFx.duration)this.boardFxFrame=requestAnimationFrame(loop);else{this.boardFx=null;this.boardFxFrame=0;this.drawBoard();}};
      this.boardFxFrame=requestAnimationFrame(loop);
    }
    stopBoardFx(){if(this.boardFxFrame)cancelAnimationFrame(this.boardFxFrame);this.boardFxFrame=0;this.boardFx=null;}
    easeOutCubic(t){return 1-Math.pow(1-Math.max(0,Math.min(1,t)),3);}
    playFxAudio(fx,event){if(!fx)return;if(fx.battleWon)return;if(fx.deaths.length)this.audio.capture();else if(fx.shieldHits.length)this.audio.shield();else if(fx.hint)this.audio.ability();else if(fx.telegraphs.length)this.audio.danger();else if(fx.spawns.length&&event!=='battle_started')this.audio.spawn();else if(fx.phaseChanged)this.audio.phase();}

    menu(){const p=this.game.profile,has=!!p.currentRun&&!p.currentRun.completed,r=p.currentRun,first=this.isFirstLaunch();return this.shell(`<section class="hero hero--art menu-hero panel"><div class="hero-art" style="background-image:url('${this.asset('splash_poster.jpg')}')"></div><div class="menu-overlay"></div><div class="hero-content menu-content"><div class="menu-main"><div class="eyebrow">${this.t('ФЭНТЕЗИЙНЫЕ ТАКТИЧЕСКИЕ ШАХМАТЫ','FANTASY TACTICAL CHESS')}</div><img class="title-wordmark" src="${this.asset('title_wordmark.png')}" alt="RPChess"><h1 class="visually-hidden">RPChess</h1><p class="lead">${this.t('Соберите королевскую армию, выбирайте путь через зачарованные земли и победите Тёмного короля.','Build a royal army, choose a path through enchanted lands, and defeat the Dark King.')}</p><div class="primary-actions">${has?`<button class="btn primary btn-hero" data-action="continue" data-autofocus><span>${this.t('ПРОДОЛЖИТЬ ПОХОД','CONTINUE RUN')}</span><small>${this.runProgressText(r)} • ● ${r.credits}</small></button>`:`<button class="btn primary btn-hero" data-action="new_run" data-autofocus><span>${this.t('НАЧАТЬ НОВЫЙ ПОХОД','START NEW RUN')}</span><small>${this.t('Нормальная сложность рекомендуется для первой партии','Normal difficulty is recommended for your first run')}</small></button>`}${has?`<button class="btn" data-action="new_run">${this.t('НОВЫЙ ПОХОД','NEW RUN')}</button>`:''}</div><div class="menu-secondary"><button class="btn ghost" data-action="achievements">${this.t('ДОСТИЖЕНИЯ','ACHIEVEMENTS')} <span>${p.achievements.length}/20</span></button><button class="btn ghost" data-action="codex">${this.t('ЛЕТОПИСЬ','CHRONICLE')}</button><button class="btn ghost" data-action="settings">${this.t('НАСТРОЙКИ','SETTINGS')}</button></div><details class="data-tools"><summary>${this.t('Сохранения','Saves')}</summary><div class="btn-row compact-actions"><button class="btn" data-action="export_save">${this.t('ЭКСПОРТ','EXPORT')}</button><button class="btn" data-action="import_save">${this.t('ИМПОРТ','IMPORT')}</button></div></details></div><aside class="menu-status"><div class="status-kicker">${first?this.t('КАК НАЧАТЬ','HOW TO PLAY'):this.t('ЛЕТОПИСЬ ПОЛКОВОДЦА','COMMANDER RECORD')}</div>${first?`<div class="onboarding-steps"><div><strong>1</strong><span>${this.t('Выберите героя','Choose a commander')}</span></div><div><strong>2</strong><span>${this.t('Выберите путь','Choose a route')}</span></div><div><strong>3</strong><span>${this.t('Двигайте фигуры и берите врагов','Move pieces and capture enemies')}</span></div></div><p class="section-subtitle">${this.t('Все допустимые ходы и угрозы показаны заранее.','All legal moves and threats are shown in advance.')}</p>`:`<div class="profile-stats"><div><span>${this.t('Победы','Wins')}</span><strong>${p.victories}</strong></div><div><span>${this.t('Лучшая глава','Best act')}</span><strong>${p.bestAct}</strong></div><div><span>${this.t('Эссенция','Essence')}</span><strong>✧ ${p.metaFragments}</strong></div></div>${has?`<div class="active-run-card"><span>${this.t('Текущий поход','Active run')}</span><strong>${this.runProgressText(r)}</strong><small>${this.t('Прогресс сохранён автоматически','Progress autosaved')}</small></div>`:''}`}</aside></div></section>`,false);}
    newRun(){const p=this.game.profile,c=this.selectedCommanderData(),hasActive=!!p.currentRun&&!p.currentRun.completed,displayName=String(this.heroName||'').trim()||this.t('Безымянный герой','Nameless Hero');return this.shell(`<section class="content-panel panel new-run-screen"><div class="screen-header"><div><div class="eyebrow">${this.t('НОВЫЙ ПОХОД','NEW RUN')}</div><h2 class="section-title">${this.t('СОБЕРИТЕ КОРОЛЕВСКУЮ АРМИЮ','ASSEMBLE THE ROYAL ARMY')}</h2><p class="section-subtitle">${this.t('Выберите полководца, назовите героя и начните путь.','Choose a commander, name your hero, and begin the journey.')}</p></div><div class="setup-steps"><span class="active">1 ${this.t('Герой','Hero')}</span><span>2 ${this.t('Правила','Rules')}</span><span>3 ${this.t('В путь','Begin')}</span></div></div>${hasActive?`<div class="warning-strip"><strong>${this.t('Текущий поход сохранён.','Your current run is saved.')}</strong><span>${this.t('Он будет заменён только после подтверждения.','It will only be replaced after confirmation.')}</span></div>`:''}<div class="new-run-layout"><div><div class="grid commander-grid">${D.commanders.map(cmd=>{const unlocked=p.unlockedCommanders.includes(cmd.id),sel=this.selectedCommander===cmd.id;return `<button class="card commander-card ${sel?'selected':''}" data-commander="${cmd.id}" ${unlocked?'':'disabled'} aria-pressed="${sel}"><div class="commander-art" style="background-image:url('${this.commanderArt(cmd.id)}')"></div><div class="commander-card-copy"><h3>${this.lang()==='en'?cmd.nameEn:cmd.nameRu}</h3><p class="compact-copy">${this.shortText(this.lang()==='en'?cmd.passiveEn:cmd.passiveRu,92)}</p><div class="tag-cloud">${cmd.squad.map(t=>`<span class="tag">${NC.unitName(t,this.lang())}</span>`).join('')}</div>${unlocked?'':`<div class="lock-note">🔒 ${this.t(`Побед для открытия: ${cmd.unlock}`,`Wins to unlock: ${cmd.unlock}`)}</div>`}</div></button>`;}).join('')}</div></div><aside class="launch-panel panel"><div class="launch-portrait" style="background-image:url('${this.commanderArt(c.id)}')"></div><label class="field hero-name-field"><span>${this.t('Имя героя:','Hero name:')}</span><input id="hero_name" type="text" maxlength="28" autocomplete="off" placeholder="${this.t('Введите имя','Enter a name')}" value="${this.safeText(this.heroName||'')}"></label><div class="hero-identity"><div class="hero-name-display">${this.safeText(displayName)}</div><div class="hero-class-label">${this.t('Класс','Class')}</div><h3 class="hero-class-name">${this.lang()==='en'?c.nameEn:c.nameRu}</h3></div><p class="section-subtitle compact-copy">${this.shortText(this.lang()==='en'?c.passiveEn:c.passiveRu,120)}</p><div class="launch-squad">${c.squad.map(t=>`<div><span class="roster-icon art-icon" style="background-image:url('${this.unitArt(t)}')"></span><strong>${NC.unitName(t,this.lang())}</strong></div>`).join('')}</div><div class="settings-grid launch-settings"><label class="field">${this.t('Сложность','Difficulty')}<select id="difficulty"><option value="normal" ${this.difficulty==='normal'?'selected':''}>${this.t('Нормальная — рекомендуется','Normal — recommended')}</option><option value="hard" ${this.difficulty==='hard'?'selected':''}>${this.t('Высокая — суровое испытание','Hard — a stern trial')}</option></select></label><label class="toggle-field"><input id="permadeath" type="checkbox" ${this.permadeath?'checked':''}><span><strong>${this.t('Последняя клятва','Veteran permadeath')}</strong><small>${this.t('Павшие ветераны не возвращаются.','Fallen veterans do not return.')}</small></span></label></div><div class="launch-summary"><span>${this.t('Сложность','Difficulty')}: <strong>${this.difficultyLabel()}</strong></span><span>${this.t('Фигур','Pieces')}: <strong>${c.squad.length}</strong></span></div><button class="btn primary btn-hero" data-action="start_run" data-autofocus><span>${this.t('НАЧАТЬ ПОХОД','BEGIN THE RUN')}</span><small>${this.t('Прогресс сохраняется автоматически','Progress saves automatically')}</small></button><button class="btn ghost" data-action="back_menu">${this.t('НАЗАД В МЕНЮ','BACK TO MENU')}</button></aside></div></section>`);}
    campaign(){const r=this.game.run,cmd=D.commanders.find(c=>c.id===r.commanderId);return this.shell(`<div class="campaign-layout"><section class="content-panel panel campaign-panel">${this.sceneHeader('campaign',this.t('КАРТА КОРОЛЕВСТВА','KINGDOM MAP'),this.t(`ГЛАВА ${r.act}: ЗАЧАРОВАННЫЕ ЗЕМЛИ`,`ACT ${r.act}: ENCHANTED LANDS`),this.t('Выберите следующий путь.','Choose the next path.'),'campaign-header')}<div class="legend-strip"><span class="tag">${this.t(`${r.choices.length} пути на выбор`,`${r.choices.length} route options`)}</span><span class="tag">${this.t('Риск выше — награда ценнее','Higher risk, richer reward')}</span></div><div class="route">${r.choices.map(n=>{const d=D.nodeTypes[n.type],label=this.lang()==='en'?d.en:d.ru,desc=this.shortText(this.lang()==='en'?d.descEn:d.descRu,88);return `<button class="card node-card ${n.type}" data-node="${n.id}"><div class="node-art-wrap"><div class="node-art" style="background-image:url('${this.nodeArt(n.secret?'story':n.type)}')"></div></div><div class="node-type">${label}</div><p class="compact-copy">${desc}</p><div class="meta-row"><span class="tag">${this.t('Опасность','Danger')} ${n.danger}</span>${n.secret?`<span class="tag">${this.t('Тайный путь','Hidden path')}</span>`:''}</div></button>`;}).join('')}</div></section>${this.runSidebar(cmd)}</div>`);}
    runSidebar(cmd){const r=this.game.run;return `<aside class="sidebar panel"><div class="sidebar-commander"><div class="commander-mini" style="background-image:url('${this.commanderArt(cmd.id)}')"></div><div class="sidebar-commander-copy"><div class="run-hero-name">${this.safeText(r.heroName||this.t('Безымянный герой','Nameless Hero'))}</div><div class="run-hero-class">${this.lang()==='en'?cmd.nameEn:cmd.nameRu}</div><p class="section-subtitle compact-copy">${this.shortText(this.lang()==='en'?cmd.passiveEn:cmd.passiveRu,92)}</p></div></div><div class="sidebar-metrics"><div class="mini-stat"><span>${this.t('Золото','Gold')}</span><strong>● ${r.credits}</strong></div><div class="mini-stat"><span>${this.t('Реликвии','Relics')}</span><strong>${r.artifacts.length}</strong></div><div class="mini-stat"><span>${this.t('Отряд','Squad')}</span><strong>${Math.min(r.squad.filter(s=>!s.wounded).length,r.maxSquad)}/${r.maxSquad}</strong></div></div><div class="sidebar-section-title">${this.t('Фигуры','Pieces')}</div><div class="roster">${r.squad.map(s=>`<div class="roster-item ${s.wounded?'wounded':''}"><div class="roster-icon art-icon" style="background-image:url('${this.unitArt(s.type)}')"></div><div><strong>${s.name}</strong><div class="section-subtitle">${NC.unitName(s.type,this.lang())} • Lv.${s.level}${s.wounded?' • '+this.t('РАНЕН','WOUNDED'):''}</div></div></div>`).join('')}</div>${r.artifacts.length?`<div class="sidebar-section-title">${this.t('Реликвии','Relics')}</div><div class="tag-cloud">${r.artifacts.map(id=>{const a=D.artifacts.find(x=>x.id===id);const name=this.lang()==='en'?a.nameEn:a.nameRu,desc=this.lang()==='en'?a.descEn:a.descRu;return `<button class="tag relic-tag" type="button" data-relic-name="${this.escapeAttr(name)}" data-relic-desc="${this.escapeAttr(desc)}">${name}</button>`;}).join('')}</div>`:''}<div class="spacer"></div><button class="btn danger" data-action="abandon">${this.t('ЗАВЕРШИТЬ ПОХОД','END RUN')}</button></aside>`;}
    battle(){const b=this.game.battle,sel=this.selectedUid?this.game.getUnit(this.selectedUid):null;return this.shell(`<div class="battle-layout"><section class="board-wrap panel"><div class="board-stage"><canvas id="board" width="768" height="768" aria-label="${this.t('Тактическая доска 6 на 6','6 by 6 tactical board')}"></canvas><div class="board-legend"><span class="legend-chip move">${this.t('Движение','Move')}</span><span class="legend-chip capture">${this.t('Атака','Capture')}</span><span class="legend-chip objective-chip">${this.t('Цель','Objective')}</span><span class="legend-chip hazard">${this.t('Опасность','Hazard')}</span></div></div></section><aside class="battle-side panel"><div class="turn-banner"><span>${b.phase==='player'?this.t('ВАШ ХОД','YOUR TURN'):this.t('ХОД ПРОТИВНИКА','ENEMY TURN')}</span><strong>${this.t('РАУНД','ROUND')} ${b.round}</strong></div><div class="sidebar-metrics"><div class="mini-stat"><span>${this.t('ОП','CP')}</span><strong>${b.cp}/${b.maxCp}</strong></div><div class="mini-stat"><span>${this.t('Союзники','Allies')}</span><strong>${b.units.filter(u=>u.team==='player'&&u.alive).length}</strong></div><div class="mini-stat"><span>${this.t('Враги','Enemies')}</span><strong>${b.units.filter(u=>u.team==='enemy'&&u.alive).length}</strong></div></div><div class="panel-block"><div class="sidebar-section-title">${this.t('Задача','Objective')}</div><div class="objective">${this.objectiveText(b)}</div>${b.targeting?`<div class="objective objective-alt">${this.t('Выберите цель на доске. Esc — отмена.','Choose a target on the board. Esc to cancel.')}</div>`:''}</div><div id="selected-unit">${sel?this.unitPanel(sel):`<div class="unit-card"><h3>${this.t('Фигура не выбрана','No unit selected')}</h3><p class="section-subtitle">${this.t('Выберите союзную фигуру. Зелёное — движение, розовое — атака.','Choose an allied unit. Green is move, pink is attack.')}</p></div>`}</div><button class="btn primary" data-action="end_turn" ${b.phase!=='player'?'disabled':''}>${this.t('ЗАВЕРШИТЬ ХОД','END TURN')}</button><div class="panel-block"><div class="sidebar-section-title">${this.t('Последние события','Recent actions')}</div><div class="log compact-log">${b.log.slice(-8).reverse().map(x=>`<div>› ${this.shortText(x,72)}</div>`).join('')}</div></div><div class="section-subtitle">${this.t('Стрелки — курсор • Enter — действие • Esc — отмена','Arrows — cursor • Enter — act • Esc — cancel')}</div></aside></div>${b.pendingPromotionUid?this.promotionModal():''}`);}
    objectiveText(b){if(b.objectiveType==='eliminate')return this.t('Возьмите вражеского Короля.','Capture the enemy King.');if(b.objectiveType==='extract')return this.t('Дойдите любой фигурой до клетки РЕЛИКВИЯ.','Reach the RELIC cell with any piece.');if(b.objectiveType==='survive')return this.t(`Продержитесь до раунда ${b.surviveTarget}.`,`Hold until round ${b.surviveTarget}.`);return this.t('Разрушьте обереги и победите Тёмного короля. Багровые линии отмечают удар теневого пламени.','Break the wards and defeat the Dark King. Crimson lines mark the next shadowfire strike.');}
    unitPanel(u){const abilities=this.game.getAbilities(u);return `<div class="unit-card focus-card"><div class="unit-panel-head"><div class="unit-large art-icon" style="background-image:url('${this.unitArt(u.type,u.team)}')"></div><div><h3>${u.name}</h3><p class="section-subtitle">${NC.unitName(u.type,this.lang())} • Lv.${u.level} ${u.acted?'• '+this.t('ход завершён','turn spent'):''}</p><div>${u.shield?`<span class="tag">◈ ${this.t('Щит','Shield')} ×${u.shield}</span>`:''}${u.statuses.map(s=>`<span class="tag">${this.statusName(s.id)} ${s.turns}</span>`).join('')}</div></div></div></div>${abilities.length?`<div class="ability-list">${abilities.map(a=>{const cost=this.game.abilityCost(a.id);return `<button class="btn ability-btn" data-ability="${a.id}" ${(!this.game.canAct(u)||this.game.battle.cp<cost)?'disabled':''}><strong>${this.lang()==='en'?a.nameEn:a.nameRu} • ${cost} ${this.t('ОП','CP')}</strong><small>${this.shortText(this.lang()==='en'?a.descEn:a.descRu,86)}</small></button>`;}).join('')}</div>`:''}`;}
    statusName(id){const m={shield:['Щит','Shield'],stun:['Оглушение','Stun'],marked:['Метка','Mark'],invisible:['Невидимость','Invisible'],guard:['Охрана','Guard'],vulnerable:['Уязвимость','Vulnerable']};return m[id]?(this.lang()==='en'?m[id][1]:m[id][0]):id;}
    promotionModal(){return `<div class="modal-backdrop"><div class="modal panel"><div class="eyebrow">${this.t('ВОЗВЫШЕНИЕ ПЕШКИ','PAWN PROMOTION')}</div><h2>${this.t('ВЫБЕРИТЕ НОВУЮ ФИГУРУ','CHOOSE A NEW PIECE')}</h2><p>${this.t('Пешка достигла края доски и получает новую форму.','The Pawn reached the final rank and may take a new form.')}</p><div class="grid cards">${['injector','scanner','bastion','battle_ai'].map(t=>`<button class="card promotion-card" data-promote="${t}"><div class="reward-art unit" style="background-image:url('${this.unitArt(t)}')"></div><h3>${NC.unitName(t,this.lang())}</h3><p>${this.lang()==='en'?D.units[t].descEn:D.units[t].descRu}</p></button>`).join('')}</div></div></div>`;}
    reward(){const r=this.game.run;return this.shell(`<section class="content-panel panel">${this.sceneHeader('reward',this.t('ТРОФЕИ ПОБЕДИТЕЛЯ','VICTOR’S SPOILS'),this.t('ВЫБЕРИТЕ НАГРАДУ','CHOOSE A REWARD'),this.t('Можно забрать только один трофей.','You may claim only one prize.'))}<div class="grid cards reward-grid">${r.pendingRewards.map((x,i)=>`<button class="card reward-choice" data-reward="${i}">${this.rewardCard(x)}</button>`).join('')}</div></section>`);}
    rewardCard(x){if(x.type==='artifact'){const a=D.artifacts.find(v=>v.id===x.artifactId),name=this.lang()==='en'?a.nameEn:a.nameRu,desc=this.lang()==='en'?a.descEn:a.descRu;return `<div class="reward-art" style="background-image:url('${this.rewardArt('artifact')}')"></div><span class="relic-name-button" role="button" tabindex="0" data-relic-name="${this.escapeAttr(name)}" data-relic-desc="${this.escapeAttr(desc)}">${name}</span><p class="compact-copy">${this.shortText(desc,92)}</p><span class="tag">${a.rarity}</span>`;}if(x.type==='credits')return `<div class="reward-art" style="background-image:url('${this.rewardArt('credits')}')"></div><h3>● ${x.amount}</h3><p class="compact-copy">${this.t('Золото для лавок и событий.','Gold for shops and events.')}</p>`;if(x.type==='upgrade'){const v=this.game.run.squad.find(u=>u.id===x.unitId);return `<div class="reward-art" style="background-image:url('${this.rewardArt('upgrade')}')"></div><h3>${this.t('Развитие ветерана','Veteran Upgrade')}</h3><p class="compact-copy">${v?.name||''}: ${this.t('+2 опыта и одно улучшение.','+2 XP and one upgrade.')}</p>`;}return `<div class="reward-art unit" style="background-image:url('${this.unitArt(x.unitType)}')"></div><h3>${this.t('Новая фигура','New Piece')}: ${NC.unitName(x.unitType,this.lang())}</h3><p class="compact-copy">${this.shortText(this.lang()==='en'?D.units[x.unitType].descEn:D.units[x.unitType].descRu,90)}</p>`;}
    defeat(){const r=this.game.run,s=r?.stats||{};return this.shell(`<section class="hero hero--art panel hero-compact result-screen defeat-result"><div class="hero-art" style="background-image:url('${this.sceneArt('defeat')}')"></div><div class="hero-content"><div class="eyebrow">${this.t('КОРОЛЬ ПАЛ','THE KING HAS FALLEN')}</div><h1>${this.t('ПОРАЖЕНИЕ','DEFEAT')}</h1><p class="lead">${this.t('Поход завершён, но открытия и записи летописи сохранятся.','The run is over, but unlocks and chronicle entries remain.')}</p><div class="result-grid"><div><span>${this.t('Достигнута глава','Act reached')}</span><strong>${r?.act||1}</strong></div><div><span>${this.t('Побед в боях','Battles won')}</span><strong>${s.battles||0}</strong></div><div><span>${this.t('Взятий','Captures')}</span><strong>${s.captures||0}</strong></div><div><span>${this.t('Реликвий','Relics')}</span><strong>${r?.artifacts?.length||0}</strong></div></div><div class="btn-row"><button class="btn danger btn-hero" data-action="finish_defeat" data-autofocus><span>${this.t('ОТКРЫТЬ ИТОГИ','VIEW RESULTS')}</span><small>${this.t('Сохранить наследие и завершить поход','Save your legacy and close the run')}</small></button></div></div></section>`,false);}
    event(){const e=this.game.getCurrentEvent();return this.shell(`<section class="content-panel panel event-screen"><div class="event-stage"><div class="event-copy"><div class="eyebrow">${this.t('ВСТРЕЧА НА ПУТИ','ENCOUNTER')}</div><h2 class="section-title">${this.lang()==='en'?e.titleEn:e.titleRu}</h2><p class="lead">${this.shortText(this.lang()==='en'?e.textEn:e.textRu,220)}</p></div><div class="event-hero"><img src="${this.eventArt(e.id)}" alt=""></div></div><div class="choice-list">${e.choices.map((c,i)=>`<button class="btn choice choice-rich" data-event-choice="${i}" ${(c.cost&&this.game.run.credits<c.cost)?'disabled':''}><strong>${this.lang()==='en'?c.textEn:c.textRu}</strong>${c.cost?`<span>● ${c.cost}</span>`:''}</button>`).join('')}</div></section>`);}
    shop(){if(!this.shopStock)this.shopStock=this.game.getShopStock();return this.shell(`<section class="content-panel panel">${this.sceneHeader('shop',this.t('СТРАНСТВУЮЩИЙ КУПЕЦ','WANDERING MERCHANT'),this.t('ЛАВКА РЕЛИКВИЙ','RELIC SHOP'),`${this.t('Казна','Treasury')}: ● ${this.game.run.credits}`)}<div class="grid cards">${this.shopStock.map((it,i)=>`<div class="card store-card">${this.shopItem(it)}<button class="btn primary" data-buy="${i}" ${this.game.run.credits<it.price?'disabled':''}>${this.t('КУПИТЬ','BUY')} • ● ${it.price}</button></div>`).join('')}</div><div class="btn-row"><button class="btn" data-action="leave_shop">${this.t('ПРОДОЛЖИТЬ ПУТЬ','CONTINUE JOURNEY')}</button></div></section>`);}
    shopItem(it){const art=this.shopArt(it);if(it.type==='artifact'){const a=D.artifacts.find(x=>x.id===it.id),name=this.lang()==='en'?a.nameEn:a.nameRu,desc=this.lang()==='en'?a.descEn:a.descRu;return `<div class="reward-art" style="background-image:url('${art}')"></div><span class="relic-name-button" role="button" tabindex="0" data-relic-name="${this.escapeAttr(name)}" data-relic-desc="${this.escapeAttr(desc)}">${name}</span><p class="compact-copy">${this.shortText(desc,92)}</p>`;}if(it.type==='heal')return `<div class="reward-art" style="background-image:url('${art}')"></div><h3>${this.t('Исцеление фигуры','Heal a Piece')}</h3><p class="compact-copy">${this.t('Восстанавливает одну раненую фигуру.','Restores one wounded piece.')}</p>`;return `<div class="reward-art unit" style="background-image:url('${art}')"></div><h3>${this.t('Нанять','Recruit')} ${NC.unitName(it.unitType,this.lang())}</h3><p class="compact-copy">${this.shortText(this.lang()==='en'?D.units[it.unitType].descEn:D.units[it.unitType].descRu,90)}</p>`;}
    repair(){const wounded=this.game.run.squad.filter(s=>s.wounded);return this.shell(`<section class="content-panel panel">${this.sceneHeader('repair',this.t('ХРАМ ИСЦЕЛЕНИЯ','SANCTUARY'),this.t('ИСЦЕЛЕНИЕ РАНЕНЫХ','HEAL THE WOUNDED'),this.t('Выберите одну фигуру для восстановления.','Choose one piece to restore.'))}${wounded.length?`<div class="grid cards">${wounded.map(s=>`<button class="card" data-repair="${s.id}"><div class="reward-art unit" style="background-image:url('${this.unitArt(s.type)}')"></div><h3>${s.name}</h3><p>${NC.unitName(s.type,this.lang())} • Lv.${s.level}</p></button>`).join('')}</div>`:`<div class="empty-state"><img src="${this.rewardArt('heal')}" alt=""><h3>${this.t('Все фигуры здоровы','All pieces are healthy')}</h3><p>${this.t('Жрецы передают вам 12 золотых на дорогу.','The healers give you 12 gold for the road.')}</p><button class="btn primary" data-action="repair_bonus">● 12</button></div>`}</section>`);}
    training(){return this.shell(`<section class="content-panel panel">${this.sceneHeader('training',this.t('ТРЕНИРОВОЧНЫЙ ДВОР','TRAINING YARD'),this.t('РАЗВИТИЕ ВЕТЕРАНОВ','VETERAN TRAINING'),this.t('Выберите фигуру: +2 опыта и одно улучшение.','Choose a piece: +2 XP and one upgrade.'))}<div class="grid cards">${this.game.run.squad.filter(s=>!s.wounded).map(s=>`<button class="card" data-train="${s.id}"><div class="reward-art unit" style="background-image:url('${this.unitArt(s.type)}')"></div><h3>${s.name}</h3><p>${NC.unitName(s.type,this.lang())} • Lv.${s.level} • XP ${s.xp}</p></button>`).join('')}</div></section>`);}
    vault(){return this.shell(`<section class="hero hero--art panel hero-compact"><div class="hero-art" style="background-image:url('${this.sceneArt('vault')}')"></div><div class="hero-content"><div class="eyebrow">${this.t('КОРОЛЕВСКАЯ СОКРОВИЩНИЦА','ROYAL VAULT')}</div><h2>${this.t('ЗАПЕЧАТАННЫЙ СУНДУК','SEALED CHEST')}</h2><p class="lead">${this.t('Возьмите безопасную долю или рискните ради золота и реликвии.','Take a safe share or risk injury for gold and a relic.')}</p><div class="btn-row"><button class="btn success" data-vault="safe">● 22</button><button class="btn danger" data-vault="risky">${this.t('РИСК: ● 45 И РЕЛИКВИЯ','RISK: ● 45 AND A RELIC')}</button></div></div></section>`,false);}
    bargain(){return this.shell(`<section class="hero hero--art panel hero-compact"><div class="hero-art" style="background-image:url('${this.sceneArt('bargain')}')"></div><div class="hero-content"><div class="eyebrow">${this.t('ТЁМНАЯ СДЕЛКА','DARK BARGAIN')}</div><h2>${this.t('АЛТАРЬ ТРЕБУЕТ ЦЕНУ','THE ALTAR DEMANDS A PRICE')}</h2><div class="choice-list"><button class="btn choice" data-bargain="power"><strong>${this.t('Сила сейчас','Power Now')}</strong><span>${this.t('Два улучшения, но случайная рана.','Two upgrades, but a random injury.')}</span></button><button class="btn choice" data-bargain="wealth"><strong>${this.t('Королевская казна','Royal Treasury')}</strong><span>${this.t('+70 золота, -1 место в отряде.','+70 gold, -1 squad slot.')}</span></button><button class="btn choice" data-bargain="legacy"><strong>${this.t('Наследие','Legacy')}</strong><span>${this.t('+4 эссенции, потерять всё золото.','+4 essence, lose all gold.')}</span></button></div></div></section>`,false);}
    settings(){const s=this.game.profile.settings;return this.shell(`<section class="content-panel panel">${this.sceneHeader('settings',this.t('КНИГА НАСТРОЕК','BOOK OF SETTINGS'),this.t('НАСТРОЙКИ','SETTINGS'),this.t('Язык, звук, генерация похода, масштаб и доступность.','Language, sound, run generation, scale, and accessibility.'))}<div class="settings-grid"><label class="field">${this.t('Язык','Language')}<select id="language"><option value="ru" ${s.language==='ru'?'selected':''}>Русский</option><option value="en" ${s.language==='en'?'selected':''}>English</option></select></label><label class="field">${this.t('Общая громкость','Master volume')}<input id="volume" type="range" min="0" max="1" step="0.05" value="${s.masterVolume}"></label><label class="field">${this.t('Громкость музыки','Music volume')}<input id="music_volume" type="range" min="0" max="1" step="0.05" value="${s.musicVolume??0.42}"></label><label class="field">${this.t('Масштаб интерфейса','UI scale')}<input id="ui_scale" type="range" min="0.85" max="1.25" step="0.05" value="${s.uiScale}"></label><label class="field field-with-help"><span>${this.t('Код генерации мира','World generation code')}</span><input id="world_seed" inputmode="numeric" maxlength="10" placeholder="${this.t('Пусто — случайный поход','Blank — random run')}" value="${this.safeText(s.worldSeed||'')}"><small>${this.t('Только цифры. Одинаковый код повторяет генерацию пути.','Digits only. The same code repeats route generation.')}</small></label><label class="toggle-field"><input id="reduce_motion" type="checkbox" ${s.reduceMotion?'checked':''}><span><strong>${this.t('Снизить анимации','Reduce motion')}</strong><small>${this.t('Уменьшает вспышки и движение эффектов.','Reduces flashes and animated effects.')}</small></span></label><label class="toggle-field"><input id="colorblind" type="checkbox" ${s.colorblind?'checked':''}><span><strong>${this.t('Альтернативная палитра','Alternative palette')}</strong><small>${this.t('Повышает различимость игровых цветов.','Improves distinction between gameplay colors.')}</small></span></label></div><div class="btn-row"><button class="btn primary" data-action="save_settings">${this.t('СОХРАНИТЬ','SAVE')}</button><button class="btn" data-action="back_auto">${this.t('НАЗАД','BACK')}</button><button class="btn danger" data-action="reset_profile">${this.t('СБРОСИТЬ ПРОГРЕСС','RESET PROGRESS')}</button></div></section>`);}
    achievements(){const set=new Set(this.game.profile.achievements);return this.shell(`<section class="content-panel panel">${this.sceneHeader('achievements',this.t('ЗАЛ СЛАВЫ','HALL OF GLORY'),`${this.t('ДОСТИЖЕНИЯ','ACHIEVEMENTS')} ${set.size}/20`,this.t('Главные подвиги вашей королевской армии.','The greatest deeds of your royal army.'))}<div class="achievement-grid">${D.achievements.map(a=>`<div class="achievement ${set.has(a.id)?'unlocked':''}"><div class="achievement-head"><div class="achievement-art" style="background-image:url('${this.achievementArt(a.id)}')"></div><strong>${set.has(a.id)?'★':'☆'} ${this.lang()==='en'?a.nameEn:a.nameRu}</strong></div><p class="compact-copy">${this.shortText(this.lang()==='en'?a.descEn:a.descRu,88)}</p></div>`).join('')}</div><div class="btn-row"><button class="btn" data-action="back_menu">${this.t('НАЗАД','BACK')}</button></div></section>`);}
    codex(){return this.shell(`<section class="content-panel panel">${this.sceneHeader('codex',this.t('КОРОЛЕВСКИЙ АРХИВ','ROYAL ARCHIVE'),this.t('ЛЕТОПИСЬ','CHRONICLE'),this.t('Краткие записи о фигурах, реликвиях и угрозах.','Short records of pieces, relics, and threats.'))}<div class="grid cards">${this.game.profile.codex.map(id=>{const c=D.codex[id],art=this.codexArt(id);return c?`<div class="card codex-card"><div class="codex-art" style="background-image:url('${art}')"></div><h3>${c[0]}</h3><p class="compact-copy">${this.shortText(c[1],120)}</p></div>`:'';}).join('')}</div><div class="btn-row"><button class="btn" data-action="back_menu">${this.t('НАЗАД','BACK')}</button></div></section>`);}
    runComplete(){const r=this.game.run,win=r.act>3,s=r.stats||{},earned=r.finalEarned||0;return this.shell(`<section class="hero hero--art panel hero-compact result-screen ${win?'victory-result':'archive-result'}"><div class="hero-art" style="background-image:url('${this.sceneArt(win?'victory':'defeat')}')"></div><div class="hero-content"><div class="eyebrow">${win?this.t('КОРОЛЕВСТВО СПАСЕНО','THE REALM IS SAVED'):this.t('ПОХОД ЗАВЕРШЁН','RUN COMPLETE')}</div><h1>${win?this.t('ПОБЕДА','VICTORY'):this.t('ИТОГ ПОХОДА','RUN SUMMARY')}</h1><p class="lead">${win?this.t('Тёмный король повержен. Новые герои и реликвии открыты для следующих походов.','The Dark King is defeated. New heroes and relics are available in future runs.'):this.t('Наследие сохранено. Следующий поход начнётся с открытой эссенцией.','Your legacy is saved. The next run begins with your unlocked essence.')}</p><div class="result-grid"><div><span>${this.t('Эссенция','Essence')}</span><strong>✧ ${earned}</strong></div><div><span>${this.t('Достигнута глава','Act reached')}</span><strong>${Math.min(r.act,3)}</strong></div><div><span>${this.t('Взятий','Captures')}</span><strong>${s.captures||0}</strong></div><div><span>${this.t('Заклинаний','Abilities')}</span><strong>${s.abilities||0}</strong></div><div><span>${this.t('Покупок','Purchases')}</span><strong>${s.bought||0}</strong></div><div><span>${this.t('Реликвий','Relics')}</span><strong>${r.artifacts?.length||0}</strong></div></div><div class="result-note">${this.t('Герои, реликвии, достижения и записи летописи сохранены.','Heroes, relics, achievements, and chronicle entries are saved.')}</div><div class="btn-row"><button class="btn primary btn-hero" data-action="run_again" data-autofocus><span>${this.t('НОВЫЙ ПОХОД','NEW RUN')}</span><small>${this.t('Перейти к выбору полководца','Go to commander selection')}</small></button><button class="btn" data-action="return_menu">${this.t('ГЛАВНОЕ МЕНЮ','MAIN MENU')}</button></div></div></section>`,false);}
    openRelicModal(name,desc){
      this.closeRelicModal();
      const overlay=document.createElement('div');
      overlay.className='relic-modal-backdrop';
      overlay.innerHTML=`<div class="relic-modal panel" role="dialog" aria-modal="true" aria-label="${this.t('Описание реликвии','Relic details')}"><button class="relic-modal-close" type="button" aria-label="${this.t('Закрыть','Close')}">×</button><div class="eyebrow">${this.t('РЕЛИКВИЯ','RELIC')}</div><h3></h3><p></p></div>`;
      overlay.querySelector('h3').textContent=name;
      overlay.querySelector('p').textContent=desc;
      overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.relic-modal-close'))this.closeRelicModal();});
      document.body.appendChild(overlay);
      this.relicModalEl=overlay;
    }
    closeRelicModal(){if(this.relicModalEl){this.relicModalEl.remove();this.relicModalEl=null;}}

    bindScreen(type){
      this.root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>this.action(el.dataset.action)));
      this.root.querySelectorAll('[data-relic-name]').forEach(el=>el.addEventListener('click',()=>{this.audio.click();this.openRelicModal(el.dataset.relicName,el.dataset.relicDesc);}));
      if(type==='new_run'){
        this.root.querySelectorAll('[data-commander]').forEach(el=>el.addEventListener('click',()=>{this.selectedCommander=el.dataset.commander;this.audio.click();this.render(false);}));
        document.getElementById('difficulty')?.addEventListener('change',e=>{this.difficulty=e.target.value;const strong=this.root.querySelector('.launch-summary strong');if(strong)strong.textContent=this.difficultyLabel();});document.getElementById('hero_name')?.addEventListener('input',e=>{e.target.value=e.target.value.replace(/[\r\n\t]/g,' ').replace(/\s{2,}/g,' ').slice(0,28);this.heroName=e.target.value;const preview=this.root.querySelector('.hero-name-display');if(preview)preview.textContent=String(this.heroName||'').trim()||this.t('Безымянный герой','Nameless Hero');});document.getElementById('permadeath')?.addEventListener('change',e=>this.permadeath=e.target.checked);
      }
      if(type==='settings'){
        document.getElementById('world_seed')?.addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,10);});
        const previewMusic=()=>{const master=+document.getElementById('volume').value,music=+document.getElementById('music_volume').value;this.music.audio.volume=Math.max(0,Math.min(1,master*music));this.music.audio.muted=this.music.audio.volume<=0;if(this.music.activated&&this.music.audio.volume>0&&this.music.audio.paused)this.music.play();};
        document.getElementById('volume')?.addEventListener('input',previewMusic);
        document.getElementById('music_volume')?.addEventListener('input',previewMusic);
      }
      if(type==='campaign')this.root.querySelectorAll('[data-node]').forEach(el=>el.addEventListener('click',()=>{this.audio.click();this.shopStock=null;this.game.enterNode(el.dataset.node);}));
      if(type==='battle')this.bindBattle();
      if(type==='reward')this.root.querySelectorAll('[data-reward]').forEach(el=>el.addEventListener('click',()=>{this.audio.win();this.selectedUid=null;this.game.chooseReward(+el.dataset.reward);}));
      if(type==='event')this.root.querySelectorAll('[data-event-choice]').forEach(el=>el.addEventListener('click',()=>{if(!this.game.resolveEvent(+el.dataset.eventChoice))this.audio.error();else this.audio.click();}));
      if(type==='shop')this.root.querySelectorAll('[data-buy]').forEach(el=>el.addEventListener('click',()=>{const item=this.shopStock[+el.dataset.buy];if(this.game.buyShopItem(item)){this.audio.click();this.shopStock=this.game.getShopStock();this.render();}else this.audio.error();}));
      if(type==='repair')this.root.querySelectorAll('[data-repair]').forEach(el=>el.addEventListener('click',()=>this.game.repairUnit(el.dataset.repair)));
      if(type==='training')this.root.querySelectorAll('[data-train]').forEach(el=>el.addEventListener('click',()=>this.game.trainUnit(el.dataset.train)));
      if(type==='vault')this.root.querySelectorAll('[data-vault]').forEach(el=>el.addEventListener('click',()=>this.game.resolveVault(el.dataset.vault==='risky')));
      if(type==='bargain')this.root.querySelectorAll('[data-bargain]').forEach(el=>el.addEventListener('click',()=>this.game.resolveBargain(el.dataset.bargain)));
    }

    action(a){
      if(a==='close_relic_modal'){this.closeRelicModal();return;}
      this.closeRelicModal?.();
      this.audio.click();
      if(a==='settings'){this.view='settings';this.render();}
      else if(a==='new_run'){this.view='new_run';this.render();}
      else if(a==='continue'){this.game.run=this.game.profile.currentRun;this.game.battle=this.game.run?.savedBattle||null;this.lastBattleSnapshot=this.snapshotBattle();this.view='auto';this.render();}
      else if(a==='achievements'){this.view='achievements';this.render();}
      else if(a==='codex'){this.view='codex';this.render();}
      else if(a==='back_menu'){this.view='menu';this.render();}
      else if(a==='back_auto'){this.music.updateVolume();this.view=this.game.run?'auto':'menu';this.render();}
      else if(a==='start_run'){const unlocked=this.game.profile.unlockedCommanders.includes(this.selectedCommander);if(!unlocked){this.audio.error();this.toast(this.t('Командир ещё не открыт','Commander is still locked'));return;}const active=this.game.profile.currentRun&&!this.game.profile.currentRun.completed;if(active&&!confirm(this.t('Начать новый забег и заменить текущее сохранение?','Start a new run and replace the current save?')))return;const seedText=String(this.game.profile.settings.worldSeed||'').trim(),seed=seedText===''?null:Number(seedText),heroName=String(this.heroName||'').trim()||this.t('Безымянный герой','Nameless Hero');this.view='auto';this.game.startRun(this.selectedCommander,this.difficulty,this.permadeath,seed,heroName);}
      else if(a==='end_turn'){this.selectedUid=null;this.game.endPlayerTurn();}
      else if(a==='abandon'){if(confirm(this.t('Завершить текущий забег?','End the current run?')))this.game.abandonRun();}
      else if(a==='finish_defeat')this.game.completeRun(false);
      else if(a==='return_menu'){this.view='menu';this.game.returnToMenuAfterRun();}
      else if(a==='run_again'){this.heroName=this.game.run?.heroName||this.heroName;this.view='new_run';this.game.returnToMenuAfterRun();}
      else if(a==='leave_shop'){this.shopStock=null;this.game.leaveShop();}
      else if(a==='repair_bonus'){this.game.run.credits+=12;this.game.completeNonBattleNode();}
      else if(a==='save_settings')this.saveSettings();
      else if(a==='reset_profile'){if(confirm(this.t('Удалить весь прогресс?','Delete all progress?'))){NC.Storage.clear();location.reload();}}
      else if(a==='export_save')this.exportSave();
      else if(a==='import_save')document.getElementById('save-import').click();
    }
    saveSettings(){const patch={language:document.getElementById('language').value,masterVolume:+document.getElementById('volume').value,musicVolume:+document.getElementById('music_volume').value,uiScale:+document.getElementById('ui_scale').value,worldSeed:(document.getElementById('world_seed')?.value||'').replace(/\D/g,'').slice(0,10),reduceMotion:document.getElementById('reduce_motion').checked,colorblind:document.getElementById('colorblind').checked};this.seed=patch.worldSeed;this.view=this.game.run?'auto':'menu';this.game.setSettings(patch);}
    exportSave(){const blob=new Blob([NC.Storage.export(this.game.profile)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rpchess-save.json';a.click();URL.revokeObjectURL(a.href);}

    bindBattle(){
      const canvas=document.getElementById('board');if(!canvas)return;
      canvas.addEventListener('pointermove',e=>{const c=this.canvasCell(e,canvas);this.hoverCell=c;this.drawBoard();});
      canvas.addEventListener('pointerleave',()=>{this.hoverCell=null;this.drawBoard();});
      canvas.addEventListener('pointerdown',e=>{const c=this.canvasCell(e,canvas);this.keyboardCell=c;this.handleBoardCell(c.x,c.y);});
      this.root.querySelectorAll('[data-ability]').forEach(el=>el.addEventListener('click',()=>{
        if(!this.selectedUid)return;
        this.pendingFxHint={kind:'ability',uid:this.selectedUid,id:el.dataset.ability};
        const r=this.game.useAbility(this.selectedUid,el.dataset.ability);
        if(!r.ok){this.pendingFxHint=null;this.audio.error();this.toast(r.message);}else this.audio.click();
      }));
      this.root.querySelectorAll('[data-promote]').forEach(el=>el.addEventListener('click',()=>{
        this.pendingFxHint={kind:'promotion',uid:this.game.battle.pendingPromotionUid};
        this.game.promote(this.game.battle.pendingPromotionUid,el.dataset.promote);this.audio.win();
      }));
    }
    canvasCell(e,canvas){const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height,pad=24,cell=(canvas.width-pad*2)/6;return{x:Math.floor((x-pad)/cell),y:Math.floor((y-pad)/cell)};}
    handleBoardCell(x,y){
      const b=this.game.battle;if(!b||b.phase!=='player'||x<0||y<0||x>5||y>5)return;
      const clicked=this.game.unitAt(x,y);
      if(b.targeting){
        if(!clicked){this.audio.error();return;}
        this.pendingFxHint={kind:'ability_target',uid:b.targeting.userUid,targetUid:clicked.uid,id:b.targeting.id};
        const res=this.game.targetAbility(clicked.uid);if(!res.ok){this.pendingFxHint=null;this.audio.error();this.toast(res.message);}else this.audio.capture();return;
      }
      if(this.selectedUid){
        const selected=this.game.getUnit(this.selectedUid),legal=selected&&this.game.movementFor(selected).some(m=>m.x===x&&m.y===y);
        if(legal){const res=this.game.move(this.selectedUid,x,y);if(res.ok){res.captured?this.audio.capture():this.audio.move();if(!this.game.getUnit(this.selectedUid)||this.game.getUnit(this.selectedUid)?.acted)this.selectedUid=null;}else{this.audio.error();this.toast(res.message);}return;}
      }
      if(clicked&&clicked.team==='player'){this.selectedUid=clicked.uid;this.audio.click();this.render(false);}else{this.selectedUid=null;this.drawBoard();}
    }

    drawBoard(now=performance.now()){
      const canvas=document.getElementById('board'),b=this.game.battle;if(!canvas||!b)return;
      const ctx=canvas.getContext('2d'),W=canvas.width,pad=24,cell=(W-pad*2)/6,time=now||performance.now();
      ctx.clearRect(0,0,W,W);
      const bg=ctx.createRadialGradient(W*.5,W*.42,24,W*.5,W*.5,W*.78);bg.addColorStop(0,'#35485a');bg.addColorStop(.58,'#182b38');bg.addColorStop(1,'#0a151c');ctx.fillStyle=bg;ctx.fillRect(0,0,W,W);
      const selected=this.selectedUid?this.game.getUnit(this.selectedUid):null,legal=selected?this.game.movementFor(selected):[];
      const fx=this.boardFx,raw=fx?Math.max(0,Math.min(1,(time-fx.start)/fx.duration)):1,p=this.easeOutCubic(raw),pulse=.5+.5*Math.sin(time/155);
      const elapsed=fx?Math.max(0,time-fx.start):0;
      const moveSeq=fx?.moves||[];
      const moveMap=new Map(moveSeq.map((m,i)=>[m.uid,{m,i}]));
      const seqActive=!!(fx&&fx.sequential);
      const segmentDur=seqActive?(fx.moveSegmentDuration||340):0;
      const currentSeg=seqActive?Math.min(moveSeq.length-1,Math.floor(elapsed/segmentDur)):0;
      const localRaw=seqActive?Math.max(0,Math.min(1,(elapsed-currentSeg*segmentDur)/segmentDur)):raw;
      const localP=this.easeOutCubic(localRaw);
      for(let y=0;y<6;y++)for(let x=0;x<6;x++){
        const px=pad+x*cell,py=pad+y*cell;
        const grad=ctx.createLinearGradient(px,py,px+cell,py+cell);grad.addColorStop(0,(x+y)%2?'#71879a':'#d7c99d');grad.addColorStop(1,(x+y)%2?'#526a7d':'#b8a875');ctx.fillStyle=grad;ctx.fillRect(px,py,cell,cell);
        ctx.strokeStyle='rgba(55,39,22,.52)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,cell-1,cell-1);
        ctx.strokeStyle='rgba(255,244,205,.055)';for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(px+i*cell/3,py+6);ctx.lineTo(px+i*cell/3,py+cell-6);ctx.stroke();ctx.beginPath();ctx.moveTo(px+6,py+i*cell/3);ctx.lineTo(px+cell-6,py+i*cell/3);ctx.stroke();}
        if(b.blocked.includes(`${x},${y}`)){ctx.fillStyle='rgba(47,38,34,.52)';ctx.fillRect(px+8,py+8,cell-16,cell-16);ctx.strokeStyle='#382d29';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+14,py+14);ctx.lineTo(px+cell-14,py+cell-14);ctx.moveTo(px+cell-14,py+14);ctx.lineTo(px+14,py+cell-14);ctx.stroke();}
        if(b.objectiveCell&&b.objectiveCell.x===x&&b.objectiveCell.y===y){ctx.fillStyle=`rgba(255,213,107,${.2+.14*pulse})`;ctx.fillRect(px+5,py+5,cell-10,cell-10);ctx.strokeStyle='#ffd56b';ctx.lineWidth=2;ctx.strokeRect(px+9,py+9,cell-18,cell-18);ctx.fillStyle='#ffd56b';ctx.font=`bold ${cell*.18}px Segoe UI`;ctx.textAlign='center';ctx.fillText('RELIC',px+cell/2,py+cell*.57);}
        if(b.telegraphs.some(t=>(t.axis==='row'?t.index===y:t.index===x))){ctx.fillStyle=`rgba(116,34,128,${.14+.17*pulse})`;ctx.fillRect(px,py,cell,cell);ctx.strokeStyle=`rgba(202,92,216,${.55+.4*pulse})`;ctx.lineWidth=3;ctx.strokeRect(px+3,py+3,cell-6,cell-6);}
        if(b.hazards.some(h=>h.x===x&&h.y===y)){ctx.fillStyle=`rgba(95,255,80,${.12+.11*pulse})`;ctx.fillRect(px+6,py+6,cell-12,cell-12);for(let i=0;i<4;i++){ctx.fillStyle=`rgba(110,255,120,${.22+.18*Math.sin(time/240+i)})`;ctx.beginPath();ctx.arc(px+cell*(.2+i*.2),py+cell*(.35+.1*Math.sin(time/260+i)),cell*.045,0,Math.PI*2);ctx.fill();}}
        const l=legal.find(m=>m.x===x&&m.y===y);if(l){ctx.fillStyle=l.capture?`rgba(255,79,163,${.25+.13*pulse})`:`rgba(67,232,255,${.18+.12*pulse})`;ctx.fillRect(px+5,py+5,cell-10,cell-10);ctx.strokeStyle=l.capture?'#c05ad0':'#7dc8ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px+cell/2,py+cell/2,cell*(.18+.03*pulse),0,Math.PI*2);ctx.stroke();}
        if(this.hoverCell?.x===x&&this.hoverCell?.y===y){ctx.strokeStyle='#eef6ff';ctx.lineWidth=2;ctx.strokeRect(px+4,py+4,cell-8,cell-8);}
        if(this.keyboardCell.x===x&&this.keyboardCell.y===y){ctx.strokeStyle='#ffd56b';ctx.lineWidth=3;ctx.strokeRect(px+8,py+8,cell-16,cell-16);}
      }
      const spawnMap=new Map((fx?.spawns||[]).map(s=>[s.uid,s]));
      for(const u of b.units.filter(x=>x.alive)){
        const info=moveMap.get(u.uid),isSpawn=spawnMap.has(u.uid);let opts={time};
        if(info){
          if(seqActive){
            if(currentSeg<info.i){opts.x=info.m.from.x;opts.y=info.m.from.y;opts.scale=1;}
            else if(currentSeg===info.i){opts.x=info.m.from.x+(info.m.to.x-info.m.from.x)*localP;opts.y=info.m.from.y+(info.m.to.y-info.m.from.y)*localP-Math.sin(Math.PI*localRaw)*.16;opts.scale=.92+.08*localP;}
            else {opts.x=info.m.to.x;opts.y=info.m.to.y;opts.scale=1;}
          } else {opts.x=info.m.from.x+(info.m.to.x-info.m.from.x)*p;opts.y=info.m.from.y+(info.m.to.y-info.m.from.y)*p-Math.sin(Math.PI*raw)*.16;opts.scale=.92+.08*p;}
        }
        if(isSpawn){opts.scale=.35+.65*p;opts.alpha=Math.min(1,raw*2);}
        this.drawUnit(ctx,u,pad,cell,opts);
      }
      if(fx){
        const deathRaw=fx.movePhaseDuration&&elapsed>fx.movePhaseDuration?Math.max(0,Math.min(1,(elapsed-fx.movePhaseDuration)/Math.max(240,fx.duration-fx.movePhaseDuration))):raw;
        for(const dead of fx.deaths){if(deathRaw<.46)this.drawUnit(ctx,dead,pad,cell,{time,alpha:1-deathRaw/.46,scale:1+deathRaw*.28});this.drawExplosion(ctx,pad+(dead.x+.5)*cell,pad+(dead.y+.5)*cell,cell,deathRaw,dead.team==='player'?'#7dc8ff':'#c05ad0');}
        for(const u of fx.shieldHits)this.drawRingFx(ctx,pad+(u.x+.5)*cell,pad+(u.y+.5)*cell,cell,raw,'#ffffff','hit');
        for(const u of fx.shieldGains)this.drawRingFx(ctx,pad+(u.x+.5)*cell,pad+(u.y+.5)*cell,cell,raw,'#7dc8ff','gain');
        for(const s of fx.statusAdds)this.drawStatusFx(ctx,pad+(s.unit.x+.5)*cell,pad+(s.unit.y+.5)*cell,cell,raw,s.id);
        for(const t of fx.telegraphs)this.drawTelegraphFx(ctx,t,pad,cell,raw);
        if(fx.hint)this.drawAbilityFx(ctx,fx.hint,pad,cell,raw);
        for(const t of fx.texts||[])this.drawFloatingText(ctx,pad+(t.x+.5)*cell,pad+(t.y+.16)*cell,cell,raw,t.text,t.color,t.size||1); 
      }
      ctx.fillStyle='rgba(210,226,255,.55)';ctx.font=`bold ${cell*.12}px Segoe UI`;ctx.textAlign='center';for(let x=0;x<6;x++){ctx.fillText(String.fromCharCode(65+x),pad+(x+.5)*cell,pad-8);ctx.fillText(String.fromCharCode(65+x),pad+(x+.5)*cell,pad+cell*6+20);}ctx.textAlign='right';for(let y=0;y<6;y++){ctx.fillText(String(y+1),pad-10,pad+(y+.58)*cell);ctx.fillText(String(y+1),pad+cell*6+18,pad+(y+.58)*cell);}
      ctx.strokeStyle=`rgba(238,201,105,${.72+.2*pulse})`;ctx.lineWidth=3;ctx.strokeRect(pad,pad,cell*6,cell*6);
      ctx.strokeStyle='rgba(112,176,220,.45)';ctx.lineWidth=1;ctx.strokeRect(pad-7,pad-7,cell*6+14,cell*6+14);
    }
    drawUnit(ctx,u,pad,cell,opts={}){
      const ux=opts.x??u.x,uy=opts.y??u.y,scaleFactor=opts.scale??1,alpha=opts.alpha??1,time=opts.time??performance.now();
      const cx=pad+(ux+.5)*cell,cy=pad+(uy+.5)*cell;
      const frame=this.unitFrameTuning(u.type),frameR=Math.max(cell*Math.max(frame.w,frame.h)*.42,cell*.28)*scaleFactor;
      const artPath=this.unitArt(u.type,u.team==='player'?'player':'enemy'),img=this.loadImage(artPath),statuses=(u.statuses||[]).map(s=>typeof s==='string'?{id:s.split(':')[0]}:s);
      const baseW=cell*frame.w,baseH=cell*frame.h,px=cx-baseW/2,py=cy-baseH/2;
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(scaleFactor,scaleFactor);ctx.translate(-cx,-cy);
      if(img&&img.complete&&img.naturalWidth>0){
        const m=this.prepareImageMeta(img)||{sx:0,sy:0,sw:img.naturalWidth,sh:img.naturalHeight,cx:img.naturalWidth/2,cy:img.naturalHeight/2};
        const tune=this.unitVisualTuning(u.type,u.team),fit=Math.min(baseW/m.sw,baseH/m.sh)*(tune.scale||1);
        const dw=m.sw*fit,dh=m.sh*fit,dx=cx-dw/2+(tune.offsetX||0)*baseW,dy=cy-dh/2+(tune.offsetY||0)*baseH;
        ctx.shadowBlur=u.type==='machine_king'?14:10;ctx.shadowColor='rgba(0,0,0,.28)';
        ctx.globalAlpha=alpha*(u.acted?.78:1);
        ctx.drawImage(img,m.sx,m.sy,m.sw,m.sh,dx,dy,dw,dh);
      }else{
        ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.arc(cx,cy,cell*.18,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;ctx.globalAlpha=alpha;
      if(u.shield){const sp=.5+.5*Math.sin(time/125);ctx.strokeStyle=`rgba(255,255,255,${.55+.35*sp})`;ctx.lineWidth=2.5+sp;ctx.beginPath();ctx.arc(cx,cy,frameR+.12*cell,0,Math.PI*2);ctx.stroke();}
      if(statuses.some(s=>s.id==='marked')){const rot=time/450;ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.strokeStyle='#ffd56b';ctx.lineWidth=2.4;ctx.strokeRect(-frameR*.82,-frameR*.82,frameR*1.64,frameR*1.64);ctx.restore();}
      if(statuses.some(s=>s.id==='invisible')){ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(150,245,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,frameR+.08*cell,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
      if(statuses.some(s=>s.id==='stun')){ctx.strokeStyle='#ffd56b';ctx.lineWidth=3;for(let i=0;i<3;i++){const a=time/260+i*Math.PI*2/3;ctx.beginPath();ctx.arc(cx+Math.cos(a)*frameR,cy+Math.sin(a)*frameR,3.5,0,Math.PI*2);ctx.stroke();}}
      if(u.uid===this.selectedUid){const sel=.5+.5*Math.sin(time/110);ctx.strokeStyle=`rgba(101,255,157,${.65+.35*sel})`;ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(cx,cy,frameR+.08*cell+sel*3,0,Math.PI*2);ctx.stroke();}
      if(u.type==='machine_king'){ctx.fillStyle='#fff';ctx.font=`bold ${cell*.14}px Segoe UI`;ctx.textAlign='center';ctx.fillText(`PH ${u.phases}`,cx,py+baseH+14);ctx.fillStyle='rgba(214,132,226,.95)';ctx.font=`bold ${cell*.11}px Segoe UI`;ctx.fillText('BOSS',cx,py-8);}
      if(u.type==='shield_node'){ctx.fillStyle='rgba(255,228,240,.92)';ctx.font=`bold ${cell*.1}px Segoe UI`;ctx.textAlign='center';ctx.fillText('WARD',cx,py-6);}
      ctx.restore();
    }
    roundRectPath(ctx,x,y,w,h,r){const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.lineTo(x+w-q,y);ctx.quadraticCurveTo(x+w,y,x+w,y+q);ctx.lineTo(x+w,y+h-q);ctx.quadraticCurveTo(x+w,y+h,x+w-q,y+h);ctx.lineTo(x+q,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-q);ctx.lineTo(x,y+q);ctx.quadraticCurveTo(x,y,x+q,y);ctx.closePath();}
    drawExplosion(ctx,cx,cy,cell,p,color){if(p<.18)return;const q=Math.min(1,(p-.18)/.62);ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<12;i++){const a=i*Math.PI/6+(i%2)*.13,r=cell*(.08+q*.48);ctx.strokeStyle=color;ctx.globalAlpha=(1-q)*(.85-(i%3)*.12);ctx.lineWidth=2+(i%2);ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*cell*.08,cy+Math.sin(a)*cell*.08);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}ctx.fillStyle=color;ctx.globalAlpha=(1-q)*.5;ctx.beginPath();ctx.arc(cx,cy,cell*(.08+.18*q),0,Math.PI*2);ctx.fill();ctx.restore();}
    drawRingFx(ctx,cx,cy,cell,p,color,kind){const q=Math.min(1,p*1.35);ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color;ctx.globalAlpha=(1-q)*.9;ctx.lineWidth=kind==='hit'?5:3;ctx.beginPath();ctx.arc(cx,cy,cell*(.25+.55*q),0,Math.PI*2);ctx.stroke();if(kind==='hit'){for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*cell*.2,cy+Math.sin(a)*cell*.2);ctx.lineTo(cx+Math.cos(a)*cell*(.35+.25*q),cy+Math.sin(a)*cell*(.35+.25*q));ctx.stroke();}}ctx.restore();}
    drawStatusFx(ctx,cx,cy,cell,p,id){const colors={marked:'#ffd56b',stun:'#ffd56b',invisible:'#7dc8ff',vulnerable:'#ff6c7c',guard:'#65ff9d'};const color=colors[id]||'#7dc8ff',q=Math.min(1,p*1.5);ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color;ctx.globalAlpha=(1-q)*.8;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,cell*(.3+.35*q),-Math.PI/2,-Math.PI/2+Math.PI*2*q);ctx.stroke();ctx.restore();}
    drawTelegraphFx(ctx,t,pad,cell,p){const q=Math.min(1,p*1.5);ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#ff4f70';ctx.globalAlpha=(1-q)*.95;ctx.lineWidth=10*(1-q)+2;ctx.beginPath();if(t.axis==='row'){const y=pad+(t.index+.5)*cell;ctx.moveTo(pad,y);ctx.lineTo(pad+cell*6,y);}else{const x=pad+(t.index+.5)*cell;ctx.moveTo(x,pad);ctx.lineTo(x,pad+cell*6);}ctx.stroke();ctx.restore();}
    drawAbilityFx(ctx,hint,pad,cell,p){const u=this.game.getUnit(hint.uid),target=hint.targetUid?this.game.getUnit(hint.targetUid):null;if(!u)return;const x=pad+(u.x+.5)*cell,y=pad+(u.y+.5)*cell,q=Math.min(1,p*1.35);ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=hint.kind==='promotion'?'#ffd56b':'#7dc8ff';ctx.globalAlpha=(1-q)*.85;ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x,y,cell*(.22+q*.55+i*.08),0,Math.PI*2);ctx.stroke();}if(target){const tx=pad+(target.x+.5)*cell,ty=pad+(target.y+.5)*cell;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();}ctx.restore();}
    drawPhaseSweep(ctx,W,p,phase){const q=Math.min(1,p*1.7);const x=-W*.35+W*1.7*q;ctx.save();const g=ctx.createLinearGradient(x-W*.2,0,x+W*.2,0);g.addColorStop(0,'rgba(67,232,255,0)');g.addColorStop(.5,phase==='player'?'rgba(67,232,255,.20)':'rgba(255,79,163,.20)');g.addColorStop(1,'rgba(67,232,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,W);ctx.restore();}
    drawFloatingText(ctx,cx,cy,cell,p,text,color,size=1){const q=Math.min(1,p*0.56),rise=cell*(.12+.18*q);ctx.save();ctx.globalAlpha=(1-q)*(.96-.1*q);ctx.translate(cx,cy-rise);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.round(cell*.14*size)}px Georgia`;ctx.lineWidth=6;ctx.strokeStyle='rgba(8,16,24,.88)';ctx.strokeText(text,0,0);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore();}

    showAchievement(){const id=this.game.lastUnlockedAchievement,a=D.achievements.find(x=>x.id===id);if(a){this.toast(`${this.t('Достижение','Achievement')}: ${this.lang()==='en'?a.nameEn:a.nameRu}`,true);delete this.game.lastUnlockedAchievement;}}
    toast(text,strong=false){const root=document.getElementById('toast-root'),el=document.createElement('div');el.className='toast';el.innerHTML=strong?`<strong>${text}</strong>`:text;root.appendChild(el);setTimeout(()=>el.remove(),3200);}
  }
  return {UI,AudioManager,MusicManager};
})();
