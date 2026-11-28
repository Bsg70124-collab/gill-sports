"use strict";
const assert = require("node:assert/strict");
const {summarizePaperResults} = require("./phase5-paper-results.js");

const quote = {
  quote_id: "first", game_id: "1", player_id: "2", game_date: "2026-11-25",
  stat: "points", bookmaker_key: "book", line: 10.5, american_price: -125,
  model_projection: 11, side: "Over", actual_stat: 12, result: "WIN",
  odds_captured_at_utc: "2026-11-26T01:00:00Z",
  market_last_update: "2026-11-26T00:59:00Z", tipoff_utc: "2026-11-26T02:00:00Z",
};

const [report] = summarizePaperResults([
  {...quote, quote_id: "later", american_price: 200, odds_captured_at_utc: "2026-11-26T01:30:00Z"},
  quote,
  {...quote, player_id: "3", actual_stat: 10, result: "LOSS"},
  {...quote, player_id: "4", actual_stat: 10, line: 10, result: "PUSH"},
  {...quote, player_id: "5", actual_stat: null, result: "VOID"},
  {...quote, player_id: "6", odds_captured_at_utc: quote.tipoff_utc},
  {...quote, player_id: "7", market_last_update: quote.tipoff_utc},
  {...quote, player_id: "8", side: "Under"},
  {...quote, player_id: "9", american_price: -99},
  {...quote, player_id: "10", result: "LOSS"},
]);
assert.deepEqual([report.wins, report.losses, report.pushes, report.voids], [1, 1, 1, 1]);
assert.ok(Math.abs(report.roi - (-0.2 / 3)) < 1e-12);
assert.equal(summarizePaperResults([{...quote, american_price: 140}])[0].roi, 1.4);
assert.deepEqual(summarizePaperResults([]), []);
