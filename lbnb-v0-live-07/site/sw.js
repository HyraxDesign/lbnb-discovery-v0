const CACHE='nava-v151-media-binding';
const CORE=['./','./index.html','./lbnb-content-v0.json','./manifest.webmanifest','./v151-media.js','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function patchedHtml(request){
  const response=await fetch(request,{cache:'no-store'});
  const text=await response.text();
  const patched=text.includes('v151-media.js')?text:text.replace('</body>','<script src="./v151-media.js?v=151"></script></body>');
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isHtml=event.request.mode==='navigate'||url.pathname.endsWith('index.html')||url.pathname.endsWith('/');
  if(isHtml){
    event.respondWith(patchedHtml(event.request).catch(async()=>{
      const cached=await caches.match('./index.html');
      if(!cached)return Response.error();
      const text=await cached.text();
      return new Response(text.replace('</body>','<script src="./v151-media.js?v=151"></script></body>'),{headers:{'content-type':'text/html; charset=utf-8'}});
    }));
    return;
  }
  if(url.pathname.endsWith('lbnb-content-v0.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request)));
});