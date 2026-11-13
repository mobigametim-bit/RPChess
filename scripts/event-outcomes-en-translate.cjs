#!/usr/bin/env node
// EN first-pass draft generator for public RPChess event prose. Human literary editing is mandatory.
// Authoring-only: no API requests or runtime dependencies are added to the shipped game.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'../game/js/events');
const suffixes=['E001_E050','E051_E100','E101_E150','E151_E220','E221_E290','E291_E360','E361_E430','E431_E500'];
const delimiter='7519382468501',actor='912847305561',victim='912847305562';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mask=s=>s.replaceAll('{{affectedHeroName}}',victim).replaceAll('{{heroName}}',actor);
const unmask=s=>s.replaceAll(victim,'{{affectedHeroName}}').replaceAll(actor,'{{heroName}}');
const rows=o=>Object.entries(o).flatMap(([id,r])=>[
 {id,key:'s',source:r.s},...(r.f?[{id,key:'f',source:r.f}]:[]),
 ...Object.entries(r.v||{}).map(([k,s])=>({id,key:'v.'+k,source:s}))
]);
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').match(/Object\.freeze\((\{[\s\S]*\})\);/)[1]);
function valid(x,source){
 if(typeof x!=='string'||!x.trim()||/[\u0400-\u052f]/u.test(x)||x.includes(actor)||x.includes(victim)||x.includes(delimiter))return false;
 const tokens=s=>(s.match(/\{\{(?:heroName|affectedHeroName)\}\}/g)||[]).sort();
 return JSON.stringify(tokens(x))===JSON.stringify(tokens(source));
}
async function request(txt){
 const url='https://translate.googleapis.com/translate_a/single?'+new URLSearchParams({client:'gtx',sl:'ru',tl:'en',dt:'t',q:txt});
 let last;
 for(let n=0;n<5;n++){
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw new Error('HTTP '+r.status);
   const v=(await r.json())?.[0]?.map(x=>x?.[0]||'').join('');
   if(!v)throw new Error('Empty response');
   return v;
  }catch(e){last=e;if(n<4)await sleep(1500*(n+1));}
 }
 throw last;
}
async function batch(items){
 if(items.length===1)return [unmask((await request(mask(items[0]))).trim())];
 try{
  const out=await request(items.map(mask).join('\n'+delimiter+'\n'));
  const parts=out.split(delimiter).map(x=>unmask(x.trim()));
  if(parts.length===items.length&&parts.every((s,i)=>valid(s,items[i])))return parts;
  console.warn('Batch boundaries changed; falling back to individual strings');
 }catch(e){console.warn('Batch error '+e.message+'; falling back');}
 const result=[];
 for(const s of items){result.push(unmask((await request(mask(s))).trim()));await sleep(180);}
 return result;
}
(async()=>{
 let count=0,choices=0;
 for(let index=1;index<=8;index++){
  const no=String(index).padStart(2,'0');
  const source=read(path.join(dir,'literary-outcomes-'+no+'.mjs'));
  const target=path.join(dir,'literary-outcomes-en-'+no+'.mjs');
  const data=fs.existsSync(target)?read(target):{};
  const all=rows(source);
  const missing=all.filter(r=>!valid(r.key.startsWith('v.')?data[r.id]?.v?.[r.key.slice(2)]:data[r.id]?.[r.key],r.source));
  console.log('Volume '+no+': translating '+missing.length+' / '+all.length);
  for(let offset=0;offset<missing.length;){
   const set=[];let size=0;
   while(offset+set.length<missing.length&&set.length<16){
    const row=missing[offset+set.length];
    if(set.length&&size+row.source.length>2200)break;
    set.push(row);size+=row.source.length+delimiter.length;
   }
   const results=await batch(set.map(r=>r.source));
   for(let j=0;j<set.length;j++){
    const row=set[j],en=results[j];
    assert(valid(en,row.source),'Incomplete/mangled EN: '+row.id+'.'+row.key);
    const slot=data[row.id]||={};
    if(row.key.startsWith('v.')){slot.v||={};slot.v[row.key.slice(2)]=en;}
    else slot[row.key]=en;
   }
   offset+=set.length;
   if(offset%90<16)console.log('Volume '+no+' progress '+offset+'/'+missing.length);
   await sleep(450);
  }
  const ordered={};
  for(const [id,record] of Object.entries(source)){
   ordered[id]=data[id];
   assert.deepEqual(Object.keys(ordered[id]).sort(),Object.keys(record).sort(),id+' fields');
  }
  all.forEach(r=>{
   const en=r.key.startsWith('v.')?ordered[r.id]?.v?.[r.key.slice(2)]:ordered[r.id]?.[r.key];
   assert(valid(en,r.source),r.id+'.'+r.key);
  });
  const symbol='OUTCOMES_EN_'+suffixes[index-1];
  fs.writeFileSync(target,'// EN translation FIRST PASS. Literary editorial approval outstanding.\nconst '+symbol+' = Object.freeze('+JSON.stringify(ordered)+');\nexport { '+symbol+' };\n');
  choices+=Object.keys(ordered).length;count+=all.length;
  console.log('Completed '+no+' ('+all.length+' EN entries).');
 }
 assert.equal(count,3764);assert.equal(choices,2114);
 console.log('Draft translation coverage: '+choices+' choices, '+count+' texts. Human prose review remains.');
})().catch(e=>{console.error(e);process.exitCode=1;});
