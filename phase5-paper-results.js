/* Descriptive paper results from the existing NBA quote and settlement archive. */
"use strict";

function summarizePaperResults(rows) {
  const selections = new Map();
  const markets = ["points", "rebounds", "assists", "pra"];
  const time = value => typeof value === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
    ? Date.parse(value) : NaN;
  for (const row of rows) {
    if (!row || !markets.includes(row.stat) || !row.game_id || !row.player_id ||
        !row.bookmaker_key || !row.quote_id || !/^\d{4}-\d{2}-\d{2}$/.test(row.game_date)) continue;
    const captured = time(row.odds_captured_at_utc);
    const tipoff = time(row.tipoff_utc);
    if (!(captured < tipoff) || !(time(row.market_last_update) <= captured)) continue;
    const {line, american_price: price, model_projection: projection} = row;
    if (![line, price, projection].every(Number.isFinite) || Math.abs(price) < 100) continue;
    const side = projection > line ? "Over" : "Under";
    if (projection === line || row.side !== side) continue;
    // Choose the first observed quote per player, game, stat and book.
    // Resolve a simultaneous capture by closest line, then by quote ID.
    const key = JSON.stringify([row.game_id, row.player_id, row.stat, row.bookmaker_key]);
    const previous = selections.get(key);
    const gap = Math.abs(projection - line);
    if (!previous || captured < previous.captured ||
        (captured === previous.captured && (gap < previous.gap ||
          (gap === previous.gap && row.quote_id < previous.row.quote_id)))) {
      selections.set(key, {row, captured, gap});
    }
  }
  const groups = new Map();
  for (const {row} of selections.values()) {
    const {stat, bookmaker_key: book, actual_stat: actual, line, side, american_price: price} = row;
    let result = row.result === "VOID" ? "VOID" : null;
    if (!result && Number.isFinite(actual)) {
      result = actual === line ? "PUSH" : (actual > line) === (side === "Over") ? "WIN" : "LOSS";
      if (result !== row.result) result = null;
    }
    if (!result) continue;
    const key = JSON.stringify([stat, book]);
    if (!groups.has(key)) groups.set(key, {
      stat, book, wins: 0, losses: 0, pushes: 0, voids: 0, profit: 0,
      games: new Set(), dates: new Set(), verified: 0,
    });
    const entry = groups.get(key);
    entry.games.add(row.game_id);
    entry.dates.add(row.game_date);
    entry.verified += Number(row.verified_pregame_availability === true);
    if (result === "WIN") {
      entry.wins++;
      entry.profit += price > 0 ? price / 100 : 100 / -price;
    } else if (result === "LOSS") {
      entry.losses++;
      entry.profit--;
    } else if (result === "PUSH") entry.pushes++;
    else entry.voids++;
  }
  return [...groups.values()].map(entry => ({
    ...entry, games: entry.games.size, dates: entry.dates.size,
    roi: entry.wins + entry.losses + entry.pushes
      ? entry.profit / (entry.wins + entry.losses + entry.pushes) : null,
  })).sort((a, b) => a.stat.localeCompare(b.stat) || a.book.localeCompare(b.book));
}

if (typeof module !== "undefined") module.exports = {summarizePaperResults};

if (typeof document !== "undefined") {
  const mount = document.getElementById("tab-system");
  if (mount) {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = '<h2>NBA player props · Paper results</h2>' +
      '<p class="small">One unit per first settled, archived model-direction quote per player, game, stat and sportsbook. Books can cover the same games. Returns are historical simulations at recorded prices.</p>' +
      '<p data-status aria-live="polite">Loading paper results…</p>' +
      '<div class="scroll"><table hidden><thead><tr>' +
      '<th>Stat</th><th>Book</th><th>Games</th><th>Dates</th><th>Wins</th><th>Losses</th><th>Pushes</th><th>Voids</th>' +
      '<th>Verified availability</th><th>Paper return</th></tr></thead><tbody></tbody></table></div>';
    mount.append(panel);
    const status = panel.querySelector("[data-status]");
    const read = async path => {
      const response = await fetch(path, {cache: "no-store"});
      if (!response.ok) throw new Error("Paper data unavailable");
      return response.json();
    };
    Promise.all([
      read("data/calibration/nba_prop_outcome_history.json"),
      read("data/calibration/nba_prop_probability_calibration_latest.json").catch(() => null),
    ]).then(([history, calibration]) => {
      if (!Array.isArray(history.rows)) throw new Error("Invalid paper history");
      const results = summarizePaperResults(history.rows);
      status.textContent = results.length ? "Historical paper results only. " : "No eligible settled quotes. ";
      if (calibration?.calibrated_for_betting !== true) {
        status.textContent += "Calibrated betting probabilities are unavailable.";
      }
      for (const row of results) {
        const tr = document.createElement("tr");
        for (const value of [row.stat, row.book, row.games, row.dates, row.wins, row.losses,
          row.pushes, row.voids, row.verified, row.roi === null ? "—" : (100 * row.roi).toFixed(1) + "%"]) {
          tr.insertCell().textContent = value;
        }
        panel.querySelector("tbody").append(tr);
      }
      panel.querySelector("table").hidden = !results.length;
    }).catch(() => { status.textContent = "Paper results are temporarily unavailable."; });
  }
}
