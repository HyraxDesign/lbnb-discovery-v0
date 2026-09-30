const CACHE='nava-v162-feedback1';
const CORE=['./','./index.html','./lbnb-content-v0.json','./manifest.webmanifest','./v151-media.js','./v16.js','./v161.js','./journey-model.js','./v162.js','./v162.css','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nava-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(async r=>{
    if(r.ok){const c=await caches.open(CACHE);await c.put(event.request,r.clone())}
    return r;
  }).catch(async()=>{
    const exact=await caches.match(event.request,{ignoreSearch:true});
    if(exact)return exact;
    if(event.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
    return Response.error();
  }));
});
