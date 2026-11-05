// Isolated server-to-server RPChess ID binding regression.
// Fake profile origin never touches a real VK account, D1 or secrets.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';

const API='http://127.0.0.1:8789';
const ID_VK='00000000-0000-4000-8000-000000000201';
const ID_WEB='00000000-0000-4000-8000-000000000202';
const VK_TOKEN='A'.repeat(43),WEB_TOKEN='B'.repeat(43);
const VK_SECRET='rpchess-local-vk-secret-for-ci-only-do-not-deploy';
const profile=createServer((req,res)=>{
  if(req.url!=='/v1/tournament-binding'){res.writeHead(404);res.end();return;}
  const bearer=(req.headers.authorization||'').replace(/^Bearer /,'');
  const response=bearer===VK_TOKEN?{id:ID_VK,provider:'vk',vkUserId:'234567810'}
    :bearer===WEB_TOKEN?{id:ID_WEB,provider:'web',vkUserId:null}:null;
  res.writeHead(response?200:401,{'Content-Type':'application/json'});
  res.end(JSON.stringify(response||{error:'unauthorized'}));
});
const listen=()=>new Promise((resolve,reject)=>{
  profile.once('error',reject);
  profile.listen(8788,'127.0.0.1',resolve);
});
async function request(path,body={},token=''){
 const response=await fetch(API+path,{method:'POST',headers:{
  'Content-Type':'application/json',
  Origin:'https://rpchess-profile-game-preview.mobigametim.workers.dev',
  ...(token?{Authorization:'Bearer '+token}:{})
 },body:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
function launch(id){
 const p=new URLSearchParams({vk_app_id:'54754579',vk_ts:String(Math.floor(Date.now()/1000)),vk_user_id:String(id)});
 return p.toString()+'&sign='+createHmac('sha256',VK_SECRET).update(p.toString()).digest('base64url');
}
try{
 await listen();
 const fake=await request('/v1/session',{nick:'Spoof',power:3500,profileId:ID_VK});
 assert.equal(fake.status,200);
 assert.equal(fake.data.ranked,false,'a browser-selected UUID is never proof of identity');
 const invalid=await request('/v1/session',{profileCredential:'C'.repeat(43)});
 assert.equal(invalid.status,401,'invalid profile bearer must fail closed');
 const vk=await request('/v1/session',{nick:'Verified',power:3500,profileCredential:VK_TOKEN});
 assert.equal(vk.status,200);
 assert.equal(vk.data.kind,'vk');
 assert.equal(vk.data.ranked,true,'VK profile with server-verified binding may play ranked');
 const server=await request('/v1/profile',{},vk.data.token);
 assert.equal(server.data.rpchessId,ID_VK);
 assert.equal(server.data.power,500,'untrusted client Power cannot seed server-rated Elo');
 const repeat=await request('/v1/session',{previous:vk.data.token,power:3500,profileCredential:VK_TOKEN});
 assert.equal(repeat.data.ranked,true);
 assert.equal((await request('/v1/profile',{},repeat.data.token)).data.rpchessId,ID_VK);
 const mismatched=await request('/v1/session',{launch:launch(234567811),profileCredential:VK_TOKEN});
 assert.equal(mismatched.status,403,'a different signed VK identity must not claim this profile');
 const web=await request('/v1/session',{nick:'Web',power:1000,profileCredential:WEB_TOKEN});
 assert.equal(web.status,200);
 assert.equal(web.data.ranked,false,'Web profile is stable but unverified for rated PvP');
 const webProfile=await request('/v1/profile',{},web.data.token);
 assert.equal(webProfile.data.rpchessId,ID_WEB);
 const webRepeat=await request('/v1/session',{previous:web.data.token,profileCredential:WEB_TOKEN});
 assert.equal((await request('/v1/profile',{},webRepeat.data.token)).data.rpchessId,ID_WEB);
 assert.equal(webRepeat.data.ranked,false);
 console.log('TOURNAMENT RPCHESS LINK PASS: verified VK, Web casual, stable ID, invalid/mismatched tokens, server Power');
}finally{
 await new Promise(resolve=>profile.close(resolve));
}
