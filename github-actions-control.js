/* Gill Sports. Ephemeral opt-in GitHub Actions dispatch. No saved credentials. */
(()=>{
"use strict";
const owner="Bsg70124-collab";
const actions={
  overview:["gill-sports","daily.yml","Update game predictions"],
  games:["gill-sports","daily.yml","Update game predictions"],
  players:["gill-sports-engine","gill-sports-daily-player-projections-v1.yml","Run NBA player projections"],
  props:["gill-sports-engine","gill-sports-odds-collector-v1.yml","Collect fresh odds (uses API quota)"],
  parlays:["gill-sports","gill-sports-daily-parlay-generator-v2.yml","Check strict parlays"],
  research:["gill-sports","gill-sports-parlay-research-previews.yml","Generate research parlays"],
  system:["gill-sports","gill-sports-probability-calibration-v1.yml","Run probability calibration"],
  settle:["gill-sports-engine","gill-sports-daily-settlement-v2.yml","Tally player results"],
  retrain:["gill-sports-engine","gill-sports-controlled-retraining-v1.yml","Evaluate retraining"]
};
let credential=null,pending=null,running=false;
const $=id=>document.getElementById(id);
const style=document.createElement("style");
style.textContent="#gill-login:not([hidden]){position:fixed;inset:0;display:grid;place-items:center;background:#000b;z-index:100;padding:16px}.gill-login-panel{max-width:520px;width:100%;background:#14263d;border:1px solid #54749d;border-radius:13px;padding:20px;box-shadow:0 15px 50px #0009}.gill-login-panel p{line-height:1.5;font-size:13px}.gill-login-panel input{display:block;width:100%;margin:10px 0}.gill-job-message{font-size:12px;color:#c0d1e9}";
document.head.append(style);
const modal=document.createElement("div");
modal.id="gill-login";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
modal.innerHTML='<div class="gill-login-panel"><h3>Authorize GitHub workflow runs</h3>'+
'<p>Use a <strong>fine-grained GitHub personal access token</strong> restricted to Gill Sports repositories, with <strong>Actions: Read and write</strong> permission. The token is kept only in this page’s memory, not stored or uploaded to Gill Sports. Browser tokens are sensitive; use a short-lived, limited token and disconnect after use.</p>'+
'<label for="gill-token">Fine-grained token (github_pat_...)</label><input type="password" id="gill-token" autocomplete="off" spellcheck="false" />'+
'<div class="toolbar"><button type="button" id="gill-connect">Connect for this page</button><button type="button" class="secondary" id="gill-cancel">Cancel</button><a class="small" target="_blank" rel="noopener noreferrer" href="https://github.com/settings/personal-access-tokens/new">Create limited token on GitHub</a></div>'+
'<p class="small" id="gill-token-warning" aria-live="polite"></p></div>';
document.body.append(modal);
const header=document.querySelector("header .head")||document.querySelector("header");
const bar=document.createElement("div");bar.className="toolbar";
bar.innerHTML='<button id="gill-authorize" type="button" class="secondary">Connect GitHub for one-click runs</button><button id="gill-disconnect" type="button" class="secondary" hidden>Disconnect</button><span id="gill-connection-status" class="small" aria-live="polite">Not connected</span>';
header.append(bar);
function authState(){
 $("gill-authorize").textContent=credential?"GitHub authorized for this page":"Connect GitHub for one-click runs";
 $("gill-disconnect").hidden=!credential;
 $("gill-connection-status").textContent=credential?"Token held in memory; never saved":"No token connected; manual GitHub Actions links remain available";
}
function openModal(key){pending=key||null;modal.hidden=false;$("gill-token").focus();}
function closeModal(){modal.hidden=true;$("gill-token").value="";$("gill-token-warning").textContent="";}
$("gill-authorize").onclick=()=>openModal(null);
$("gill-disconnect").onclick=()=>{credential=null;pending=null;authState();};
$("gill-cancel").onclick=()=>{pending=null;closeModal();};
modal.addEventListener("click",ev=>{if(ev.target===modal){pending=null;closeModal();}});
$("gill-connect").onclick=()=>{
 const raw=$("gill-token").value.trim();
 if(!/^github_pat_[A-Za-z0-9_]{15,}$/.test(raw)){
  $("gill-token-warning").textContent="Only fine-grained GitHub tokens are accepted. Do not paste an unrestricted classic token.";
  return;
 }
 credential=raw;
 const next=pending;pending=null;
 closeModal();authState();
 if(next)dispatch(next);
};
async function dispatch(key){
 const config=actions[key];
 if(!config||running)return;
 if(!credential){openModal(key);return;}
 const btn=$("gill-run-"+key),state=$("gill-state-"+key)||$("gill-connection-status");
 running=true;if(btn)btn.disabled=true;
 state.textContent="Submitting "+config[2]+" to GitHub...";
 try{
  const uri="https://api.github.com/repos/"+owner+"/"+config[0]+"/actions/workflows/"+encodeURIComponent(config[1])+"/dispatches";
  const response=await fetch(uri,{
   method:"POST",
   headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+credential,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},
   body:JSON.stringify({ref:"main"})
  });
  if(!response.ok){
   state.textContent="GitHub rejected the request (HTTP "+response.status+"). Check Actions: write access for "+config[0]+".";
   if(response.status===401){credential=null;authState();}
  }else{
   state.textContent="GitHub accepted the job request. This does NOT mean the workflow succeeded. Check GitHub Actions and reload the published feed after completion.";
  }
 }catch(e){state.textContent="Browser could not confirm a GitHub request; use the GitHub Actions link instead.";}
 finally{running=false;if(btn)btn.disabled=false;}
}
function addButton(tab,key){
 const page=$("tab-"+tab);if(!page)return;
 const bar=document.createElement("div");bar.className="toolbar";
 const button=document.createElement("button");button.type="button";button.id="gill-run-"+key;
 button.textContent="▶ "+actions[key][2];button.onclick=()=>dispatch(key);
 const message=document.createElement("span");message.id="gill-state-"+key;message.className="gill-job-message";
 bar.append(button,message);
 const anchor=page.querySelector(".toolbar");
 if(anchor)anchor.after(bar);else page.prepend(bar);
}
for(const k of ["overview","games","players","props","parlays","system"])addButton(k,k);
addButton("parlays","research");
addButton("system","settle");
addButton("system","retrain");
authState();
})();