#!/usr/bin/env node
// Minimal integration contract for the NEW Worker. FakeD1 implements only SQL
// used by this service; real D1 schema/deploy is verified separately in CI.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const workerPath=pathToFileURL(path.join(root,'profile-worker/src/index.mjs')).href;
class FakeD1 {
 constructor(){this.players=new Map();this.vk=new Map();this.tokens=new Map();}
 prepare(statement){
  const sql=statement.replace(/\s+/g,' ').trim();
  return {bind:(...values)=>({
   first:async()=>{
    if(sql.includes('FROM rpchess_profile_token_v1')){
      const t=this.tokens.get(values[0]);return t&&t.expires_at>values[1]?{profile_id:t.profile_id}:null;
    }
    if(sql.includes('FROM rpchess_profile_v1')){
      const id=sql.includes('WHERE vk_user_id=')?this.vk.get(values[0]):values[0];
      return id?{...this.players.get(id)}||null:null;
    }
    throw Error('Unsupported D1 SELECT: '+sql);
   },
   run:async()=>{
    if(sql.startsWith('INSERT INTO rpchess_profile_v1')){
      const hasVk=sql.includes('vk_user_id');
      const [id,provider]=values;
      if(hasVk&&this.vk.has(values[2]))return {meta:{changes:0}};
      const date=hasVk?values[4]:values[3];
      const entry={id,provider,vk_user_id:hasVk?values[2]:null,
        snapshot_json:hasVk?values[3]:values[2],
        revision:0,migrated_vk_v1:0,created_at:date,updated_at:date};
      this.players.set(id,entry);if(entry.vk_user_id)this.vk.set(entry.vk_user_id,id);
      return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO rpchess_profile_token_v1')){
      const [hash,profile_id,expires_at,created_at]=values;
      this.tokens.set(hash,{profile_id,expires_at,created_at});
      return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE rpchess_profile_token_v1')){
      const [expires_at,hash]=values,t=this.tokens.get(hash);
      if(t)t.expires_at=expires_at;
      return {meta:{changes:t?1:0}};
    }
    if(sql.startsWith('UPDATE rpchess_profile_v1')){
      const migration=sql.includes('migrated_vk_v1=1');
      const [snapshot_json,updated_at,id,revision]=values;
      const entry=this.players.get(id);
      if(!entry||entry.revision!==revision)return {meta:{changes:0}};
      Object.assign(entry,{snapshot_json,updated_at,revision:revision+1});
      if(migration)entry.migrated_vk_v1=1;
      return {meta:{changes:1}};
    }
    throw Error('Unsupported D1 mutation: '+sql);
   }
  })};
 }
}
const origin='https://rpchess-profile-game-preview.mobigametim.workers.dev';
(async()=>{
 const service=await import(workerPath);
 const db=new FakeD1(),env={DB:db,VK_APP_SECRET:'vk-test-secret'};
 const call=async (route,{method='POST',data=null,token='',from=origin}={})=>{
  const request=new Request('https://rpchess-profile-preview.mobigametim.workers.dev'+route,{
    method,headers:{Origin:from,...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
    ...(data?{body:JSON.stringify(data)}:{})
  });
  const response=await service.default.fetch(request,env);
  const body=await response.json().catch(()=>null);
  return {status:response.status,body,headers:response.headers};
 };
 assert.equal((await call('/health',{method:'GET'})).status,200);
 const forbidden=await call('/v1/session',{data:{},from:'https://evil.invalid'});
 assert.equal(forbidden.status,403);
 const guest=await call('/v1/session',{data:{}});
 assert.equal(guest.status,200);
 const {token,profile}=guest.body;
 assert.match(profile.id,/^[0-9a-f-]{36}$/i);
 assert.equal(profile.provider,'web');assert.match(token,/^[\w-]{43}$/);
 assert.equal(db.tokens.has(token),false,'raw credentials may never be stored in D1');
 assert.equal((await call('/v1/profile',{method:'GET'})).status,401);
 assert.equal((await call('/v1/tournament-binding',{method:'GET'})).status,401);
 const boundWeb=await call('/v1/tournament-binding',{method:'GET',token});
 assert.equal(boundWeb.status,200);
 assert.equal(boundWeb.body.id,profile.id);
 assert.equal(boundWeb.body.provider,'web');
 assert.equal(boundWeb.body.vkUserId,null);
 assert.equal((await call('/v1/profile',{method:'GET',token})).body.profile.id,profile.id);
 assert.equal((await call('/v1/vk-import',{data:{meta:{rating:{power:999}}},token})).status,403);
 const payload={schemaVersion:1,run:null,rating:{schemaVersion:1,power:650,receipts:[]},
  chronicle:{schemaVersion:1,history:[]},arena:{version:1,events:[],match:null}};
 const saved=await call('/v1/profile',{method:'PUT',data:{snapshot:payload,revision:0},token});
 assert.equal(saved.status,200);assert.equal(saved.body.profile.revision,1);
 assert.equal((await call('/v1/profile',{method:'PUT',data:{snapshot:payload,revision:0},token})).status,409);
 assert.equal((await call('/v1/session',{data:{accessToken:token}})).body.profile.id,profile.id);
 assert.equal((await call('/v1/session',{data:{accessToken:'A'.repeat(43)}})).status,401);
 const ts=Math.floor(Date.now()/1000);
 const raw='vk_app_id=54754579&vk_user_id=12345&vk_ts='+ts+'&vk_platform=desktop_web';
 const params=new URLSearchParams(raw);
 const signed=new URLSearchParams([...params].filter(([k])=>k.startsWith('vk_')).sort(([a],[b])=>a.localeCompare(b))).toString();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.VK_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signed));
 const signature=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const launch='?'+raw+'&sign='+signature;
 assert.equal((await call('/v1/session',{data:{vkLaunch:'?'+raw+'&sign=WRONG'}})).status,401);
 const verified=await call('/v1/session',{data:{vkLaunch:launch}});
 assert.equal(verified.status,200);assert.equal(verified.body.profile.provider,'vk');
 const vkAgain=await call('/v1/session',{data:{vkLaunch:launch}});
 assert.equal(vkAgain.body.profile.id,verified.body.profile.id);
 assert.notEqual(verified.body.profile.id,profile.id);
 const boundVK=await call('/v1/tournament-binding',{method:'GET',token:verified.body.token});
 assert.equal(boundVK.status,200);
 assert.equal(boundVK.body.id,verified.body.profile.id);
 assert.equal(boundVK.body.provider,'vk');
 assert.equal(boundVK.body.vkUserId,'12345');
 const legacy={rating:{power:845,receipts:[]},chronicle:{history:[{runId:'old-1',playerName:'Player',completedAt:500}]},
   arena:{version:1,events:[{id:'old-win:1',kind:'win',amount:30,at:500}],match:{id:'unfinished'}},
   run:{id:'old-unfinished'}};
 const imported=await call('/v1/vk-import',{data:{meta:legacy},token:verified.body.token});
 assert.equal(imported.status,200);
 assert.equal(imported.body.profile.snapshot.rating.power,845);
 assert.equal(imported.body.profile.snapshot.arena.match,null);
 assert.equal(imported.body.profile.snapshot.run,undefined);
 assert.equal(imported.body.profile.migratedVK,true);
 const repeat=await call('/v1/vk-import',{data:{meta:legacy},token:verified.body.token});
 assert.equal(repeat.status,200);assert.equal(repeat.body.alreadyImported,true);
 assert.equal(repeat.body.profile.revision,imported.body.profile.revision);
 // A first test may have marked an incomplete snapshot as already imported.
 // Later discovered VK history must enrich the SAME ID, never duplicate data.
 const fuller={...legacy,chronicle:{history:[
   ...legacy.chronicle.history,{runId:'old-2',playerName:'Player',completedAt:700}
 ]},arena:{...legacy.arena,events:[
   ...legacy.arena.events,{id:'old-win:2',kind:'win',amount:30,at:700}
 ]}};
 const enriched=await call('/v1/vk-import',{data:{meta:fuller},token:verified.body.token});
 assert.equal(enriched.status,200);
 assert.equal(enriched.body.recovered,true,'recovery must be explicitly flagged');
 assert.equal(enriched.body.profile.id,verified.body.profile.id);
 assert.equal(enriched.body.profile.snapshot.chronicle.history.length,2);
 assert.equal(enriched.body.profile.snapshot.arena.events.length,2);
 assert.equal(enriched.body.profile.snapshot.arena.match,null);
 assert.equal(enriched.body.profile.snapshot.run,undefined);
 const third=await call('/v1/vk-import',{data:{meta:fuller},token:verified.body.token});
 assert.equal(third.body.alreadyImported,true);
 assert.equal(third.body.profile.revision,enriched.body.profile.revision,'repeat recovery is idempotent');
 // Simulate a different VK device: fresh signed launch, fresh session, same
 // verified VK profile and its server-restored completed history.
 const otherDevice=await call('/v1/session',{data:{vkLaunch:launch}});
 assert.equal(otherDevice.status,200);
 assert.equal(otherDevice.body.profile.id,verified.body.profile.id);
 assert.equal(otherDevice.body.profile.snapshot.rating.power,845);
 assert.equal(otherDevice.body.profile.snapshot.chronicle.history.length,2);
 assert.equal(otherDevice.body.profile.snapshot.arena.events.length,2);
 assert.equal(otherDevice.body.profile.snapshot.arena.match,null);
 assert.equal(otherDevice.body.profile.snapshot.run,undefined);
 const malicious=await call('/v1/vk-import',{data:{meta:legacy},token});
 assert.equal(malicious.status,403);
 // Exercise the actual D1 SQLite ranking SQL, not a guessed JS top-ten mock.
 // Old VK rows remain in leaderboard_v1; migrated VK + new RPChess profiles
 // must compete in one deterministic ranking without duplicate accounts.
 const {DatabaseSync}=require('node:sqlite');
 const fs=require('node:fs');
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(fs.readFileSync(path.join(root,'leaderboard-worker/schema.sql'),'utf8'));
 sqlite.exec(fs.readFileSync(path.join(root,'profile-worker/schema.sql'),'utf8'));
 const adapter={prepare(sql){
   const statement=sqlite.prepare(sql);
   return {bind:(...args)=>({
     first:async()=>statement.get(...args)||null,
     all:async()=>({results:statement.all(...args)}),
     run:async()=>({meta:{changes:statement.run(...args).changes}})
   })};
 }};
 const {refreshProfileBoard,readUnifiedBoard,bestFromSnapshot}
   =await import(pathToFileURL(path.join(root,'profile-worker/src/unified-board.mjs')).href);
 const webId='00000000-0000-4000-8000-000000000010';
 const vkId='00000000-0000-4000-8000-000000000011';
 const rankTime=Date.now();
 const addProfile=sqlite.prepare('INSERT INTO rpchess_profile_v1(id,provider,vk_user_id,snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?,?)');
 const webSnapshot={schemaVersion:1,rating:{power:1000},
   chronicle:{history:[{runId:'web-finished',playerName:'Web Champion',week:200,power:1000,commanderId:'pilgrim'}]}};
 const vkSnapshot={schemaVersion:1,rating:{power:600},
   chronicle:{history:[{runId:'vk-finished',playerName:'VK Player',week:100,power:600}]}};
 addProfile.run(webId,'web',null,JSON.stringify(webSnapshot),rankTime,rankTime);
 addProfile.run(vkId,'vk','12345',JSON.stringify(vkSnapshot),rankTime,rankTime);
 sqlite.prepare('INSERT INTO leaderboard_v1(vk_id,player_name,glory,week,power,run_id,commander_id,achieved_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
  .run('12345','Legacy VK',31,100,1000,'legacy-finished','oathkeeper',rankTime-1,rankTime-1);
 const webRow={id:webId,snapshot_json:JSON.stringify(webSnapshot)};
 const vkRow={id:vkId,snapshot_json:JSON.stringify(vkSnapshot)};
 assert.equal(bestFromSnapshot(webSnapshot).glory,44);
 assert.equal(await refreshProfileBoard(adapter,webRow),true);
 assert.equal(await refreshProfileBoard(adapter,vkRow),true);
 const global=await readUnifiedBoard(adapter,webRow);
 assert.equal(global.top.length,2,'one Web profile and one deduplicated VK profile');
 assert.deepEqual(global.top.map(r=>r.name),['Web Champion','Legacy VK']);
 assert.equal(global.me.rank,1);
 assert.equal((await readUnifiedBoard(adapter,vkRow)).me.rank,2);
 assert.equal((await readUnifiedBoard(adapter,null)).me,null);
 assert.equal(Object.hasOwn(global.top[0],'owner_key'),false,'do not publish internal account keys');
 const lower={...webSnapshot,chronicle:{history:[{runId:'web-lower',playerName:'Weak',week:1,power:100}]}};
 assert.equal(await refreshProfileBoard(adapter,{id:webId,snapshot_json:JSON.stringify(lower)}),false);
 assert.equal((await readUnifiedBoard(adapter,webRow)).top[0].name,'Web Champion','all-time high-water result must not be lowered');
 assert.equal(bestFromSnapshot({schemaVersion:1,run:{id:'bad',journeyStep:6000},rating:{power:1000}}),null);
 sqlite.close();
 console.log('PROFILE WORKER: secure session + D1 unified leaderboard SQL, legacy VK dedup, monotonic Glory: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
