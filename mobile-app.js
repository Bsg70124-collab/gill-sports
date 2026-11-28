/* Gill Sports Stage 2 mobile shell. Never persists GitHub credentials. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const TABS=[["overview","Home","⌂"],["games","Games","◈"],["players","Players","★"],["props","Markets","▥"],["parlays","Parlays","▤"],["system","Status","⚙"]];
const VALID=new Set(TABS.map(x=>x[0]));
const style=document.createElement("style");
style.textContent=".gs-mobile-tabs{display:none}.gs-install-help{border:1px solid #3c597a;border-radius:12px;padding:13px 15px;background:#15273f;margin:10px 0}.gs-install-help p{margin:4px 0 9px;font-size:13px;color:#bad0ef;line-height:1.5}.gs-mobile-link{display:inline-flex;min-height:40px;align-items:center;margin:4px 0;padding:8px 11px;border:1px solid #375073;border-radius:9px;text-decoration:none}@media(max-width:700px){header{position:relative}header .head{gap:10px}header .subtitle{font-size:11px}header .nav{display:none}.gs-mobile-tabs{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;background:#0d1b2fF5;border-top:1px solid #375073;padding:5px 6px calc(5px + env(safe-area-inset-bottom,0px));gap:2px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}.gs-mobile-tabs::-webkit-scrollbar{display:none}.gs-mobile-tabs button{flex:1 0 52px;min-width:52px;max-width:100px;min-height:55px;background:transparent;border:0;border-radius:10px;color:#afc4e2;padding:6px 3px;font-size:10px;font-weight:650;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;white-space:nowrap}.gs-mobile-tabs button.active{background:#244c7c;color:white}.gs-mobile-tabs .gs-nav-icon{font-size:20px;line-height:24px}main{padding-bottom:calc(115px + env(safe-area-inset-bottom,0px))!important}.footer{padding-bottom:calc(100px + env(safe-area-inset-bottom,0px))}#tab-players iframe{height:min(72vh,800px)!important}.gs-install-help{display:block}}@media(min-width:701px){.gs-install-help{display:none}}";
document.head.append(style);
const offline=document.createElement("div");
offline.id="gs-offline-status";offline.setAttribute("role","status");
offline.style.cssText="display:none;background:#56301e;color:#ffe7be;padding:9px 15px;text-align:center;font:600 12px system-ui";
offline.textContent="Offline — the saved app shell is not live. Current predictions, market prices, and workflow controls need internet.";
document.body.prepend(offline);
const online=()=>{offline.style.display=navigator.onLine?"none":"block";};
window.addEventListener("online",online);window.addEventListener("offline",online);online();

const nav=document.createElement("nav");nav.className="gs-mobile-tabs";nav.setAttribute("aria-label","Mobile navigation");
for(const [id,title,icon] of TABS){
 const b=document.createElement("button");b.type="button";b.dataset.destination=id;b.setAttribute("aria-label",title);
 const ico=document.createElement("span");ico.className="gs-nav-icon";ico.setAttribute("aria-hidden","true");ico.textContent=icon;
 const titleSpan=document.createElement("span");titleSpan.textContent=title;
 b.append(ico,titleSpan);
 b.addEventListener("click",()=>{
  const target=document.querySelector('.nav [data-tab="'+id+'"]');if(target)target.click();
 });
 nav.append(b);
}
document.body.append(nav);
function selected(){
 const page=document.querySelector(".page.active");const id=page?.id.replace(/^tab-/,"");
 return VALID.has(id)?id:"overview";
}
function updateNav(){
 const current=selected();
 nav.querySelectorAll("button").forEach(b=>{
  const active=b.dataset.destination===current;
  b.classList.toggle("active",active);
  if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
 });
 document.querySelectorAll(".nav [data-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tab===current)));
}
function onTab(id){
 if(!VALID.has(id))return;
 try{localStorage.setItem("gill-sports-last-tab-v2",id);}catch(e){}
 if(location.hash!=="#"+id){try{history.replaceState(history.state,"","#"+id);}catch(e){}}
 updateNav();
}
document.querySelectorAll(".nav [data-tab]").forEach(b=>b.addEventListener("click",()=>onTab(b.dataset.tab)));
window.addEventListener("hashchange",()=>{
 const id=location.hash.slice(1);
 if(!VALID.has(id)||id===selected())return;
 document.querySelector('.nav [data-tab="'+id+'"]')?.click();
});
const hash=location.hash.slice(1);
let previous=null;try{previous=localStorage.getItem("gill-sports-last-tab-v2");}catch(e){}
const restore=VALID.has(hash)?hash:VALID.has(previous)?previous:null;
if(restore&&restore!=="overview")document.querySelector('.nav [data-tab="'+restore+'"]')?.click();
else updateNav();

const playerPage=$("tab-players");
if(playerPage){
 const iframe=playerPage.querySelector("iframe");
 if(iframe){
  const link=document.createElement("a");link.className="gs-mobile-link";
  link.href="./gill-sports-live-players.html";link.textContent="Open full-screen player projections ↗";
  link.setAttribute("aria-label","Open player projections on a full-size page");
  iframe.before(link);
 }
}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
let dismissed=false;try{dismissed=localStorage.getItem("gill-sports-hide-install-tip-v1")==="true";}catch(e){}
if(isIOS&&!standalone&&!dismissed){
 const guide=document.createElement("section");guide.className="gs-install-help";guide.setAttribute("aria-label","iPhone home screen installation");
 guide.innerHTML='<strong>Add Gill Sports to your iPhone</strong><p>In Safari tap Share, then Add to Home Screen. Open from the icon to use it like an app. For manual jobs, choose Run in GitHub (no token).</p><button class="secondary" type="button" id="gs-dismiss-install">Got it</button>';
 const home=$("tab-overview");if(home){home.prepend(guide);$("gs-dismiss-install").onclick=()=>{guide.remove();try{localStorage.setItem("gill-sports-hide-install-tip-v1","true");}catch(e){}};}
}
if("serviceWorker" in navigator&&location.protocol==="https:"){
 window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js",{scope:"./"}).catch(()=>{}));
}
let deferred=null;
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();deferred=event;
 const parent=document.querySelector("header .head")||document.querySelector("header");
 if(!parent||$("gs-install"))return;
 const button=document.createElement("button");button.type="button";button.className="secondary";button.id="gs-install";button.textContent="Install Gill Sports";
 button.addEventListener("click",async()=>{if(!deferred)return;const prompt=deferred;deferred=null;button.hidden=true;await prompt.prompt();});
 parent.append(button);
});
let lastReload=Date.now();
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState!=="visible"||!navigator.onLine||Date.now()-lastReload<5*60*1000)return;
 lastReload=Date.now();
 const btn=document.getElementById("refresh-"+selected());
 if(btn&&typeof btn.click==="function")btn.click();
});
})();