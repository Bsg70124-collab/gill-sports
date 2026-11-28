/* Phase 4 iPhone and desktop health control center. Fail closed on missing feeds. */
(()=>{
"use strict";
const system=document.getElementById("tab-system");
const players=document.getElementById("tab-players");
if(!system||!players)return;
const health=document.createElement("section");
health.className="panel";health.id="gs-phase4-status";
health.innerHTML='<div class="rowhead"><h2>Phase 4 · Reliability Control Center</h2><button class="secondary" id="gs-phase4-refresh" type="button">↻ Check feed health</button></div>'+
'<p id="gs-p4-state" aria-live="polite">Loading latest monitoring results...</p>'+
'<div id="gs-p4-stats" class="info"></div>'+
'<h3>Freshness and data protection</h3><div class="scroll"><table><thead><tr><th>Data source</th><th>Status</th><th>Age</th><th>Threshold</th></tr></thead><tbody id="gs-p4-feeds"></tbody></table></div>'+
'<p class="small" id="gs-p4-alerts"></p>'+
'<h3>Chronological backtesting vs. basic baselines</h3>'+
'<p class="small">Only earlier game dates provide a reference value. Insufficient historical rows are excluded from comparison.</p>'+
'<div class="scroll"><table><thead><tr><th>Statistic</th><th>Comparable games</th><th>Model MAE</th><th>Prior-date mean MAE</th><th>Verdict</th></tr></thead><tbody id="gs-p4-baselines"></tbody></table></div>'+
'<p class="small">This monitoring system does not retrain the models or certify wagering probabilities.</p>'+
'<a class="gs-mobile-link" href="https://github.com/Bsg70124-collab/gill-sports/actions/workflows/gill-sports-phase4-monitor.yml" target="_blank" rel="noopener noreferrer">View health checks on GitHub ↗</a>';
system.prepend(health);
const injury=document.createElement("section");
injury.className="panel";injury.id="gs-phase4-injuries";
injury.innerHTML='<div class="rowhead"><h2>Injury-aware projection safety</h2><span class="badge">Research only</span></div>'+
'<p class="small">Status matching uses an unofficial injury feed. Unlisted players are NOT confirmed active. The original locked projections are never changed; questionable-player sensitivity values are hypothetical.</p>'+
'<p id="gs-p4-injury-summary" aria-live="polite">Loading player risk review...</p>'+
'<div class="toolbar"><select id="gs-p4-injury-filter" aria-label="Player availability research filter"><option value="risk">Flagged injuries only</option><option value="all">All current player candidates</option></select>'+
'<input id="gs-p4-injury-search" aria-label="Find player" placeholder="Search player..."></div>'+
'<div class="scroll"><table><thead><tr><th>Player / game</th><th>Injury status</th><th>Research flag</th><th>Minutes sensitivity</th></tr></thead><tbody id="gs-p4-injury-rows"></tbody></table></div>';
players.prepend(injury);
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const fmt=x=>typeof x==="number"&&Number.isFinite(x)?x.toFixed(2):"—";
let data=null;
function renderInjuries(){
 const all=data?.injury_research_overlay?.player_rows||[];
 const term=$("gs-p4-injury-search").value.toLowerCase().trim();
 const risk=$("gs-p4-injury-filter").value==="risk";
 const subset=all.filter(r=>(!risk||r.review_state!=="UNVERIFIED")&&(!term||String(r.player_name||"").toLowerCase().includes(term))).slice(0,150);
 $("gs-p4-injury-rows").innerHTML=subset.map(r=>{
  const sensitivity=Object.entries(r.illustrative_minutes_sensitivity||{}).map(([k,v])=>k.replace("_if_minutes_25pct_lower","")+" "+fmt(v)).join(" · ");
  return "<tr><td>"+esc(r.player_name)+"<div class='small'>"+esc(r.game_date)+" · "+esc(r.game_id)+"</div></td>"+
  "<td>"+esc(r.injury_status)+"</td><td>"+esc(r.review_state.replaceAll("_"," "))+"</td><td>"+
  esc(sensitivity||"No verified adjustment")+"</td></tr>";
 }).join("")||'<tr><td colspan="4">No matching current player candidates, or injury data unavailable.</td></tr>';
}
$("gs-p4-injury-search").oninput=renderInjuries;
$("gs-p4-injury-filter").onchange=renderInjuries;
async function load(){
 const button=$("gs-phase4-refresh");button.disabled=true;
 try{
  const response=await fetch("./data/phase4_control_center.json?v="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  data=await response.json();
  const checks=data.feed_checks||{};
  const warnings=data.alerts||{};
  $("gs-p4-state").textContent="System: "+(data.overall_state||"UNKNOWN").replaceAll("_"," ")+
   " · Last audited: "+(data.generated_at_utc||"unknown");
  const critical=(warnings.critical||[]).map(x=>x.key).join(", ")||"None";
  const caution=(warnings.warning||[]).map(x=>x.key).join(", ")||"None";
  $("gs-p4-alerts").textContent="Critical feed checks: "+critical+" · Cautions: "+caution+
   " · See GitHub Issues for deduplicated operational alerts. Push notifications are not configured.";
  $("gs-p4-stats").innerHTML=
   '<div><strong>Player results graded</strong>'+esc(data.historical_backtest?.by_date?.reduce((n,d)=>n+(d.settled_player_rows||0),0)??"—")+'</div>'+
   '<div><strong>Independent settled dates</strong>'+esc(data.historical_backtest?.date_coverage??"—")+'</div>'+
   '<div><strong>Verified player availability</strong>No — requires official confirmation</div>'+
   '<div><strong>Approved betting edges</strong>'+esc(data.betting_gate?.validated_positive_edges??0)+' claimed by upstream gate (must also pass freshness)</div>';
  $("gs-p4-feeds").innerHTML=Object.entries(checks).map(([key,d])=>"<tr><td>"+esc(key.replaceAll("_"," "))+"</td><td>"+
    esc(d.state.replaceAll("_"," "))+"</td><td>"+(d.age_minutes===null?"—":fmt(d.age_minutes)+" min")+"</td><td>"+esc(d.max_age_minutes)+" min</td></tr>").join("");
  const markets=data.historical_backtest?.markets||{};
  $("gs-p4-baselines").innerHTML=Object.entries(markets).map(([stat,d])=>{
    const verdict=d.paired_game_rows<100?"Limited sample":d.model_better_than_global_baseline?"Model lower MAE":"Baseline lower or tied";
    return "<tr><td>"+esc(stat)+"</td><td>"+esc(d.paired_game_rows)+"</td><td>"+fmt(d.model_mae)+"</td><td>"+
      fmt(d.strictly_prior_global_mean_mae)+"</td><td>"+esc(verdict)+"</td></tr>";
  }).join("");
  const overlay=data.injury_research_overlay||{};
  const counts=overlay.counts||{};
  $("gs-p4-injury-summary").textContent=(overlay.player_rows||[]).length+
    " current candidates · "+(counts.BLOCK_RESEARCH||0)+" injury blocks · "+(counts.CAUTION_RESEARCH||0)+
    " cautions · "+(counts.UNVERIFIED||0)+" unverified · Source "+(overlay.source_fresh?"within monitor threshold":"stale or missing");
  renderInjuries();
 }catch(e){
  $("gs-p4-state").textContent="Monitoring feed unavailable: "+e.message+" — freshness unverified.";
  $("gs-p4-injury-summary").textContent="Injury risk feed unavailable. Do not assume player availability.";
  data=null;renderInjuries();
 }finally{button.disabled=false;}
}
$("gs-phase4-refresh").onclick=load;
load();
})();