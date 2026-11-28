/* Phase 3 research audit panel. Published betting probabilities deliberately suppressed. */
(()=>{
"use strict";
const page=document.getElementById("tab-parlays");
if(!page)return;
const wrap=document.createElement("div");wrap.className="panel";
wrap.innerHTML='<div class="rowhead"><h2>Parlay Intelligence · Phase 3</h2><button type="button" class="secondary" id="gs-parlay-audit-refresh">↻ Reload research audit</button></div>'+
'<p class="small">Historical player-stat residual correlations and Monte Carlo diagnostics. This section does not publish calibrated joint win probabilities, positive EV, or recommended bets.</p>'+
'<p id="gs-parlay-audit-summary" aria-live="polite">Loading research statistics...</p>'+
'<div class="stats"><div class="metric"><small>Independently settled dates</small><b id="gs-pi-dates">—</b><em>Historical coverage</em></div>'+
'<div class="metric"><small>Residual Monte Carlo trials</small><b id="gs-pi-sims">—</b><em>Per research preview</em></div>'+
'<div class="metric"><small>Forward-tracked research slips</small><b id="gs-pi-tracked">—</b><em>Archived only before game start</em></div>'+
'<div class="metric"><small>Settled research record</small><b id="gs-pi-record">—</b><em>Research wins/losses; no financial ROI</em></div></div>'+
'<h3>Empirical player-stat error correlation</h3>'+
'<div class="scroll"><table><thead><tr><th>Statistic pair</th><th>Paired player-games</th><th>Pearson r</th><th>Interpretation</th></tr></thead><tbody id="gs-pi-correlations"></tbody></table></div>'+
'<p class="small" id="gs-pi-warning"></p>'+
'<div class="rowhead"><h3>Research archive status</h3><a class="small" href="https://github.com/Bsg70124-collab/gill-sports/actions/workflows/gill-sports-parlay-intelligence.yml" target="_blank" rel="noopener noreferrer">Run audit in GitHub ↗</a></div>'+
'<p id="gs-pi-tracking-status" class="small">Loading forward-only tracking history...</p>';
const original=page.querySelector(".panel");if(original)page.insertBefore(wrap,original);else page.prepend(wrap);
const $=id=>document.getElementById(id);
const fmt=x=>typeof x==="number"&&Number.isFinite(x)?x.toFixed(3):"—";
const clean=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
async function fetchLive(url){const response=await fetch(url+"?v="+Date.now(),{cache:"no-store"});if(!response.ok)throw Error("HTTP "+response.status+" "+url);return response.json();}
async function refresh(){
 const btn=$("gs-parlay-audit-refresh");btn.disabled=true;
 try{
  const [d,h]=await Promise.all([fetchLive("data/parlay_intelligence.json"),fetchLive("data/parlay_research_history.json")]);
  const coverage=d.readiness||{};const record=h.summary||{};
  $("gs-pi-dates").textContent=coverage.independent_settled_dates??"—";
  $("gs-pi-sims").textContent=(d.simulation_count_per_preview??0).toLocaleString();
  $("gs-pi-tracked").textContent=record.total_forward_eligible??0;
  $("gs-pi-record").textContent=(record.wins??0)+" W / "+(record.losses??0)+" L";
  const pairs=Object.entries(d.residual_correlations||{});
  $("gs-pi-correlations").innerHTML=pairs.map(([key,value])=>{
    const r=value.pearson;
    const label=r===null?"Insufficient paired errors":Math.abs(r)<0.1?"Weak observed relation":Math.abs(r)<0.3?"Modest observed relation":"Observed correlation; unvalidated";
    return "<tr><td>"+clean(key.replaceAll("_"," "))+"</td><td>"+clean(value.paired_player_games)+"</td><td>"+fmt(r)+"</td><td>"+label+"</td></tr>";
  }).join("")||'<tr><td colspan="4">No graded player data available yet</td></tr>';
  const holdout=coverage.sample_size_gate_passed?"Sample-size gate met, independent joint calibration still required":"Sample-size gate NOT met";
  $("gs-parlay-audit-summary").textContent=(d.status||"Research only").replaceAll("_"," ")+" · "+holdout+
    " · Last run: "+(d.generated_at_utc||"unknown");
  const exclusions=Object.entries(record.excluded_current_previews||{}).map(([k,n])=>k.replaceAll("_"," ")+": "+n).join(" · ");
  $("gs-pi-tracking-status").textContent=(record.pending??0)+" pending · "+(record.voids??0)+" void · "+
    "Excluded preview snapshots: "+(exclusions||"none")+
    ". Historical expired previews are never backfilled as pregame picks.";
  $("gs-pi-warning").textContent=d.notice||"No verified joint probabilities or EV";
 }catch(e){
  $("gs-parlay-audit-summary").textContent="Phase 3 audit unavailable: "+e.message;
  $("gs-pi-warning").textContent="Published strict parlays and research previews remain independent of this audit.";
 }finally{btn.disabled=false;}
}
$("gs-parlay-audit-refresh").onclick=refresh;
refresh();
})();