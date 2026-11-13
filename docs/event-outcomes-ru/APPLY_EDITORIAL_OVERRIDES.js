const APPLY_EDITORIAL = (() => {
 function render(doc) {
 const es=doc.events, first=es[0].id, last=es[es.length-1].id;
 let s=["# Художественные исходы "+first+"–"+last,"","**Статус:** авторские редакторские правки применены к отмеченным решениям; остальные тексты остаются первой черновой редакцией и не считаются литературно утверждёнными.","**Числа и игровые последствия** отображать из runtime, не из этого описания.","**Имена:** {{heroName}} — реальный исполнитель; {{affectedHeroName}} — персонаж, фактически пострадавший по эффекту.",""];
 for(const e of es){
 s.push("## "+e.id+" — "+e.title,"","*"+e.race+"; "+(e.tone||"тон не указан")+"*","");
 for(const c of e.choices){
 let cost=(c.cost?.gold?c.cost.gold+" Gold ":"")+(c.cost?.supplies?c.cost.supplies+" Supplies":"");
 cost=cost.trim()||"нет";
 const fx=e=>e?.length?e.map(x=>x.type==="gold"?(x.delta>0?"+":"")+x.delta+" Gold":x.type==="supplies"?(x.delta>0?"+":"")+x.delta+" Supplies":x.type==="recruit"?"найм героя / fallback +18 Gold":x.type==="combat"?"начало "+(x.combatType==="battle"?"Битвы":"Стычки"):(x.type==="wound"?"тяжёлое ранение":x.type==="death"?"гибель":x.type)+" "+(x.target||"")).join("; "):"без дополнительного эффекта";
 s.push("### "+c.id+" — "+c.action,"","**Шанс:** "+c.chance+"%. **Стоимость:** "+cost+". **Успех:** "+fx(c.successEffects)+". **Провал:** "+(c.chance===100?"не предусмотрен":fx(c.failureEffects))+".", "", "**Успех:** "+c.success, "");
 if(c.failure!=null)s.push("**Неудача:** "+c.failure,"");
 for(const [branch,v] of Object.entries(c.variants||{}))for(const [key,txt] of Object.entries(v||{}))s.push("**"+branch+"/"+key+":** "+txt,"");
 }
 }
 return s.join("\n");
 }
 function apply(doc,overrides) {
 let m=Object.entries(overrides), expected=new Set(m.map(([k])=>k)),done=new Set(), branches=0,edited=0;
 for(const e of doc.events)for(const c of e.choices){
  const o=overrides[c.id];if(!o)continue;
  if(typeof o.success!=="string"||o.success.length<15)throw Error("Bad success "+c.id);
  if(c.chance<100 && (typeof o.failure!=="string"||o.failure.length<15))throw Error("Missing failure "+c.id);
  if(c.chance===100&&o.failure!=null)throw Error("Unexpected failure "+c.id);
  for(const [key,v]of Object.entries(o)){if(/\{\{(?:heroName|affectedHeroName)\}\}/.test(v)===false && v.includes("{{"))throw Error("Unknown token "+c.id);}
  c.success=o.success;c.failure=c.chance<100?o.failure:null; if(o.recruitUnavailable){if(!c.variants?.success?.recruitUnavailable)throw Error("Unexpected recruit fallback "+c.id);c.variants.success.recruitUnavailable=o.recruitUnavailable;} if(o.noEligibleTarget){if(!c.variants?.failure?.noEligibleTarget)throw Error("Unexpected target fallback "+c.id);c.variants.failure.noEligibleTarget=o.noEligibleTarget;} c.editorial="bespoke";edited++;branches+=c.chance<100?2:1;done.add(c.id);
 }
 const missing=[...expected].filter(x=>!done.has(x));
 doc.meta={...doc.meta,bespokeEditorialChoices:doc.events.reduce((n,e)=>n+e.choices.filter(c=>c.editorial==="bespoke").length,0)};
 return {doc,md:render(doc),edited,branches,missing};
 }
 return {apply,render};
})();