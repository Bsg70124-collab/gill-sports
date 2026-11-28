/* Historical forecasting performance panel; never turn MAE into betting probabilities. */
(()=>{
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stats=["points","rebounds","assists","pra","minutes"];
const tab=document.getElementById("tab-system");
if(!tab)return;
const panel=document.createElement("div");panel.className="panel";
panel.innerHTML='<div class="rowhead"><h2>Prediction Intelligence · Measured accuracy</h2><button class="secondary" type="button" id="gill-quality-refresh">↻ Refresh accuracy</button></div>'+
'<p class="small">Only settled NBA player-game forecasts are scored. MAE = mean absolute error; bias = signed projection minus actual. This is not betting win probability.</p>'+
'<p class="small" id="gill-quality-status" aria-live="polite">Loading independent performance report...</p>'+
'<div class="scroll"><table><thead><tr><th>Statistic</th><th>All graded</th><th>All MAE</th><th>Last 7 game dates MAE</th><th>Previous 7 dates MAE</th><th>Recent bias</th><th>Trend</th></tr></thead><tbody id="gill-quality-tbody"></tbody></table></div>'+
'<p id="gill-quality-warnings" class="small"></p>'+
'<div class="rowhead"><h3>Players with largest recent point errors</h3><span class="small">Minimum 3 settled games per player</span></div>'+
'<div class="scroll"><table><thead><tr><th>Player</th><th>Settled games</th><th>Points MAE · latest 10</th><th>Rebounds MAE</th><th>Assists MAE</th></tr></thead><tbody id="gill-player-error-tbody"></tbody></table></div>';
tab.prepend(panel);
const $=id=>document.getElementById(id);
const fmt=x=>typeof x==="number"&&Number.isFinite(x)?x.toFixed(2):"—";
async function load(){
 const btn=$("gill-quality-refresh");btn.disabled=true;
 $("gill-quality-status").textContent="Loading latest published accuracy audit...";
 try{
  const response=await fetch("./data/model_quality_report.json?ts="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("Quality report unavailable (HTTP "+response.status+")");
  const report=await response.json();
  const m=report.metrics||{};
  $("gill-quality-status").textContent=(report.counts?.settled??0)+" settled player-game forecasts across "+
   (report.counts?.independent_settled_dates??0)+" game dates · audit "+(report.generated_at_utc||"unknown")+
   " · latest player feed "+(report.player_source_updated_at_utc||"unknown");
  $("gill-quality-tbody").innerHTML=stats.map(stat=>{
   const all=m.all?.[stat]||{},recent=m.last_7_game_dates?.[stat]||{},prior=m.previous_7_game_dates?.[stat]||{};
   let trend="Insufficient recent sample";
   if(recent.count>=30&&prior.count>=30&&typeof recent.mae==="number"&&typeof prior.mae==="number"){
     const delta=recent.mae-prior.mae;
     trend=Math.abs(delta)<0.05?"Stable":delta>0?"Worsening MAE":"Improving MAE";
   }
   return '<tr><td>'+esc(stat.toUpperCase())+'</td><td>'+esc(all.count??0)+'</td><td>'+fmt(all.mae)+'</td><td>'+fmt(recent.mae)+'</td><td>'+fmt(prior.mae)+'</td><td>'+fmt(recent.bias)+'</td><td>'+esc(trend)+'</td></tr>';
  }).join("");
  const players=(report.players||[]).filter(p=>p.last_10_games?.points?.count>=3)
    .sort((a,b)=>(b.last_10_games.points.mae??0)-(a.last_10_games.points.mae??0)).slice(0,12);
  $("gill-player-error-tbody").innerHTML=players.map(p=>'<tr><td>'+esc(p.player_name)+'</td><td>'+esc(p.settled_games)+'</td><td>'+fmt(p.last_10_games.points.mae)+'</td><td>'+fmt(p.last_10_games.rebounds.mae)+'</td><td>'+fmt(p.last_10_games.assists.mae)+'</td></tr>').join("")||
    '<tr><td colspan="5">Not enough graded player histories</td></tr>';
  $("gill-quality-warnings").textContent=(report.quality_flags||[]).length?
   "Data / model warnings: "+report.quality_flags.join(" · ").replaceAll("_"," "):
   "No configured data-quality warnings from this snapshot.";
 }catch(e){$("gill-quality-status").textContent="Accuracy audit not available: "+e.message;}
 finally{btn.disabled=false;}
}
$("gill-quality-refresh").onclick=load;
load();
})();