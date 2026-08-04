/* Core simulation for RPChess. No DOM dependencies. */
window.NC = (() => {
  'use strict';
  const D = window.NC_DATA;
  const SAVE_KEY = 'rpchess_fantasy_v1';
  const LEGACY_SAVE_KEY = 'neurochess_protocol_war_v2';
  const PROFILE_VERSION = 2;

  class RNG {
    constructor(seed) {
      let n = Number(seed) || 1;
      this.state = (n >>> 0) || 0x6d2b79f5;
    }
    nextU32() {
      let x = this.state;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.state = x >>> 0;
      return this.state;
    }
    float() { return this.nextU32() / 4294967296; }
    int(min, max) { return min + Math.floor(this.float() * (max - min + 1)); }
    pick(arr) { return arr[Math.floor(this.float() * arr.length)]; }
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = this.int(0, i); [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  }

  const clone = obj => JSON.parse(JSON.stringify(obj));
  const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const cellKey = (x,y) => `${x},${y}`;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  function defaultProfile() {
    return {
      version: PROFILE_VERSION,
      metaFragments: 0,
      victories: 0,
      runs: 0,
      bestAct: 0,
      unlockedCommanders: ['warlord'],
      unlockedArtifacts: D.artifacts.slice(0,6).map(a=>a.id),
      achievements: [],
      codex: ['process'],
      stats: {captures:0,battlesWon:0,battlesLost:0,abilities:0,events:0,shops:0,bosses:0,runsWon:0},
      settings: {language:'ru', masterVolume:0.55, musicVolume:0.42, uiScale:1, worldSeed:'', reduceMotion:false, colorblind:false, animationSpeed:1},
      currentRun: null
    };
  }

  function migrateProfile(raw) {
    const base = defaultProfile();
    if (!raw || typeof raw !== 'object') return base;
    const p = Object.assign(base, raw);
    p.stats = Object.assign(base.stats, raw.stats || {});
    p.settings = Object.assign(base.settings, raw.settings || {});
    p.unlockedCommanders = Array.isArray(raw.unlockedCommanders) ? raw.unlockedCommanders : ['warlord'];
    p.unlockedArtifacts = Array.isArray(raw.unlockedArtifacts) ? raw.unlockedArtifacts : base.unlockedArtifacts;
    p.achievements = Array.isArray(raw.achievements) ? raw.achievements : [];
    p.codex = Array.isArray(raw.codex) ? raw.codex : ['process'];
    p.version = PROFILE_VERSION;
    return p;
  }

  const Storage = {
    load() {
      try { return migrateProfile(JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY) || 'null')); }
      catch (e) { console.warn('Save corrupted, reset to defaults', e); return defaultProfile(); }
    },
    save(profile) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); return true; }
      catch (e) { console.error(e); return false; }
    },
    clear() { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_SAVE_KEY); },
    export(profile) { return JSON.stringify(profile, null, 2); },
    import(text) {
      const parsed = JSON.parse(text);
      const migrated = migrateProfile(parsed);
      this.save(migrated);
      return migrated;
    }
  };

  const AbilityDefs = {
    firewall:{cost:1, target:'self', nameRu:'Оберег',nameEn:'Ward',descRu:'Получить одноразовый магический щит.',descEn:'Gain a one-use magical shield.'},
    overjump:{cost:2,target:'self',nameRu:'Призрачный галоп',nameEn:'Phantom Gallop',descRu:'Сбросить действие и стать невидимым до следующего хода.',descEn:'Reset action and become invisible until next turn.'},
    diagonal_beam:{cost:2,target:'enemy_diagonal',nameRu:'Луч света',nameEn:'Radiant Ray',descRu:'Поразить первую видимую цель по диагонали без перемещения.',descEn:'Strike the first visible diagonal target without moving.'},
    fortify:{cost:1,target:'self',nameRu:'Каменная твердыня',nameEn:'Stone Fortress',descRu:'Получить щит и встать на охрану.',descEn:'Gain a shield and enter guard stance.'},
    command_reset:{cost:2,target:'ally',nameRu:'Королевский приказ',nameEn:'Royal Command',descRu:'Позволить союзной фигуре действовать повторно.',descEn:'Allow an allied piece to act again.'},
    rally:{cost:2,target:'none',nameRu:'Боевой клич',nameEn:'Battle Cry',descRu:'+1 ОП и щит двум союзникам.',descEn:'+1 CP and shield two allies.'},
    recompile:{cost:2,target:'none',nameRu:'Возвращение павшего',nameEn:'Raise the Fallen',descRu:'Вернуть последнюю павшую фигуру.',descEn:'Return the last fallen piece.'},
    fortress:{cost:2,target:'none',nameRu:'Неприступная крепость',nameEn:'Impregnable Fortress',descRu:'Все Ладьи получают щит и охрану.',descEn:'All Rooks gain shield and guard.'},
    mind_lock:{cost:2,target:'enemy',nameRu:'Печать провидца',nameEn:'Seer’s Seal',descRu:'Оглушить и проклясть противника.',descEn:'Stun and curse an enemy.'},
    rewind:{cost:2,target:'none',nameRu:'Переписать летопись',nameEn:'Rewrite History',descRu:'Отменить последнее действие игрока.',descEn:'Undo the last player action.'},
    overclock:{cost:2,target:'ally',nameRu:'Ярость',nameEn:'Frenzy',descRu:'Союзник действует повторно, но становится уязвимым.',descEn:'An ally acts again but becomes vulnerable.'},
    quantum_swap:{cost:2,target:'ally',nameRu:'Королевская рокировка',nameEn:'Royal Exchange',descRu:'Поменять Короля местами с союзником.',descEn:'Swap the King with an ally.'}
  };

  const UnitAbilities = {
    process:['firewall'], injector:['overjump'], scanner:['diagonal_beam'], bastion:['fortify'], battle_ai:['command_reset'], core:[]
  };

  function unitName(type, lang='ru') { const d=D.units[type]; return lang==='en'?d.nameEn:d.nameRu; }
  function commanderName(id, lang='ru') { const d=D.commanders.find(c=>c.id===id); return lang==='en'?d.nameEn:d.nameRu; }

  class Game {
    constructor(profile) {
      this.profile = profile || Storage.load();
      this.run = this.profile.currentRun || null;
      this.battle = this.run?.savedBattle || null;
      this.listeners = new Set();
      this.lastMessage = '';
    }
    onChange(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    emit(event='state'){this.listeners.forEach(fn=>fn(event,this));}
    save(){if(this.run){if(this.battle)this.run.savedBattle=this.battle;else delete this.run.savedBattle;}this.profile.currentRun=this.run;return Storage.save(this.profile);}
    language(){return this.profile.settings.language || 'ru';}
    tr(ru,en){return this.language()==='en'?en:ru;}

    startRun(commanderId, difficulty='normal', permadeath=false, seed=null, heroName='') {
      const commander = D.commanders.find(c=>c.id===commanderId) || D.commanders[0];
      const actualSeed = seed == null ? ((Date.now() ^ Math.floor(Math.random()*0xffffffff))>>>0) : (Number(seed)>>>0);
      const squad = commander.squad.map((type,i)=>({
        id:uid('veteran'), type, name:`${unitName(type,this.language())}-${i+1}`, level:1, xp:0, upgrade:null,
        wounded:false, captures:0, missions:0, history:[]
      }));
      this.run = {
        version:2, seed:actualSeed, rngState:actualSeed, commanderId:commander.id, heroName:String(heroName||'').trim().slice(0,28), difficulty, permadeath,
        act:1, step:0, maxSteps:5, credits:30, fragmentsEarned:0, maxSquad:5,
        squad, artifacts:[], choices:[], nodeHistory:[], currentNode:null, battleRecord:null,
        stats:{captures:0,losses:0,battles:0,abilities:0,events:0,shops:0,bought:0,maxCombo:0},
        flags:{protocolZeroUsed:false,freeAbilityUsed:false,necromancerUsed:false,rewindUsed:false},
        completed:false
      };
      this.profile.runs += 1;
      this.generateCampaignChoices();
      this.save();
      this.emit('run_started');
    }

    rng(){return new RNG(this.run ? this.run.rngState : 1);}
    commitRng(rng){if(this.run)this.run.rngState=rng.state;}

    generateCampaignChoices() {
      if (!this.run) return [];
      const rng = this.rng();
      let choices=[];
      if (this.run.step >= this.run.maxSteps) {
        choices=[this.makeNode('boss',rng,0)];
      } else {
        const pools = this.run.step===0 ? ['battle','battle','event'] : ['battle','elite','event','shop','repair','training','vault','bargain'];
        const count=this.run.step===0?2:3;
        for(let i=0;i<count;i++){
          let type=rng.pick(pools);
          if(i===0 && !choices.some(n=>n.type==='battle')) type = rng.float()<.65?'battle':type;
          choices.push(this.makeNode(type,rng,i));
        }
        if(rng.float()<0.06+this.run.act*.015){
          choices[choices.length-1]=this.makeNode('event',rng,9,true);
        }
      }
      this.commitRng(rng);
      this.run.choices=choices;
      return choices;
    }

    makeNode(type,rng,index,secret=false){
      const danger=this.run.act*2+this.run.step+(type==='elite'?2:0)+(type==='boss'?5:0);
      return {id:`a${this.run.act}s${this.run.step}n${index}_${rng.nextU32().toString(36)}`,type,danger,secret,seed:rng.nextU32()};
    }

    enterNode(nodeId){
      const node=this.run.choices.find(n=>n.id===nodeId);
      if(!node) throw new Error('Unknown campaign node');
      this.run.currentNode=clone(node);
      this.run.nodeHistory.push(clone(node));
      if(node.secret) this.unlockAchievement('secret_node');
      if(['battle','elite','boss'].includes(node.type)) return this.startBattle(node);
      this.save();this.emit('node_entered');
      return node.type;
    }

    completeNonBattleNode(){
      this.run.step += 1;
      this.run.currentNode=null;
      this.generateCampaignChoices();
      this.save();this.emit('node_complete');
    }

    makeBattleUnit(type,team,x,y,source=null,level=1){
      return {uid:uid(team),type,team,x,y,level,sourceId:source?source.id:null,name:source?source.name:unitName(type,this.language()),
        alive:true,acted:false,shield:0,statuses:[],captures:0,phases:type==='machine_king'?3:0,extraActions:0};
    }

    startBattle(node){
      const rng=new RNG(node.seed);
      const b={
        seed:node.seed, nodeType:node.type, size:6, phase:'player', round:1, cp:3, maxCp:3,
        units:[], blocked:[], hazards:[], telegraphs:[], log:[], casualties:[], enemyCasualties:[], reviveQueue:[],
        selectedUid:null,targeting:null, objectiveType:'eliminate', objectiveCell:null, surviveTarget:5,
        status:'active', result:null, capturesThisRound:0, actionHistory:[], bossPhase:0, firstAllyShieldConsumed:false,
        firstAbilityUsed:false, reinforcements:0
      };
      const cmd=D.commanders.find(c=>c.id===this.run.commanderId);
      if(cmd.id==='warlord') b.maxCp++;
      b.cp=b.maxCp;
      // Terrain: few blocked cells, never on setup lanes.
      const blockCount=node.type==='elite'?4:node.type==='boss'?2:2;
      for(let i=0;i<blockCount;i++){
        for(let guard=0;guard<20;guard++){
          const x=rng.int(1,4), y=rng.int(2,3), k=cellKey(x,y);
          if(!b.blocked.includes(k)){b.blocked.push(k);break;}
        }
      }
      // Objective variety for ordinary encounters.
      if(node.type==='battle'){
        const roll=rng.float();
        if(roll<.22){b.objectiveType='extract';b.objectiveCell={x:rng.int(1,4),y:rng.int(1,2)};}
        else if(roll<.36){b.objectiveType='survive';b.surviveTarget=4+this.run.act;}
      }
      // Player King and persistent squad.
      b.units.push(this.makeBattleUnit('core','player',2,5,null,1));
      const healthy=this.run.squad.filter(u=>!u.wounded).slice(0,this.run.maxSquad);
      const positions=[[1,5],[3,5],[0,4],[2,4],[4,4],[5,4]];
      healthy.forEach((s,i)=>b.units.push(this.makeBattleUnit(s.type,'player',positions[i][0],positions[i][1],s,s.level)));
      // Enemies.
      if(node.type==='boss'){
        b.objectiveType='boss';
        b.units.push(this.makeBattleUnit('machine_king','enemy',2,0,null,this.run.act+2));
        [[0,0],[5,0],[3,1]].forEach(p=>b.units.push(this.makeBattleUnit('shield_node','enemy',p[0],p[1],null,1)));
        b.units.push(this.makeBattleUnit('process','enemy',1,1,null,2));
        b.units.push(this.makeBattleUnit('process','enemy',4,1,null,2));
        b.bossPhase=1;
      } else {
        const count=clamp(3+this.run.act+(node.type==='elite'?2:0),4,8);
        const pool=this.enemyPoolForAct(this.run.act,node.type==='elite');
        const enemyPos=[[2,0],[1,0],[3,0],[0,1],[2,1],[4,1],[5,1],[1,1]];
        // Core only for elimination; extract/survive use combat pieces.
        if(b.objectiveType==='eliminate') b.units.push(this.makeBattleUnit('core','enemy',2,0,null,this.run.act));
        for(let i=0;i<count-(b.objectiveType==='eliminate'?1:0);i++){
          let pos=enemyPos[(i+(b.objectiveType==='eliminate'?1:0))%enemyPos.length];
          if(this.unitAtIn(b,pos[0],pos[1])) pos=enemyPos[(i+3)%enemyPos.length];
          b.units.push(this.makeBattleUnit(rng.pick(pool),'enemy',pos[0],pos[1],null,this.run.act+(node.type==='elite'?1:0)));
        }
      }
      this.battle=b;
      this.applyBattleStartEffects(rng);
      this.commitRng(rng);
      this.log(this.tr('Сражение началось. Seed: ','Battle started. Seed: ')+node.seed);
      this.save();
      this.emit('battle_started');
      return b;
    }

    enemyPoolForAct(act,elite){
      let pool=['process','process','injector','scanner'];
      if(act>=2) pool.push('bastion','scanner');
      if(act>=3) pool.push('battle_ai','bastion');
      if(elite) pool.push('battle_ai','bastion');
      return pool;
    }

    applyBattleStartEffects(rng){
      const b=this.battle, allies=b.units.filter(u=>u.team==='player'&&u.type!=='core');
      if(this.hasArtifact('shared_firewall')) rng.shuffle(allies).slice(0,2).forEach(u=>u.shield++);
      if(this.hasArtifact('echo_shield')) { const target=rng.pick(allies); if(target) target.shield++; }
      if(this.run.commanderId==='engineer') allies.filter(u=>u.type==='bastion').forEach(u=>u.shield++);
      if(this.hasArtifact('second_thread')) { const vets=allies.filter(u=>u.level>=2); if(vets.length) rng.pick(vets).extraActions=1; }
    }

    hasArtifact(id){return !!this.run && this.run.artifacts.includes(id);}
    log(text){ if(!this.battle)return; this.battle.log.push(text); if(this.battle.log.length>80)this.battle.log.shift(); this.lastMessage=text; }
    unitAt(x,y){return this.battle?this.unitAtIn(this.battle,x,y):null;}
    unitAtIn(b,x,y){return b.units.find(u=>u.alive&&u.x===x&&u.y===y)||null;}
    getUnit(uidValue){return this.battle?.units.find(u=>u.uid===uidValue&&u.alive)||null;}
    alive(team){return this.battle.units.filter(u=>u.alive&&(!team||u.team===team));}
    inside(x,y){return x>=0&&y>=0&&x<this.battle.size&&y<this.battle.size;}
    blocked(x,y){return this.battle.blocked.includes(cellKey(x,y));}

    snapshot(){const battle=clone(this.battle);battle.actionHistory=[];return clone({battle,runSquad:this.run.squad,runFlags:this.run.flags});}
    restoreSnapshot(s){this.battle=clone(s.battle);this.run.squad=clone(s.runSquad);this.run.flags=clone(s.runFlags);this.emit('rewind');}
    pushHistory(){this.battle.actionHistory.push(this.snapshot());if(this.battle.actionHistory.length>12)this.battle.actionHistory.shift();}

    movementFor(unit){
      const out=[]; if(!unit||!unit.alive)return out;
      const add=(x,y,ray=false)=>{
        if(!this.inside(x,y)||this.blocked(x,y)) return false;
        const t=this.unitAt(x,y);
        if(!t){out.push({x,y,capture:false});return true;}
        if(t.team!==unit.team && !this.isUntargetable(t,unit)) out.push({x,y,capture:true,targetUid:t.uid});
        return false;
      };
      const rays=(dirs)=>{for(const [dx,dy] of dirs){for(let n=1;n<6;n++){if(!add(unit.x+dx*n,unit.y+dy*n,true))break;}}};
      if(unit.type==='process'){
        const dir=unit.team==='player'?-1:1;
        if(this.inside(unit.x,unit.y+dir)&&!this.unitAt(unit.x,unit.y+dir)&&!this.blocked(unit.x,unit.y+dir))out.push({x:unit.x,y:unit.y+dir,capture:false});
        for(const dx of [-1,1]){const x=unit.x+dx,y=unit.y+dir,t=this.unitAt(x,y);if(this.inside(x,y)&&t&&t.team!==unit.team&&!this.isUntargetable(t,unit))out.push({x,y,capture:true,targetUid:t.uid});}
      } else if(unit.type==='injector'){
        [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(d=>add(unit.x+d[0],unit.y+d[1]));
      } else if(unit.type==='scanner') rays([[1,1],[1,-1],[-1,1],[-1,-1]]);
      else if(unit.type==='bastion') rays([[1,0],[-1,0],[0,1],[0,-1]]);
      else if(unit.type==='battle_ai') rays([[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);
      else if(unit.type==='core'||unit.type==='machine_king') for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy)add(unit.x+dx,unit.y+dy);
      return out;
    }

    isUntargetable(target,attacker){
      if(target.statuses.some(s=>s.id==='invisible')) return Math.max(Math.abs(target.x-attacker.x),Math.abs(target.y-attacker.y))>1;
      return false;
    }

    canAct(unit){return unit&&unit.alive&&!unit.acted&&!unit.statuses.some(s=>s.id==='stun')&&this.battle.phase===unit.team&&this.battle.status==='active';}

    move(uidValue,x,y){
      const b=this.battle, unit=this.getUnit(uidValue);
      if(!this.canAct(unit))return {ok:false,message:this.tr('Фигура уже действовала или сейчас чужой ход.','Unit already acted or it is not your turn.')};
      const legal=this.movementFor(unit).find(m=>m.x===x&&m.y===y);
      if(!legal)return {ok:false,message:this.tr('Недопустимое действие.','Illegal action.')};
      this.pushHistory();
      const ox=unit.x,oy=unit.y;
      let captured=false, target=null;
      if(legal.capture){
        target=this.getUnit(legal.targetUid);
        const result=this.resolveCapture(unit,target,{move:true});
        captured=result.killed||result.hitBoss;
        if(!result.moveAttacker){unit.x=ox;unit.y=oy;} else {unit.x=x;unit.y=y;}
      } else { unit.x=x;unit.y=y; }
      unit.acted=true;
      if(unit.extraActions>0){unit.extraActions--;unit.acted=false;}
      if(captured && this.run.commanderId==='aggressor')unit.acted=false;
      if(unit.type==='injector'&&this.hasArtifact('ghost_route')&&!legal.capture)this.addStatus(unit,'invisible',1);
      if(unit.type==='bastion'&&this.hasArtifact('corrosive_trace'))b.hazards.push({x:ox,y:oy,type:'corrosion',team:'enemy',turns:2});
      if(unit.type==='process')this.checkPromotion(unit);
      this.resolveCellEffects(unit);
      this.checkBattleEnd();
      this.save();this.emit('battle_changed');
      return {ok:true,captured,target};
    }

    resolveCapture(attacker,target,options={move:true}){
      if(!target||!target.alive)return {killed:false,moveAttacker:false};
      if(target.type==='machine_king'){
        const nodes=this.alive('enemy').filter(u=>u.type==='shield_node');
        if(nodes.length){this.log(this.tr('Магические обереги не позволяют повредить Тёмного короля.','Arcane wards protect the Dark King.'));return {killed:false,moveAttacker:false};}
        target.phases--;
        this.log(this.tr(`Тёмный король теряет фазу. Осталось: ${target.phases}.`,`Dark King loses a phase. Remaining: ${target.phases}.`));
        if(target.phases<=0){this.killUnit(target,attacker);return {killed:true,hitBoss:true,moveAttacker:true};}
        this.advanceBossPhase(target);
        return {killed:false,hitBoss:true,moveAttacker:false};
      }
      if(target.shield>0){target.shield--;this.log(this.tr(`Щит «${target.name}» поглощает взятие.`,`The shield of “${target.name}” absorbs the capture.`));return {killed:false,moveAttacker:false};}
      const guard=this.findGuard(target);
      if(guard){guard.shield=Math.max(0,guard.shield-1);this.log(this.tr(`Ладья защищает «${target.name}».`,`A Rook guards “${target.name}”.`));return {killed:false,moveAttacker:false};}
      this.killUnit(target,attacker);
      return {killed:true,moveAttacker:options.move!==false};
    }

    findGuard(target){
      return this.alive(target.team).find(u=>u.type==='bastion'&&u.uid!==target.uid&&u.statuses.some(s=>s.id==='guard')&&Math.abs(u.x-target.x)+Math.abs(u.y-target.y)===1&&u.shield>0)||null;
    }

    killUnit(target,attacker=null){
      if(!target.alive)return;
      target.alive=false;
      if(attacker){attacker.captures++; if(attacker.team==='player'){this.run.stats.captures++;this.profile.stats.captures++;this.battle.capturesThisRound++;this.unlockAchievement('first_blood');if(target.statuses.some(s=>s.id==='marked'))this.unlockAchievement('marked_kill');}}
      if(target.team==='player'){
        this.battle.casualties.push(target.sourceId||target.uid);this.run.stats.losses++;
        if(this.hasArtifact('death_cache'))this.battle.cp=Math.min(this.battle.maxCp+2,this.battle.cp+1);
        if(this.run.commanderId==='necromancer'&&!this.run.flags.necromancerUsed&&target.type!=='core'){
          this.run.flags.necromancerUsed=true;this.battle.reviveQueue.push({type:target.type,sourceId:target.sourceId,name:target.name,rounds:2,level:target.level});
        }
      } else this.battle.enemyCasualties.push(target.uid);
      this.log(this.tr(`${attacker?attacker.name:'Опасность'} уничтожает ${target.name}.`,`${attacker?attacker.name:'Hazard'} destroys ${target.name}.`));
    }

    addStatus(unit,id,turns=1){
      const existing=unit.statuses.find(s=>s.id===id);if(existing)existing.turns=Math.max(existing.turns,turns);else unit.statuses.push({id,turns});
    }
    removeStatus(unit,id){unit.statuses=unit.statuses.filter(s=>s.id!==id);}

    checkPromotion(unit){
      const threshold=this.hasArtifact('early_promotion')?(unit.team==='player'?1:4):(unit.team==='player'?0:5);
      if(unit.y===threshold){
        if(unit.team==='player'){this.battle.pendingPromotionUid=unit.uid;this.unlockAchievement('promotion');}
        else unit.type='scanner';
      }
    }
    promote(uidValue,type){
      const u=this.getUnit(uidValue);if(!u||u.type!=='process')return false;
      if(!['injector','scanner','bastion','battle_ai'].includes(type))return false;
      u.type=type;u.name=unitName(type,this.language());delete this.battle.pendingPromotionUid;this.log(this.tr(`Пешка превращена: ${u.name}.`,`Pawn promoted: ${u.name}.`));this.save();this.emit('battle_changed');return true;
    }

    resolveCellEffects(unit){
      const h=this.battle.hazards.find(z=>z.x===unit.x&&z.y===unit.y&&z.team===unit.team);
      if(h){if(unit.shield>0)unit.shield--;else this.killUnit(unit,null);}
      if(this.battle.objectiveType==='extract'&&unit.team==='player'&&this.battle.objectiveCell&&unit.x===this.battle.objectiveCell.x&&unit.y===this.battle.objectiveCell.y){this.winBattle();}
    }

    getAbilities(unit){
      if(!unit)return[];
      const ids=(UnitAbilities[unit.type]||[]).slice();
      if(unit.type==='core'){
        const cmd=D.commanders.find(c=>c.id===this.run.commanderId);if(cmd)ids.push(cmd.ability);
        if(this.hasArtifact('quantum_swap'))ids.push('quantum_swap');
      }
      return ids.map(id=>AbilityDefs[id]||{id,cost:1,target:'none',nameRu:id,nameEn:id,descRu:'',descEn:''}).map(x=>Object.assign({id:Object.keys(AbilityDefs).find(k=>AbilityDefs[k]===x)||x.id},x));
    }

    abilityCost(id){
      if(this.hasArtifact('forked_command')&&!this.battle.firstAbilityUsed)return 0;
      return (AbilityDefs[id]?.cost??1);
    }

    useAbility(userUid,id,targetUid=null){
      const b=this.battle,user=this.getUnit(userUid),def=AbilityDefs[id];
      if(!def||!this.canAct(user))return {ok:false,message:this.tr('Способность сейчас недоступна.','Ability unavailable now.')};
      const allowed=this.getAbilities(user).some(a=>a.id===id);
      if(!allowed)return {ok:false,message:this.tr('У фигуры нет этой способности.','This unit lacks that ability.')};
      const cost=this.abilityCost(id);if(b.cp<cost)return {ok:false,message:this.tr('Недостаточно очков приказа.','Not enough Order Points.')};
      if(['enemy','enemy_diagonal','ally'].includes(def.target)&&!targetUid){b.targeting={userUid,id,target:def.target};this.emit('battle_changed');return {ok:true,targeting:true};}
      if(id==='rewind'){
        if(this.run.flags.rewindUsed||b.actionHistory.length<1)return {ok:false,message:this.tr('Откат уже использован или истории нет.','Rewind used or no history available.')};
        const previous=b.actionHistory[b.actionHistory.length-1];
        this.restoreSnapshot(previous);
        this.run.flags.rewindUsed=true;
        this.battle.cp=Math.max(0,this.battle.cp-cost);
        this.battle.firstAbilityUsed=true;
        this.run.stats.abilities++;this.profile.stats.abilities++;this.unlockAchievementByStat();
        this.save();this.emit('battle_changed');return {ok:true,rewound:true};
      }
      this.pushHistory();
      const result=this.executeAbility(user,id,targetUid);
      if(!result.ok){b.actionHistory.pop();return result;}
      b.cp-=cost;b.firstAbilityUsed=true;user.acted=(id!=='overjump');this.run.stats.abilities++;this.profile.stats.abilities++;this.unlockAchievementByStat();
      this.checkBattleEnd();this.save();this.emit('battle_changed');return result;
    }

    executeAbility(user,id,targetUid){
      const b=this.battle,target=targetUid?this.getUnit(targetUid):null;
      if(id==='firewall'){user.shield++;this.log(this.tr('Файрвол активирован.','Firewall activated.'));}
      else if(id==='overjump'){user.acted=false;this.addStatus(user,'invisible',1);this.log(this.tr('Конь исчезает в призрачном тумане.','The Knight vanishes into phantom mist.'));}
      else if(id==='diagonal_beam'){
        if(!target||target.team===user.team||Math.abs(target.x-user.x)!==Math.abs(target.y-user.y)||!this.lineClear(user,target))return {ok:false,message:this.tr('Цель должна находиться на чистой диагонали.','Target must be on a clear diagonal.')};
        this.resolveCapture(user,target,{move:false});this.log(this.tr('Слон выпускает луч света по диагонали.','The Bishop casts a radiant diagonal ray.'));
      }
      else if(id==='fortify'){user.shield++;this.addStatus(user,'guard',2);this.log(this.tr('Ладья встаёт на охрану.','The Rook enters guard stance.'));}
      else if(id==='command_reset'){
        if(!target||target.team!==user.team||target.uid===user.uid)return {ok:false,message:this.tr('Выберите другого союзника.','Choose another ally.')};target.acted=false;this.log(this.tr(`${target.name} получает новый приказ.`,`${target.name} receives a new order.`));
      }
      else if(id==='rally'){
        b.cp=Math.min(b.maxCp+2,b.cp+1);this.alive('player').filter(u=>u.type!=='core').slice(0,2).forEach(u=>u.shield++);this.log(this.tr('Полководец синхронизирует строй.','The Warlord synchronizes the formation.'));
      }
      else if(id==='recompile'){
        const dead=b.casualties[b.casualties.length-1];if(!dead)return {ok:false,message:this.tr('Нет уничтоженной фигуры для возврата.','No destroyed unit to restore.')};
        const src=this.run.squad.find(s=>s.id===dead);const spot=this.findFreeNear(user.x,user.y);if(!src||!spot)return {ok:false,message:this.tr('Нет свободной клетки рядом с Королём.','No free cell near the King.')};
        b.units.push(this.makeBattleUnit(src.type,'player',spot.x,spot.y,src,src.level));b.casualties=b.casualties.filter(idv=>idv!==dead);this.log(this.tr(`${src.name} возвращён из царства павших.`,`${src.name} raised from the fallen.`));
      }
      else if(id==='fortress'){this.alive('player').filter(u=>u.type==='bastion').forEach(u=>{u.shield++;this.addStatus(u,'guard',2);});this.log(this.tr('Рунный мастер воздвигает крепость.','The Runesmith raises a fortress.'));}
      else if(id==='mind_lock'){
        if(!target||target.team!=='enemy')return {ok:false,message:this.tr('Выберите противника.','Choose an enemy.')};this.addStatus(target,'stun',1);this.addStatus(target,'marked',2);this.log(this.tr(`${target.name} заблокирован.`,`${target.name} is mind-locked.`));
      }
      else if(id==='overclock'){
        if(!target||target.team!=='player')return {ok:false,message:this.tr('Выберите союзника.','Choose an ally.')};target.acted=false;this.addStatus(target,'vulnerable',2);this.log(this.tr(`${target.name} разогнан.`,`${target.name} overclocked.`));
      }
      else if(id==='quantum_swap'){
        if(!target||target.team!=='player'||target.uid===user.uid)return {ok:false,message:this.tr('Выберите союзника.','Choose an ally.')};const x=user.x,y=user.y;user.x=target.x;user.y=target.y;target.x=x;target.y=y;this.log(this.tr('Квантовый обмен выполнен.','Quantum swap complete.'));
      }
      else return {ok:false,message:'Unknown ability'};
      return {ok:true};
    }

    lineClear(a,b){
      const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);let x=a.x+dx,y=a.y+dy;
      while(x!==b.x||y!==b.y){if(this.blocked(x,y)||this.unitAt(x,y))return false;x+=dx;y+=dy;}return true;
    }
    findFreeNear(x,y){for(let r=1;r<=2;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){const nx=x+dx,ny=y+dy;if(this.inside(nx,ny)&&!this.blocked(nx,ny)&&!this.unitAt(nx,ny))return{x:nx,y:ny};}return null;}
    cancelTargeting(){if(this.battle){this.battle.targeting=null;this.emit('battle_changed');}}
    targetAbility(targetUid){const t=this.battle?.targeting;if(!t)return{ok:false};this.battle.targeting=null;return this.useAbility(t.userUid,t.id,targetUid);}

    endPlayerTurn(){
      const b=this.battle;if(!b||b.phase!=='player'||b.status!=='active')return;
      b.phase='enemy';b.targeting=null;this.resolveTelegraphs();
      if(b.status!=='active'){this.emit('battle_changed');return;}
      this.enemyTurn();
    }

    resolveTelegraphs(){
      const b=this.battle;if(!b.telegraphs.length)return;
      for(const tg of b.telegraphs){
        const victims=this.alive('player').filter(u=>(tg.axis==='row'?u.y===tg.index:u.x===tg.index));
        victims.forEach(u=>{if(u.shield>0)u.shield--;else this.killUnit(u,null);});
        this.log(this.tr(`Лазерная линия поражает ${tg.axis==='row'?'ряд':'колонну'} ${tg.index+1}.`,`Laser strikes ${tg.axis} ${tg.index+1}.`));
      }
      b.telegraphs=[];this.checkBattleEnd();
    }

    enemyTurn(){
      const b=this.battle;if(!b||b.status!=='active')return;
      this.tickStatuses('enemy');
      const enemies=this.alive('enemy').filter(u=>!['shield_node','machine_king'].includes(u.type));
      for(const enemy of enemies){
        if(b.status!=='active')break;
        if(enemy.statuses.some(s=>s.id==='stun')){enemy.acted=true;continue;}
        const moves=this.movementFor(enemy);
        if(!moves.length){enemy.acted=true;continue;}
        let best=null,bestScore=-Infinity;
        for(const m of moves){
          let score=0;const target=m.targetUid?this.getUnit(m.targetUid):null;
          if(target){score+=(D.units[target.type]?.value||1)*100;if(target.type==='core')score+=10000;if(target.shield)score-=40;}
          const playerCore=this.alive('player').find(u=>u.type==='core');if(playerCore)score-=Math.abs(m.x-playerCore.x)*4+Math.abs(m.y-playerCore.y)*4;
          const jitter=((enemy.uid.length*31+m.x*17+m.y*13+b.round*7)%11)/10;score+=jitter;
          if(score>bestScore){bestScore=score;best=m;}
        }
        if(best){
          const oldx=enemy.x,oldy=enemy.y;
          if(best.capture){const target=this.getUnit(best.targetUid);const r=this.resolveCapture(enemy,target,{move:true});if(r.moveAttacker){enemy.x=best.x;enemy.y=best.y;}else{enemy.x=oldx;enemy.y=oldy;}}
          else {enemy.x=best.x;enemy.y=best.y;}
          enemy.acted=true;this.resolveCellEffects(enemy);this.checkBattleEnd();
        }
      }
      if(b.status==='active'&&this.alive('enemy').some(u=>u.type==='machine_king'))this.bossAction();
      if(b.status==='active'&&b.objectiveType==='survive')this.spawnReinforcement();
      if(b.status==='active')this.startPlayerRound();
      this.save();this.emit('battle_changed');
    }

    bossAction(){
      const b=this.battle,boss=this.alive('enemy').find(u=>u.type==='machine_king');if(!boss)return;
      const rng=new RNG((b.seed+b.round*7919+boss.phases*101)>>>0);
      const axis=rng.float()<.5?'row':'col';const count=boss.phases<=1?2:1;
      for(let i=0;i<count;i++)b.telegraphs.push({axis,index:rng.int(1,4)});
      if(b.round%2===0){const spot=this.findEnemySpawn();if(spot)b.units.push(this.makeBattleUnit('process','enemy',spot.x,spot.y,null,this.run.act+1));}
      this.log(this.tr('Тёмный король отмечает линии теневого пламени.','The Dark King marks lines of shadowfire.'));
    }

    advanceBossPhase(boss){
      this.battle.bossPhase++;
      const spots=[[0,1],[5,1],[1,0],[4,0]];
      spots.slice(0,Math.min(2,this.battle.bossPhase)).forEach(p=>{if(!this.unitAt(p[0],p[1]))this.battle.units.push(this.makeBattleUnit('shield_node','enemy',p[0],p[1],null,1));});
      boss.shield=1;
    }

    findEnemySpawn(){for(const p of [[0,0],[5,0],[0,1],[5,1],[2,1],[3,1]])if(!this.unitAt(p[0],p[1])&&!this.blocked(p[0],p[1]))return{x:p[0],y:p[1]};return null;}
    spawnReinforcement(){const spot=this.findEnemySpawn();if(spot&&this.battle.reinforcements<4){this.battle.reinforcements++;this.battle.units.push(this.makeBattleUnit(this.battle.round>3?'injector':'process','enemy',spot.x,spot.y,null,this.run.act));this.log(this.tr('Прибывает подкрепление.','Reinforcement arrives.'));}}

    startPlayerRound(){
      const b=this.battle;b.round++;b.phase='player';b.cp=Math.min(b.maxCp,b.cp+Math.ceil(b.maxCp*.75));b.capturesThisRound=0;
      this.tickStatuses('player');
      this.alive().forEach(u=>u.acted=false);
      if(this.hasArtifact('second_thread')&&b.round%2===0){const vets=this.alive('player').filter(u=>u.level>=2&&u.type!=='core');if(vets.length)vets[0].extraActions=1;}
      this.processRevives();
      b.hazards.forEach(h=>h.turns--);b.hazards=b.hazards.filter(h=>h.turns>0);
      if(b.objectiveType==='survive'&&b.round>b.surviveTarget)this.winBattle();
    }

    tickStatuses(team){
      this.alive(team).forEach(u=>{u.statuses.forEach(s=>s.turns--);u.statuses=u.statuses.filter(s=>s.turns>0);});
    }
    processRevives(){
      const b=this.battle;for(const r of b.reviveQueue)r.rounds--;
      const ready=b.reviveQueue.filter(r=>r.rounds<=0);b.reviveQueue=b.reviveQueue.filter(r=>r.rounds>0);
      for(const r of ready){const core=this.alive('player').find(u=>u.type==='core'),spot=core&&this.findFreeNear(core.x,core.y),src=this.run.squad.find(s=>s.id===r.sourceId);if(spot&&src){b.units.push(this.makeBattleUnit(r.type,'player',spot.x,spot.y,src,r.level));b.casualties=b.casualties.filter(idv=>idv!==r.sourceId);this.log(this.tr(`${r.name} возвращается из Некросети.`,`${r.name} returns from the Necrogrid.`));}}
    }

    checkBattleEnd(){
      const b=this.battle;if(!b||b.status!=='active')return;
      const playerCore=this.alive('player').find(u=>u.type==='core');if(!playerCore){this.loseBattle();return;}
      if(b.objectiveType==='boss'){if(!this.alive('enemy').some(u=>u.type==='machine_king'))this.winBattle();return;}
      if(b.objectiveType==='eliminate'){
        const enemyCore=this.alive('enemy').find(u=>u.type==='core');if(!enemyCore||this.alive('enemy').length===0)this.winBattle();
      }
      if(b.capturesThisRound>=3){this.run.stats.maxCombo=Math.max(this.run.stats.maxCombo,b.capturesThisRound);this.unlockAchievement('capture_chain');}
    }
    winBattle(){if(this.battle.status!=='active')return;this.battle.status='won';this.battle.result='victory';this.log(this.tr('МИССИЯ ВЫПОЛНЕНА','MISSION COMPLETE'));this.finalizeBattle(true);}
    loseBattle(){if(this.battle.status!=='active')return;if(this.hasArtifact('protocol_zero')&&!this.run.flags.protocolZeroUsed){this.run.flags.protocolZeroUsed=true;const node=clone(this.run.currentNode);this.log(this.tr('Печать феникса возвращает время к началу боя.','The Phoenix Seal rewinds the battle.'));this.startBattle(node);return;}this.battle.status='lost';this.battle.result='defeat';this.log(this.tr('СРАЖЕНИЕ ПРОИГРАНО','BATTLE LOST'));this.finalizeBattle(false);}

    finalizeBattle(victory){
      const b=this.battle;this.run.stats.battles++;this.run.battleRecord={victory,node:clone(this.run.currentNode),casualties:clone(b.casualties),rounds:b.round};
      if(victory){
        this.profile.stats.battlesWon++;this.run.credits+=10+this.run.act*5+(b.nodeType==='elite'?15:0)+(b.nodeType==='boss'?25:0);
        const casualties=new Set(b.casualties);
        for(const s of this.run.squad){
          const participated=b.units.some(u=>u.sourceId===s.id);if(participated){s.missions++;if(casualties.has(s.id)){if(this.run.permadeath)this.run.squad=this.run.squad.filter(x=>x.id!==s.id);else s.wounded=true;}else{s.xp+=b.nodeType==='elite'?2:1;this.checkLevel(s);}}
        }
        if(this.hasArtifact('memory_of_home')){const w=this.run.squad.find(s=>s.wounded);if(w)w.wounded=false;}
        this.unlockAchievement('first_win');if(!b.casualties.length)this.unlockAchievement('flawless');
        if(this.alive('player').length===1)this.unlockAchievement('survivor');
        if(b.nodeType==='boss'){this.profile.stats.bosses++;this.unlockAchievement('boss_one');this.profile.codex.push('machine_king');}
        this.run.pendingRewards=this.generateRewards(b.nodeType);
      } else {
        this.profile.stats.battlesLost++;
      }
      this.unlockAchievement('seed_keeper');this.save();
    }

    checkLevel(s){
      const thresholds=[0,2,5,9,14];
      while(s.level<thresholds.length&&s.xp>=thresholds[s.level]){s.level++;if(s.level>=3)this.unlockAchievement('veteran');}
    }

    generateRewards(nodeType){
      const rng=this.rng();const rewards=[];
      const unlocked=D.artifacts.filter(a=>this.profile.unlockedArtifacts.includes(a.id)&&!this.run.artifacts.includes(a.id));
      if(unlocked.length)rewards.push({type:'artifact',artifactId:rng.pick(unlocked).id});
      rewards.push({type:'credits',amount:nodeType==='boss'?45:nodeType==='elite'?30:20});
      const candidates=this.run.squad.filter(s=>!s.wounded);if(candidates.length)rewards.push({type:'upgrade',unitId:rng.pick(candidates).id});
      if(this.run.squad.length<this.run.maxSquad&&(nodeType==='boss'||rng.float()<.28))rewards.push({type:'recruit',unitType:rng.pick(['process','injector','scanner','bastion','battle_ai'])});
      this.commitRng(rng);return rng.shuffle(rewards).slice(0,3);
    }

    chooseReward(index){
      const r=this.run.pendingRewards?.[index];if(!r)return false;
      if(r.type==='artifact'){this.run.artifacts.push(r.artifactId);if(this.run.artifacts.length>=6)this.unlockAchievement('collector');}
      else if(r.type==='credits'){this.run.credits+=r.amount;if(this.run.credits>=100)this.unlockAchievement('rich');}
      else if(r.type==='upgrade'){const s=this.run.squad.find(u=>u.id===r.unitId);if(s){s.xp+=2;this.checkLevel(s);s.upgrade=s.upgrade||this.randomUpgrade(s.type);}}
      else if(r.type==='recruit'){if(this.run.squad.length>=this.run.maxSquad){this.run.credits+=20;}else this.run.squad.push({id:uid('veteran'),type:r.unitType,name:`${unitName(r.unitType,this.language())}-${this.run.squad.length+1}`,level:1,xp:0,upgrade:null,wounded:false,captures:0,missions:0,history:[]});}
      delete this.run.pendingRewards;
      const wasBoss=this.run.currentNode?.type==='boss';
      if(wasBoss){this.run.act++;this.run.step=0;if(this.run.act>3){this.completeRun(true);return true;}}
      else this.run.step++;
      this.run.currentNode=null;this.battle=null;this.generateCampaignChoices();this.save();this.emit('reward_chosen');return true;
    }

    randomUpgrade(type){
      const map={process:['adaptive_shield','linked_process'],injector:['afterimage','impact'],scanner:['wide_beam','cleanse'],bastion:['mobile_wall','guardian'],battle_ai:['dual_thread','command_range']};
      const rng=this.rng(),v=rng.pick(map[type]||['optimized']);this.commitRng(rng);return v;
    }

    resolveEvent(choiceIndex){
      const node=this.run.currentNode,rng=new RNG(node.seed);let event=node.secret?D.events.find(e=>e.secret):rng.pick(D.events.filter(e=>!e.secret));const choice=event.choices[choiceIndex];
      if(!choice)return false;if(choice.cost&&this.run.credits<choice.cost)return false;if(choice.cost)this.run.credits-=choice.cost;
      this.applyEffect(choice.effect||{},rng);this.run.stats.events++;this.profile.stats.events++;this.unlockAchievementByStat();this.completeNonBattleNode();return true;
    }
    getCurrentEvent(){if(!this.run.currentNode)return null;const rng=new RNG(this.run.currentNode.seed);return this.run.currentNode.secret?D.events.find(e=>e.secret):rng.pick(D.events.filter(e=>!e.secret));}

    applyEffect(e,rng=this.rng()){
      if(e.credits)this.run.credits+=e.credits;if(e.meta){this.profile.metaFragments+=e.meta;this.run.fragmentsEarned+=e.meta;}
      if(e.upgradeRandom){const s=rng.pick(this.run.squad.filter(x=>!x.wounded));if(s){s.xp+=e.upgradeRandom*2;this.checkLevel(s);}}
      if(e.woundRandom){const s=rng.pick(this.run.squad.filter(x=>!x.wounded));if(s)s.wounded=true;}
      if(e.artifactRandom){const pool=D.artifacts.filter(a=>this.profile.unlockedArtifacts.includes(a.id)&&!this.run.artifacts.includes(a.id));if(pool.length)this.run.artifacts.push(rng.pick(pool).id);}
      if(e.legendaryRandom){const pool=D.artifacts.filter(a=>a.rarity==='legendary'&&!this.run.artifacts.includes(a.id));if(pool.length)this.run.artifacts.push(rng.pick(pool).id);}
      if(e.maxSquad)this.run.maxSquad=clamp(this.run.maxSquad+e.maxSquad,3,7);
      if(e.codex&&!this.profile.codex.includes(e.codex))this.profile.codex.push(e.codex);
      if(e.halfCredits)this.run.credits=Math.floor(this.run.credits/2);
      if(e.healAll)this.run.squad.forEach(s=>s.wounded=false);
      if(e.tradeArtifact&&this.run.artifacts.length)this.run.artifacts.splice(rng.int(0,this.run.artifacts.length-1),1);
      this.commitRng(rng);
    }

    getShopStock(){
      const rng=new RNG(this.run.currentNode.seed);const arts=rng.shuffle(D.artifacts.filter(a=>this.profile.unlockedArtifacts.includes(a.id)&&!this.run.artifacts.includes(a.id))).slice(0,3);
      return [
        ...arts.map(a=>({type:'artifact',id:a.id,price:a.rarity==='common'?28:a.rarity==='rare'?42:a.rarity==='epic'?60:85})),
        {type:'heal',price:18},...(this.run.squad.length<this.run.maxSquad?[{type:'recruit',unitType:rng.pick(['process','injector','scanner','bastion']),price:35}]:[])
      ];
    }
    buyShopItem(item){
      if(this.run.credits<item.price)return false;this.run.credits-=item.price;
      if(item.type==='artifact')this.run.artifacts.push(item.id);
      else if(item.type==='heal'){const w=this.run.squad.find(s=>s.wounded);if(w)w.wounded=false;else this.run.credits+=item.price;}
      else if(item.type==='recruit'){if(this.run.squad.length>=this.run.maxSquad)return false;this.run.squad.push({id:uid('veteran'),type:item.unitType,name:`${unitName(item.unitType,this.language())}-${this.run.squad.length+1}`,level:1,xp:0,upgrade:null,wounded:false,captures:0,missions:0,history:[]});}
      this.run.stats.bought++;if(this.run.stats.bought>=5)this.unlockAchievement('shopper');this.save();this.emit('shop');return true;
    }
    leaveShop(){this.run.stats.shops++;this.profile.stats.shops++;this.completeNonBattleNode();}
    repairUnit(id){const s=this.run.squad.find(x=>x.id===id);if(!s||!s.wounded)return false;s.wounded=false;this.completeNonBattleNode();return true;}
    trainUnit(id){const s=this.run.squad.find(x=>x.id===id);if(!s)return false;s.xp+=2;this.checkLevel(s);s.upgrade=s.upgrade||this.randomUpgrade(s.type);this.completeNonBattleNode();return true;}
    resolveVault(risky=false){const rng=new RNG(this.run.currentNode.seed);if(risky&&rng.float()<.35){const s=rng.pick(this.run.squad.filter(x=>!x.wounded));if(s)s.wounded=true;}this.run.credits+=risky?45:22;this.applyEffect({artifactRandom:risky?1:0},rng);this.completeNonBattleNode();}
    resolveBargain(kind){if(kind==='power'){this.applyEffect({upgradeRandom:2,woundRandom:1});}else if(kind==='wealth'){this.run.credits+=70;this.run.maxSquad=Math.max(3,this.run.maxSquad-1);}else{this.profile.metaFragments+=4;this.run.credits=0;}this.completeNonBattleNode();}

    completeRun(victory){
      this.run.completed=true;const earned=(victory?8:2)+(this.run.act-1)*3+this.run.fragmentsEarned;this.profile.metaFragments+=earned;this.profile.bestAct=Math.max(this.profile.bestAct,this.run.act);
      if(victory){this.profile.victories++;this.profile.stats.runsWon++;this.unlockAchievement('run_win');if(this.run.difficulty==='hard')this.unlockAchievement('hard_win');if(this.run.permadeath)this.unlockAchievement('iron_win');}
      this.unlockProgression();this.run.finalEarned=earned;this.profile.currentRun=this.run;Storage.save(this.profile);this.emit('run_complete');
    }
    abandonRun(){if(this.run)this.completeRun(false);}
    returnToMenuAfterRun(){this.run=null;this.battle=null;this.profile.currentRun=null;this.save();this.emit('menu');}

    unlockProgression(){
      for(const c of D.commanders)if(this.profile.victories>=c.unlock&&!this.profile.unlockedCommanders.includes(c.id))this.profile.unlockedCommanders.push(c.id);
      const artCount=Math.min(D.artifacts.length,6+this.profile.victories*2);D.artifacts.slice(0,artCount).forEach(a=>{if(!this.profile.unlockedArtifacts.includes(a.id))this.profile.unlockedArtifacts.push(a.id);});
      if(this.profile.unlockedCommanders.length===D.commanders.length)this.unlockAchievement('all_commanders');
    }

    unlockAchievementByStat(){
      if(this.profile.stats.abilities>=25)this.unlockAchievement('ability_master');
      if(this.profile.stats.events>=8)this.unlockAchievement('event_horizon');
    }
    unlockAchievement(id){if(!this.profile.achievements.includes(id)){this.profile.achievements.push(id);this.lastUnlockedAchievement=id;this.emit('achievement');}}

    setSettings(patch){Object.assign(this.profile.settings,patch);this.save();this.emit('settings');}
  }

  return { RNG, Storage, Game, AbilityDefs, UnitAbilities, defaultProfile, clone, unitName, commanderName, SAVE_KEY };
})();
