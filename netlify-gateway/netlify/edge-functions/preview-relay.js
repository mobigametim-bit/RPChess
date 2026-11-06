/* Test-only same-origin bridge for /play/, not the production CDN gateway.
 * Netlify-hosted play pages have a different Origin than GitHub Pages, which
 * the Cloudflare API rightfully disallows. Browser requests to this fixed
 * whitelist of upstreams are forwarded without an Origin header.
 * Existing token verification stays inside Cloudflare.
 */
const UPSTREAMS=Object.freeze({
 profile:'https://rpchess-profile-preview.mobigametim.workers.dev',
 tournament:'https://rpchess-tournament-profile-preview.mobigametim.workers.dev'
});
const error=(message,status)=>new Response(JSON.stringify({error:message}),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});
export default async function previewRelay(request){
 const url=new URL(request.url);
 const match=/^\/preview-api\/(profile|tournament)(\/.*)$/.exec(url.pathname);
 if(!match)return error('not_found',404);
 if(!['GET','POST','PUT','OPTIONS'].includes(request.method))return error('method_not_allowed',405);
 if(request.method==='OPTIONS')return new Response(null,{status:204,
   headers:{'Cache-Control':'no-store'}});
 const target=UPSTREAMS[match[1]]+match[2]+url.search;
 const headers=new Headers();
 const contentType=request.headers.get('Content-Type');
 const auth=request.headers.get('Authorization');
 if(contentType)headers.set('Content-Type',contentType);
 if(auth)headers.set('Authorization',auth);
 headers.set('Accept','application/json');
 let body;
 if(request.method==='POST'||request.method==='PUT'){
  const data=await request.arrayBuffer();
  // Profile saves are substantially larger than small tournament commands.
  if(data.byteLength>1024*1024)return error('payload_too_large',413);
  body=data;
 }
 try{
  const upstream=await fetch(target,{method:request.method,headers,
   ...(body!==undefined?{body}:{}),redirect:'manual',cache:'no-store'});
  const responseHeaders=new Headers({
   'Content-Type':upstream.headers.get('Content-Type')||'application/json; charset=utf-8',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
  });
  return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
 }catch{return error('upstream_unavailable',502);}
}
export const config={path:'/preview-api/*'};
