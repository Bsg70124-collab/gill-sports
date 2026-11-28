"use strict";
const fs = require("node:fs");

const markets = ["points", "rebounds", "assists", "pra"];
const timestamp = value => typeof value === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
  ? Date.parse(value) : NaN;
const key = row => JSON.stringify([String(row.game_id), String(row.player_id), row.stat, row.bookmaker_key]);
const playerKey = row => JSON.stringify([String(row.game_id), String(row.player_id)]);

function updateLedger(picks, quotes, players, now) {
  const existing = new Set(picks.map(key));
  const candidates = new Map();
  for (const row of quotes) {
    if (!row?.game_id || !row.player_id || !row.bookmaker_key || !markets.includes(row.stat)) continue;
    const {line, american_price: price, model_projection: projection} = row;
    if (![line, price, projection].every(Number.isFinite) || Math.abs(price) < 100 || projection === line ||
        row.side !== (projection > line ? "Over" : "Under")) continue;
    const tip = timestamp(row.tipoff_utc);
    const captured = timestamp(row.odds_captured_at_utc);
    const updated = timestamp(row.market_last_update);
    if (!(updated <= captured && captured <= now && now + 120000 < tip && now - updated <= 1800000)) continue;
    const id = key(row);
    if (existing.has(id)) continue;
    const previous = candidates.get(id);
    if (!previous || Math.abs(projection - line) < Math.abs(previous.model_projection - previous.line) ||
        (line === previous.line && price > previous.american_price)) candidates.set(id, row);
  }

  const settled = new Map();
  for (const row of players) {
    if (row?.status !== "SETTLED" || !row.game_id || !row.player_id) continue;
    const id = playerKey(row);
    settled.set(id, settled.has(id) ? null : row);
  }
  const locked = [...candidates.values()].map(row => ({
    game_id: String(row.game_id), player_id: String(row.player_id), player_name: row.player_name,
    game_date: row.game_date, matchup: row.matchup, stat: row.stat, side: row.side,
    bookmaker_key: row.bookmaker_key, line: row.line, american_price: row.american_price,
    model_projection: row.model_projection, odds_captured_at_utc: row.odds_captured_at_utc,
    market_last_update: row.market_last_update, tipoff_utc: row.tipoff_utc,
    availability_verified: row.availability_verified === true,
    locked_at_utc: new Date(now).toISOString(), result: "PENDING",
  }));
  return [...picks.map(pick => {
    if (pick.result !== "PENDING" || !(timestamp(pick.tipoff_utc) < now)) return pick;
    const player = settled.get(playerKey(pick));
    const actual = player?.game_date === pick.game_date && player["actual_" + pick.stat];
    if (!Number.isFinite(actual)) return pick;
    const result = actual === pick.line ? "PUSH" :
      (actual > pick.line) === (pick.side === "Over") ? "WIN" : "LOSS";
    const price = pick.american_price;
    return {...pick, result, actual_stat: actual, settled_at_utc: new Date(now).toISOString(),
      profit_units: result === "WIN" ? (price > 0 ? price / 100 : 100 / -price) :
        result === "LOSS" ? -1 : 0};
  }), ...locked];
}

module.exports = {updateLedger};
if (require.main === module) {
  const path = "data/calibration/nba_prop_paper_ledger.json";
  const read = file => {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data.rows)) throw new Error("Invalid rows in " + file);
    return data.rows;
  };
  const before = read(path);
  const after = updateLedger(before, read("data/nba_market_comparison.json"), read("data/player_live.json"), Date.now());
  console.log("Locked:", after.length - before.length,
    "Settled:", after.filter(pick => pick.result !== "PENDING").length);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    fs.writeFileSync(path, JSON.stringify({schema_version: 1, rows: after}, null, 2) + "\n");
  }
}
