(() => {
"use strict";
const $ = id => document.getElementById(id);
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = v => String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
const popular = ["Nikola Jokic","Luka Doncic","Shai Gilgeous-Alexander","Giannis Antetokounmpo","Jayson Tatum","Stephen Curry","Anthony Edwards","Victor Wembanyama","LeBron James","Kevin Durant","Jalen Brunson","Donovan Mitchell","Devin Booker","Cade Cunningham","LaMelo Ball","Jaylen Brown","Kyrie Irving","Tyrese Haliburton"];
const popularRank = new Map(popular.map((name,i)=>[norm(name),i]));
const savedKey="gillSportsFavoritePlayerIdsV1";
let favorites=new Set(), players=[],markets=[],captured=null,updated=null;
try { const value=JSON.parse(localStorage.getItem(savedKey)||"[]");if(Array.isArray(value))favorites=new Set(value.map(String)); } catch {}
function store(){try{localStorage.setItem(savedKey,JSON.stringify([...favorites]));}catch{}}
function isFav(r){return favorites.has(String(r.player_id));}
function toggle(id){id=String(id);if(favorites.has(id))favorites.delete(id);else favorites.add(id);store();render();}
function latestPlayers() {
  const m=new Map();
  for(const r of players){
    if(!r||!r.player_id||!r.player_name||!r.game_date)continue;
    const key=String(r.player_id),old=m.get(key);
    if(!old||String(r.game_date)>String(old.game_date)||(r.game_date===old.game_date&&r.status==="PENDING"&&old.status!=="PENDING"))m.set(key,r);
  }
  return [...m.values()];
}
function latestMarketGaps(){
  const now=Date.now(),fresh=new Map(),historical=new Map();
  for(const r of markets){
    if(!r||!r.player_id||!["points","rebounds","assists","pra"].includes(r.stat))continue;
    const proj=Number(r.model_projection),line=Number(r.line);
    if(!Number.isFinite(proj)||!Number.isFinite(line)||line<=0)continue;
    const cap=Date.parse(r.odds_captured_at_utc||captured||"");
    const quote=Date.parse(r.market_last_update||"");
    const tip=Date.parse(r.tipoff_utc||"");
    if(!Number.isFinite(cap)||!Number.isFinite(quote)||!Number.isFinite(tip)||cap>=tip||r.quote_stale_at_capture===true)continue;
    // Rank per player and game; old quotes are available only as historical research.
    const score=Math.abs(proj-line)/Math.max(1,line);
    const id=String(r.player_id),item={row:r,score};
    if(!historical.has(id)||score>historical.get(id).score)historical.set(id,item);
    const isFresh=cap<=now&&now-cap<=30*60000&&quote<=now&&now-quote<=30*60000&&tip-now>20*60000;
    if(isFresh&&(!fresh.has(id)||score>fresh.get(id).score))fresh.set(id,item);
  }
  return {fresh,historical};
}
function render(){
  const mode=$("featured-mode").value,all=latestPlayers();
  const current=new Date().toLocaleDateString("en-CA",{timeZone:"America/Los_Angeles"});
  const pending=all.filter(r=>r.status==="PENDING"&&r.game_date>=current);
  // Always retain saved favorites even when their latest forecast is archived.
  const pool=[...new Map([...all.filter(isFav),...(pending.length?pending:all)].map(r=>[String(r.player_id),r])).values()];
  const gapSets=latestMarketGaps();
  const useHistorical=mode==="gaps"&&gapSets.fresh.size===0;
  const gaps=mode==="gaps"?(useHistorical?gapSets.historical:gapSets.fresh):gapSets.fresh;
  let chosen;
  if(mode==="favorites")chosen=pool.filter(isFav).sort((a,b)=>String(b.game_date).localeCompare(String(a.game_date)));
  else if(mode==="gaps") {
    const lookup=new Map(players.filter(p=>p&&p.player_id).map(p=>[String(p.player_id)+"|"+String(p.game_id),p]));
    chosen=[...gaps.values()].sort((a,b)=>b.score-a.score).map(v=>{
      const q=v.row;
      return lookup.get(String(q.player_id)+"|"+String(q.game_id))||all.find(p=>String(p.player_id)===String(q.player_id))||
        {player_id:q.player_id,player_name:q.player_name,matchup:q.matchup,game_date:q.game_date,status:"UNVERIFIED"};
    }).filter((r,i,arr)=>arr.findIndex(x=>String(x.player_id)===String(r.player_id))===i);
  }
  else chosen=pool.filter(r=>isFav(r)||popularRank.has(norm(r.player_name))).sort((a,b)=>Number(isFav(b))-Number(isFav(a))||(popularRank.get(norm(a.player_name))??999)-(popularRank.get(norm(b.player_name))??999));
  const shown=chosen.slice(0,12);
  $("featured-summary").textContent=mode==="gaps"
   ? shown.length+" players with model-vs-market differences · "+(useHistorical?"HISTORICAL / EXPIRED quotes; NOT actionable. ":"Recent pregame quotes; availability unverified. ")+"Ranked by relative projection-versus-line difference, NOT model win probability, betting edge or expected value."
   : favorites.size+" saved favorites · "+shown.length+" featured players · forecast published "+(updated||"unknown")+". "+(pending.length?"Showing pending upcoming forecasts.":"No upcoming pending player forecasts; showing latest archived records.");
  const reason=mode==="favorites"?"Use the player picker below to star favorites.":mode==="gaps"?"No usable historical or fresh quotes with a verified pre-tip timestamp and model projection were found.":"No featured names are present in the latest forecast feed; use the picker to follow any player.";
  $("featured-cards").innerHTML=shown.map(r=>{
    const g=gaps.get(String(r.player_id))?.row;
    const fav=isFav(r),pts=Number(r.pred_points);
    const details=mode==="gaps"&&g
      ? '<b>Model '+esc(Number(g.model_projection).toFixed(1))+' / '+esc(g.stat)+' · Market '+esc(Number(g.line).toFixed(1))+'</b><div class="small">'+esc(g.bookmaker_title||g.bookmaker_key||"Sportsbook")+' · '+esc(g.side)+' · '+(useHistorical?'EXPIRED historical quote':'Recent pregame quote')+' · Captured '+esc(g.odds_captured_at_utc||captured||'Unknown')+' · NOT a validated edge</div>'
      : '<b>PTS '+(Number.isFinite(pts)?pts.toFixed(1):"—")+'</b><div class="small">REB '+esc(r.pred_rebounds??"—")+' · AST '+esc(r.pred_assists??"—")+' · PRA '+esc(r.pred_pra??"—")+'</div>';
    return '<article class="gs-featured-card"><button class="gs-favorite-star" data-id="'+esc(String(r.player_id))+'" aria-pressed="'+fav+'" aria-label="'+(fav?"Remove ":"Favorite ")+esc(r.player_name)+'">'+(fav?"★":"☆")+'</button><strong>'+esc(r.player_name)+'</strong><div class="small">'+esc(r.matchup)+' · '+esc(r.game_date)+' · '+esc(r.status)+'</div><div class="gs-featured-proj">'+details+'</div><div class="small">Availability not independently verified</div></article>';
  }).join("")||'<p class="small">'+esc(reason)+'</p>';
}
function fillPicker(){
  const select=$("featured-player-picker"),val=select.value;
  const list=latestPlayers().sort((a,b)=>String(a.player_name).localeCompare(String(b.player_name)));
  select.innerHTML='<option value="">Choose a player to favorite</option>'+list.map(r=>'<option value="'+esc(String(r.player_id))+'">'+esc(r.player_name)+'</option>').join("");
  if(list.some(r=>String(r.player_id)===val))select.value=val;
}
async function load(){
  const btn=$("featured-refresh");btn.disabled=true;
  $("featured-summary").textContent="Checking latest published player and sportsbook data...";
  try{
    const outcomes=await Promise.allSettled(["data/player_live.json","data/nba_market_comparison.json"].map(async path=>{
      const response=await fetch(path+"?v="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw Error(path+" HTTP "+response.status);
      return response.json();
    }));
    if(outcomes[0].status!=="fulfilled"||!Array.isArray(outcomes[0].value.rows))throw Error("Player feed unavailable");
    players=outcomes[0].value.rows;updated=outcomes[0].value.updated_at_utc;
    const market=outcomes[1].status==="fulfilled"?outcomes[1].value:null;
    markets=Array.isArray(market?.rows)?market.rows:[];captured=market?.odds_captured_at_utc||null;
    fillPicker();render();
  }catch(error){$("featured-summary").textContent="Could not refresh featured players: "+error.message;}
  finally{btn.disabled=false;}
}
$("featured-cards").addEventListener("click",event=>{
  const button=event.target.closest("button[data-id]");
  if(button)toggle(button.dataset.id);
});
$("featured-mode").addEventListener("change",render);
$("featured-refresh").addEventListener("click",load);
$("featured-player-add").addEventListener("click",()=>{
  const id=$("featured-player-picker").value;
  if(id){favorites.add(id);store();$("featured-mode").value="favorites";render();}
});
load();
})();