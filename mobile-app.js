/* Gill Sports installable shell. All JSON feeds remain network-only. */
(()=>{
"use strict";
const status=document.createElement("div");
status.id="gs-offline-status";
status.setAttribute("role","status");
status.style.cssText="display:none;background:#56301e;color:#ffe7be;padding:9px 15px;text-align:center;font:600 12px system-ui";
status.textContent="Offline: dashboard shell may load, but projections, odds and run controls need an internet connection.";
document.body.prepend(status);
const update=()=>{status.style.display=navigator.onLine?"none":"block";};
window.addEventListener("online",update);
window.addEventListener("offline",update);update();
if("serviceWorker" in navigator && location.protocol==="https:"){
 window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js",{scope:"./"}).catch(()=>{}));
}
let deferred=null;
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();deferred=event;
 const parent=document.querySelector("header .head")||document.querySelector("header");
 if(!parent||document.getElementById("gs-install"))return;
 const button=document.createElement("button");button.type="button";button.className="secondary";button.id="gs-install";
 button.textContent="Install Gill Sports";
 button.addEventListener("click",async()=>{
  if(!deferred)return;
  const prompt=deferred;deferred=null;
  button.hidden=true;await prompt.prompt();
 });
 parent.append(button);
});
})();