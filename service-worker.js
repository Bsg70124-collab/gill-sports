/* Only static app shell is cached; DO NOT cache dynamic projections or market JSON. */
const CACHE="gill-shell-v1";
const SHELL=["./","./index.html","./gill-icon.svg","./app.webmanifest"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin)return;
 if(u.pathname.includes("/data/")||u.pathname.includes("/actions/")||u.pathname.includes("/api/"))return;
 if(req.mode==="navigate"){
  event.respondWith(fetch(req).catch(()=>caches.match("./index.html")));
 }
});