/* Read-only one-shot country hint. Never receives profile or session tokens. */
export default (_request,context)=>new Response(JSON.stringify({country:context.geo?.country?.code||null}),{
 headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store','Vary':'Origin'}
});
export const config={path:'/geo'};
