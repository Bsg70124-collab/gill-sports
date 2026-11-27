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
  const now=Date.now(),best=new Map();
  for(const r of markets){
    if(!r||!r.player_id||!["points","rebounds","assists","pra"].includes(r.stat))continue;
    const proj=Number(r.model_projection),line=Number(r.line);
    if(!Number.isFinite(proj)||!Number.isFinite(line)||line<=0)continue;
    const cap=Date.parse(r.odds_captured_at_utc||captured||"");
    const quote=Date.parse(r.market_last_update||"");
    const tip=Date.parse(r.tipoff_utc||"");
    if(!Number.isFinite(cap)||cap>now||now-cap>1800000||!Number.isFinite(quote)||quote>now||now-quote>1800000||!Number.isFinite(tip)||tip-now<=1200000||r.quote_stale_at_capture===true)continue;
    const score=Math.abs(proj-line)/Math.max(1,line),id=String(r.player_id);
    if(!best.has(id)||score>best.get(id).score)best.set(id,{row:r,score});
  }
  return best;
}
function render(){
  const mode=$("featured-mode").value,all=latestPlayers();
  const current=new Date().toLocaleDateString("en-CA",{timeZone:"America/Los_Angeles"});
  const pending=all.filter(r=>r.status==="PENDING"&&r.game_date>=current);
  const pool=pending.length?pending:all;
  const gaps=latestMarketGaps();
  let chosen;
  if(mode==="favorites")chosen=pool.filter(isFav).sort((a,b)=>String(b.game_date).localeCompare(String(a.game_date)));
  else if(mode==="gaps")chosen=pool.filter(r=>gaps.has(String(r.player_id))).sort((a,b)=>gaps.get(String(b.player_id)).score-gaps.get(String(a.player_id)).score);
  else chosen=pool.filter(r=>isFav(r)||popularRank.has(norm(r.player_name))).sort((a,b)=>Number(isFav(b))-Number(isFav(a))||(popularRank.get(norm(a.player_name))??999)-(popularRank.get(norm(b.player_name))??999));
  const shown=chosen.slice(0,12);
  $("featured-summary").textContent=mode==="gaps"
   ? shown.length+" players with recent pregame sportsbook quotes. Ranked by relative projection-versus-line gap, NOT betting probability or expected value."
   : favorites.size+" saved favorites · "+shown.length+" featured players · forecast published "+(updated||"unknown")+". "+(pending.length?"Showing pending upcoming forecasts.":"No upcoming pending player forecasts; showing latest archived records.");
  const reason=mode==="favorites"?"Use the player picker below to star favorites.":mode==="gaps"?"No fresh, pregame market quotes meet the 30-minute rule. Expired prices are not ranked as opportunities.":"No featured names are present in the latest forecast feed; use the picker to follow any player.";
  $("featured-cards").innerHTML=shown.map(r=>{
    const g=gaps.get(String(r.player_id))?.row;
    const fav=isFav(r),pts=Number(r.pred_points);
    const details=mode==="gaps"&&g
      ? '<b>Model '+esc(Number(g.model_projection).toFixed(1))+' / '+esc(g.stat)+' · Market '+esc(Number(g.line).toFixed(1))+'</b><div class="small">'+esc(g.bookmaker_title||g.bookmaker_key||"Sportsbook")+' · '+esc(g.side)+' · NOT a validated edge</div>'
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