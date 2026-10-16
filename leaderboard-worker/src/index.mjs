// RPChess Great Commanders. Stateless Cloudflare Worker + D1; game stays on GitHub Pages.
const APP_ID='54754579', MAX_WEEK=5000, MAX_POWER=1000000;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
function vkLaunch(raw){
  if(typeof raw!=='string'||raw.length>3000)return null;
  const p=new URLSearchParams(raw.startsWith('?')?raw.slice(1):raw);
  if([...p.keys()].some(k=>k.startsWith('vk_')&&p.getAll(k).length!==1))return null;
  const id=p.get('vk_user_id'),sign=p.get('sign');
  if(!id||!/^[1-9]\d*$/.test(id)||p.get('vk_app_id')!==APP_ID||!sign)return null;
  return {id,sign,data:new URLSearchParams([...p.entries()].filter(([k])=>k.startsWith('vk_')).sort(([a],[b])=>a.localeCompare(b))).toString()};
}
async function verifiedVKId(raw,secret){
  const p=vkLaunch(raw);if(!p||!secret)return null;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(p.data)));
  const digest=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(digest.length!==p.sign.length)return null;
  let diff=0;for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^p.sign.charCodeAt(i);
  return diff===0?p.id:null;
}
function validatedRecord(r){
  if(!r||typeof r!=='object')return null;
  const week=r.week,power=r.power,runId=String(r.runId||'');
  if(!Number.isSafeInteger(week)||week<0||week>MAX_WEEK||!Number.isSafeInteger(power)||power<0||power>MAX_POWER||!/^[\w.:-]{1,128}$/.test(runId))return null;
  const glory=Math.floor(Math.sqrt(week*power)/10);
  if(r.glory!==glory)return null;
  return {week,power,glory,runId,name:String(r.playerName||'Воин').trim().replace(/\s+/g,' ').slice(0,24)||'Воин'};
}
const baseSelect='SELECT vk_id,player_name AS name,glory,week,power,achieved_at FROM leaderboard_v1';
async function readBoard(db,id){
  const result=await db.prepare(baseSelect+' ORDER BY glory DESC,week DESC,power DESC,achieved_at ASC,vk_id ASC LIMIT 10').all();
  let me=null;
  if(id){
    const row=await db.prepare(baseSelect+' WHERE vk_id=?').bind(id).first();
    if(row){
      const q='SELECT COUNT(*) AS n FROM leaderboard_v1 WHERE glory>? OR (glory=? AND week>?) OR (glory=? AND week=? AND power>?) OR (glory=? AND week=? AND power=? AND achieved_at<?) OR (glory=? AND week=? AND power=? AND achieved_at=? AND vk_id<?)';
      const above=await db.prepare(q).bind(row.glory,row.glory,row.week,row.glory,row.week,row.power,row.glory,row.week,row.power,row.achieved_at,row.glory,row.week,row.power,row.achieved_at,id).first();
      me={rank:Number(above.n)+1,glory:row.glory,week:row.week,power:row.power,name:row.name};
    }
  }
  return {top:result.results.map((r,i)=>({rank:i+1,name:r.name,glory:r.glory,week:r.week,power:r.power})),me};
}
// Hosting domains vary between VK WebViews, desktop iframes, and staging.
// Match this application's VK ID (not every VK Mini App) and both VK hosting TLDs.
// Origin validation is for browser CORS only; signed VK launch auth remains mandatory
// for writes and personal ranks.
function trustedOrigin(origin,allowedOrigins=''){
  if(!origin)return true; // non-browser clients and trusted server-side probes
  let parsed;
  try{parsed=new URL(origin)}catch{return false}
  if(parsed.protocol!=='https:'||parsed.origin!==origin)return false;
  const explicit=new Set(String(allowedOrigins||'https://mobigametim-bit.github.io').split(',').map(s=>s.trim()).filter(Boolean));
  if(explicit.has(origin))return true;
  return /^(?:(?:stage|prod)-)?app54754579(?:-[a-z0-9]+)?\.pages\.vk-apps\.(?:ru|com)$/i.test(parsed.hostname);
}
async function handler(req,env){
  const origin=req.headers.get('origin');
  if(origin&&!trustedOrigin(origin,env.ALLOWED_ORIGINS))return json({error:'origin_not_allowed'},403);
  const cors=origin?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'}:{};
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!env.DB)return json({error:'database_not_configured'},503,cors);
  const path=new URL(req.url).pathname;
  if(req.method==='GET'&&path==='/health')return json({status:'ok'},200,cors);
  if(req.method==='GET'&&path==='/v1/leaderboard')return json(await readBoard(env.DB,null),200,cors);
  if(req.method!=='POST'||!['/v1/leaderboard/view','/v1/leaderboard/submit'].includes(path))return json({error:'not_found'},404,cors);
  if(Number(req.headers.get('content-length'))>12000)return json({error:'request_too_large'},413,cors);
  let body;try{body=await req.json()}catch{return json({error:'invalid_json'},400,cors)}
  const id=await verifiedVKId(body.launch,env.VK_APP_SECRET);
  if(path==='/v1/leaderboard/view')return json(await readBoard(env.DB,id),200,cors);
  if(!id)return json({error:'vk_auth_required'},401,cors);
  const r=validatedRecord(body.record);
  if(!r)return json({error:'invalid_record'},422,cors);
  const now=Date.now();
  const sql=['INSERT INTO leaderboard_v1(vk_id,player_name,glory,week,power,run_id,achieved_at,updated_at)',
    'VALUES(?,?,?,?,?,?,?,?)',
    'ON CONFLICT(vk_id) DO UPDATE SET',
    'player_name=excluded.player_name,glory=excluded.glory,week=excluded.week,power=excluded.power,',
    'run_id=excluded.run_id,achieved_at=excluded.achieved_at,updated_at=excluded.updated_at',
    'WHERE excluded.glory>leaderboard_v1.glory',
    'OR (excluded.glory=leaderboard_v1.glory AND excluded.week>leaderboard_v1.week)',
    'OR (excluded.glory=leaderboard_v1.glory AND excluded.week=leaderboard_v1.week AND excluded.power>leaderboard_v1.power)'].join(' ');
  await env.DB.prepare(sql).bind(id,r.name,r.glory,r.week,r.power,r.runId,now,now).run();
  return json(await readBoard(env.DB,id),200,cors);
}
export default {async fetch(req,env){try{return await handler(req,env)}catch(e){console.error('leaderboard error',e);return json({error:'server_error'},500)}}};
export {handler,verifiedVKId,validatedRecord,trustedOrigin};
