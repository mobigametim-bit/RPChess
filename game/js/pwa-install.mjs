/* Installable web app only on standalone RPChess web deployments.
 * Keep VK Mini Apps, Yandex embeds and other host integrations untouched. */
const standaloneHosts=new Set([
 'mobigametim-bit.github.io',
 'rpchess-portrait-ui-preview.mobigametim.workers.dev',
 'localhost','127.0.0.1'
]);
export function isEmbeddedPlatformLaunch(){
 try{
  const params=new URLSearchParams(location.search);
  if(params.has('vk_app_id')||params.has('vk_platform'))return true;
  if(/(^|\.)vk\.(com|ru)$/i.test(new URL(document.referrer).hostname))return true;
 }catch{}
 return Boolean(globalThis.AndroidBridge?.VKWebAppInit||
  globalThis.webkit?.messageHandlers?.VKWebAppInit?.postMessage||
  globalThis.ReactNativeWebView?.postMessage);
}
export function canRegisterPwa({
 host=location.hostname,
 topLevel=globalThis.top===globalThis.self,
 supported='serviceWorker' in navigator,
 embedded=isEmbeddedPlatformLaunch()
}={}){
 return Boolean(supported&&topLevel&&!embedded&&standaloneHosts.has(host));
}
export function registerPwa(){
 if(!canRegisterPwa())return;
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('./service-worker.js',{scope:'./'})
   .catch(error=>console.warn('RPChess PWA registration:',error));
 },{once:true});
}
registerPwa();
