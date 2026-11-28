/* Gill Sports Stage 2: offline shell; never cache player, odds, or other JSON feeds. */
const CACHE="gill-shell-v2";
const SHELL=["./","./index.html","./gill-icon.svg","./app.webmanifest",
 "./mobile-app.js","./model-quality-panel.js","./github-actions-control.js",
 "./featured-players.js","./gill-sports-live-players.html"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const uri=new URL(request.url);
 if(uri.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope);
 if(!uri.pathname.startsWith(scope.pathname))return;
 if(uri.pathname.includes("/data/")||uri.pathname.includes("/api/")||
    uri.pathname.includes("/actions/")||uri.pathname.endsWith(".json"))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).catch(()=>caches.match("./index.html")));
  return;
 }
 // Public, versioned app resources only. Never cache GitHub credentials or API replies.
 const staticPaths=new Set(SHELL.map(x=>new URL(x,self.registration.scope).pathname));
 if(staticPaths.has(uri.pathname)){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(request,copy));}
   return response;
  }).catch(()=>caches.match(request)));
 }
});