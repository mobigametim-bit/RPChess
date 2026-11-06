// No player credentials, profile state, analytics or API mutation.
const endpoints=[
  ['geo','/geo'],
  ['profile','/profile/health'],
  ['tournament','/tournament/health']
];
async function check(id,path){
 const node=document.getElementById(id);
 node.textContent='Проверка…';delete node.dataset.state;
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),8000);
 try{
  const response=await fetch(path,{cache:'no-store',signal:abort.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(id==='geo'){
   if(!(/^[A-Z]{2}$/.test(data.country||'')))throw Error('Страна не определена');
   node.textContent=data.country;
  }else{
   if(data?.ok!==true)throw Error('Сервер не подтвердил доступность');
   node.textContent='Работает';
  }
  node.dataset.state='ok';
 }catch(error){
  node.textContent=error?.name==='AbortError'?'Нет ответа (8 с)':(error?.message||'Ошибка соединения');
  node.dataset.state='fail';
 }finally{clearTimeout(timeout);}
}
async function run(){
 const button=document.getElementById('recheck');
 button.disabled=true;
 await Promise.all(endpoints.map(([id,path])=>check(id,path)));
 button.disabled=false;
}
document.getElementById('recheck').addEventListener('click',run);
void run();
