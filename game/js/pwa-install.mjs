/* Installable PWA only on our standalone web deployments. VK Mini Apps,
 * Yandex embeds and other host integrations must stay untouched. */
const standaloneHosts=new Set([
 'mobigametim-bit.github.io',
 'rpchess-portrait-ui-preview.mobigametim.workers.dev',
 'localhost','127.0.0.1'
]);
export function canRegisterPwa({host=location.hostname,topLevel=globalThis.top===globalThis.self,
 supported='serviceWorker' in navigator}={}){
 return Boolean(supported&&topLevel&&standaloneHosts.has(host));
}
export function registerPwa(){
 if(!canRegisterPwa())return;
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('./service-worker.js',{scope:'./'})
   .catch(error=>console.warn('RPChess PWA registration:',error));
 },{once:true});
}
registerPwa();
