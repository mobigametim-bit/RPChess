/* Minimal installable PWA shell. Do not cache game assets, tournament
 * requests, VK bridge traffic or player saves. Online gameplay is unchanged. */
const VERSION='rpchess-pwa-shell-1';
const BASE=new URL('./',self.registration.scope);
const offline=new URL('offline.html',BASE).href;
const preload=['offline.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png']
 .map(path=>new URL(path,BASE).href);

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(preload)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(names=>Promise.all(
  names.filter(name=>name.startsWith('rpchess-pwa-shell-')&&name!==VERSION)
   .map(name=>caches.delete(name))
 )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode!=='navigate')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE.pathname))return;
 // Always fetch a fresh HTML document; offline is a separate fallback page.
 // Never cache the entry HTML (avoids stale deploys and stale game state).
 event.respondWith(fetch(request).catch(()=>caches.match(offline)));
});
