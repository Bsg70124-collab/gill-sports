"use strict";
const assert = require("node:assert/strict");
const {updateLedger} = require("./phase6-paper-ledger.js");
const quote = {
  game_id: 1, player_id: 2, game_date: "2026-11-27", stat: "points",
  bookmaker_key: "book", line: 21.5, american_price: -125, model_projection: 23, side: "Over",
  tipoff_utc: "2026-11-28T00:00:00Z", odds_captured_at_utc: "2026-11-27T23:45:00Z",
  market_last_update: "2026-11-27T23:44:00Z",
};
const now = Date.parse("2026-11-27T23:50:00Z");
const locked = updateLedger([], [quote], [], now);
assert.equal(locked.length, 1);
assert.equal(locked[0].result, "PENDING");
assert.deepEqual(updateLedger(locked, [{...quote, line: 22.5}], [], now), locked);
for (const bad of [{market_last_update: "2026-11-27T22:00:00Z"},
  {tipoff_utc: "2026-11-27T23:49:00Z"}, {american_price: 0}, {side: "Under"}]) {
  assert.deepEqual(updateLedger([], [{...quote, ...bad}], [], now), []);
}
const player = {game_id: 1, player_id: 2, game_date: quote.game_date, actual_points: 22, status: "SETTLED"};
const later = now + 36000000;
assert.deepEqual(updateLedger(locked, [], [player], now), locked);
assert.deepEqual(updateLedger(locked, [], [player, player], later), locked);
const graded = updateLedger(locked, [], [player], later);
assert.equal(graded[0].result, "WIN");
assert.equal(graded[0].profit_units, 0.8);
assert.equal(graded[0].locked_at_utc, locked[0].locked_at_utc);
assert.deepEqual(updateLedger(graded, [], [{...player, actual_points: 0}], later), graded);
