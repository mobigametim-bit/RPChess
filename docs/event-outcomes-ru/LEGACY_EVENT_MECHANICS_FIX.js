const LEGACY_EVENT_FIX=(()=>{
function parsedEffects(raw,choice){
 const out=[],unknown=[];
 for(const text of String(raw||"").split(",").map(x=>x.trim()).filter(Boolean)){
 if(/без эффекта|шанс без побочного эффекта/i.test(text))continue;
 let m=text.match(/^([+-]\d+)\s+Gold/i);if(m){out.push({type:"gold",delta:+m[1]});continue;}
 m=text.match(/^([+-]\d+)\s+Suppl(?:y|ies)/i);if(m){out.push({type:"supplies",delta:+m[1]});continue;}
 if(/^recruit$/i.test(text)){out.push({type:"recruit"});continue;}
 m=text.match(/^start(Skirmish|Battle)\s*([+-]\d+)?/i);if(m){out.push({type:"combat",combatType:m[1].toLowerCase(),threatMod:+(m[2]||0)});continue;}
 if(/случайн.*non-King\s+wound/i.test(text)){out.push({type:"wound",target:"randomNonKing"});continue;}
 if(/случайн.*non-King\s+death/i.test(text)){out.push({type:"death",target:"randomNonKing"});continue;}
 m=text.match(/выбранн.*\b(Pawn|Knight|Bishop|Rook|Queen)\b\s+(wound|death)/i);if(m){out.push({type:m[2].toLowerCase(),target:"roleHero",role:m[1].toLowerCase()});continue;}
 if(/\bKing\b.*wound|wound.*\bKing\b/i.test(text)){out.push({type:"wound",target:"king"});continue;}
 if(/\bKing\b.*death|death.*\bKing\b/i.test(text)){out.push({type:"death",target:"king",kingRisk:!!choice.kingRisk});continue;}
 unknown.push(text);
 }
 return {effects:out,unknown};
}
function getRawEvents(code){let i=code.indexOf("Object.freeze(");i=code.indexOf("[",i);let depth=0,start=i,q=false,esc=false;for(;i<code.length;i++){let c=code[i];if(q){if(esc)esc=false;else if(c==="\\")esc=true;else if(c==='"')q=false;continue;}if(c==='"'){q=true;continue;}if(c==="[")depth++;if(c==="]"&&--depth===0)return JSON.parse(code.slice(start,i+1));}throw Error("No JSON array");}
function first(s){let i=String(s).search(/[.!?]\s+/);return i<0?s:s.slice(0,i+1);}
function label(e,key){
 if(!e.length)return "";
 const dest=e.find(x=>x.type==="death");if(dest)return dest.target==="king"?"Король погибает, и путешествие заканчивается.":"{{affectedHeroName}} погибает, и поход продолжается уже без этого спутника.";
 const wound=e.find(x=>x.type==="wound");if(wound)return wound.target==="king"?"Король получает тяжёлое ранение, но остаётся во главе отряда.":"{{affectedHeroName}} получает тяжёлое ранение; отряду приходится оказать помощь.";
 const combat=e.find(x=>x.type==="combat");
 const gold=e.filter(x=>x.type==="gold").reduce((n,x)=>n+x.delta,0);
 const supplies=e.filter(x=>x.type==="supplies").reduce((n,x)=>n+x.delta,0);
 const rec=e.find(x=>x.type==="recruit");
 if(combat)return (gold>0?"В казну поступает золотая плата, но ":"")+(supplies>0?"Припасы пополняются, однако ":"")+(combat.combatType==="battle"?"впереди большая битва.":"впереди стычка.");
 if(rec)return supplies>0?"В отряд вступает новый спутник, а в дорожные мешки добавляют припасы.":"К вашему отряду присоединяется новый спутник.";
 if(gold>0&&supplies>0)return "В походной казне прибавляется золото, а в обозе — припасы.";
 if(gold>0)return "Отряд пополняет золотую казну.";
 if(supplies>0)return "Запасы отряда пополняются припасами.";
 if(gold<0&&supplies<0)return "Отряд лишается части золота и припасов.";
 if(gold<0)return "Приходится расплатиться частью золота.";
 if(supplies<0)return "На последствие уходит часть походных припасов.";
 return "";
}
function cost(raw){let g=raw.cost?.gold||0,s=raw.cost?.supplies||0;let m=raw.action.match(/Купить\s+\d+\s+Suppl(?:y|ies)\s+за\s+(\d+)\s+Gold/i);if(m)return{gold:+m[1],supplies:0};m=raw.action.match(/(?:за|—)\s*(\d+)\s+Gold/i);if(m)g=+m[1];m=raw.action.match(/Отдать\s+(\d+)\s+Suppl(?:y|ies)/i);if(m)s=+m[1];return{gold:g,supplies:s};}
function fix(doc,files){
 let by=new Map(),unparsed=[],found=0,changes=0;
 for(const file of files)for(const e of getRawEvents(file.content))for(const c of e.choices)by.set(c.id,c);
 for(const e of doc.events)for(const c of e.choices){
  let src=by.get(c.id);if(!src)continue;if(typeof src.success!=="string")continue;
  found++;let ss=parsedEffects(src.success,src),ff=parsedEffects(src.failure,src);
  for(const u of [...ss.unknown,...ff.unknown])unparsed.push(c.id+":"+u);
  let oldS=JSON.stringify(c.successEffects),oldF=JSON.stringify(c.failureEffects);
  c.successEffects=ss.effects;c.failureEffects=ff.effects;c.cost=cost(src);c.kingRisk=!!src.kingRisk;c.warnings=src.warnings||[];
  let s=label(ss.effects,c.id);if(s)c.success=first(c.success)+" "+s;
  let f=label(ff.effects,c.id);if(f)c.failure=first(c.failure)+" "+f;
  c.variants={success:{},failure:{}};
  for(const [branch,efs]of [["success",ss.effects],["failure",ff.effects]]){
   if(efs.some(x=>x.type==="recruit"))c.variants[branch].recruitUnavailable="Свободного бойца для найма не находится, зато в казну поступает компенсация золотом.";
   if(efs.some(x=>x.type==="wound"||x.type==="death"))c.variants[branch].noEligibleTarget="Среди спутников не оказалось подходящего для этого последствия персонажа.";
  }
  if(oldS!==JSON.stringify(c.successEffects)||oldF!==JSON.stringify(c.failureEffects))changes++;
  c.mechanicsReconciled=true;
 }
 doc.meta={...doc.meta,legacyChoicesReconciled:found,legacyMechanicsChanges:changes};
 return{doc,stats:{found,changes,unparsed}};
}
return{fix,parsedEffects};
})();