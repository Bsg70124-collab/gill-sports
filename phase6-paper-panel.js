"use strict";
(() => {
  const mount = document.getElementById("tab-system");
  if (!mount) return;
  const section = document.createElement("section");
  section.className = "panel";
  section.innerHTML = '<h2>NBA paper picks · Pregame ledger</h2>' +
    '<p class="small">One simulated unit per player, game, stat and sportsbook. Locks require a quote updated in the last 30 minutes. Player availability is shown when verified.</p>' +
    '<p aria-live="polite">Loading pregame ledger…</p>' +
    '<div class="scroll"><table hidden><thead><tr><th>Player</th><th>Pick</th><th>Book</th><th>Price</th><th>Locked</th><th>Availability</th><th>Result</th></tr></thead><tbody></tbody></table></div>';
  mount.prepend(section);
  const status = section.querySelector("[aria-live]");
  fetch("data/calibration/nba_prop_paper_ledger.json", {cache: "no-store"})
    .then(response => {
      if (!response.ok) throw new Error("Ledger unavailable");
      return response.json();
    }).then(({rows}) => {
      const pending = rows.filter(row => row.result === "PENDING").length;
      const settled = rows.length - pending;
      const units = rows.reduce((sum, row) => sum + (row.profit_units ?? 0), 0);
      status.textContent = rows.length
        ? pending + " pending · " + settled + " settled" +
          (settled ? " · " + units.toFixed(2) + " units across all books" : "")
        : "Waiting for the first eligible pregame quote.";
      for (const pick of rows.slice(-25).reverse()) {
        const row = section.querySelector("tbody").insertRow();
        for (const value of [pick.player_name, pick.stat + " " + pick.side + " " + pick.line,
          pick.bookmaker_key, pick.american_price, new Date(pick.locked_at_utc).toLocaleString(),
          pick.availability_verified ? "Verified" : "Unverified", pick.result]) row.insertCell().textContent = value;
      }
      section.querySelector("table").hidden = !rows.length;
    }).catch(() => { status.textContent = "Pregame ledger unavailable."; });
})();
