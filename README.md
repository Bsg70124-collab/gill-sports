# Gill Sports — Independent Model v1

**This is a new, working model implementation, not recovered source code from the original ChatGPT Sites project.** Original exported forecasts, player records, and paper parlays are preserved in `data/` and displayed as an archive. The **new** model currently generates NBA/NFL **game-winner** probabilities using transparent Elo. It does not yet generate fresh player props, sportsbook odds-based edges, PrizePicks/Kalshi picks, or new parlays. Do not represent its picks as profitable bets.

## Run on Windows (Python 3.10+)

1. Extract ZIP into a folder such as `Documents\gill-sports-code`.
2. Open the folder in File Explorer, click the address bar, type `cmd`, press Enter.
3. Run `py workflow.py --lookback 75` (first run may take a few minutes and requires internet).
4. Run `py server.py`.
5. Open **http://127.0.0.1:8765** on that computer. The **Refresh projections** button executes the workflow and updates the dashboard.

No pip install or API key is needed. If `py` isn't available, install Python from python.org and enable PATH, or use `python` instead.

## GitHub automation

Copy the extracted files into your private `gill-sports` GitHub repo folder, commit and push with GitHub Desktop. The `.github/workflows/daily.yml` workflow runs once a day around **16:15 UTC** and commits `data/live.json` back to GitHub. GitHub scheduled workflows can be delayed or disabled; they are not guaranteed to run exactly on time. You can manually run it in GitHub → Actions → Refresh Gill Sports data → Run workflow. Repository Actions permissions must allow writing contents. The local dashboard **does not** automatically publish as a public website; it binds to localhost for safety. Accessing it from an iPhone requires separate secure hosting and authentication.

## Model behavior

- Public ESPN scoreboard feed (unofficial; may change or be unavailable). Completed games are used to update Elo ratings in chronological order. Home advantage is configurable in `model.py`.
- Probabilities are generated for scheduled games. Forecasts are locked in `data/live.json` **before start** and never overwritten by subsequent model updates.
- Completed games settle previously locked forecasts. Metrics use only the new model's settled picks, not imported history.
- After **100 settled forecasts per sport**, K is selected using the last 25% of historical walk-forward evaluations (minimum 25 games). This is a basic parameter refresh, not a LightGBM retrain.
- Historical archives are not mixed with the new model's calibration or results.
- ESPN feed errors are recorded in `data/live.json` and existing data is preserved; missing feed dates can impair ratings. Verify coverage before relying on any predictions.

## Limits and security

This is a baseline, not a reproduction of the original LightGBM/Monte Carlo model. It does not incorporate injuries, rest, live odds, line shopping, or bankroll controls. The refresh endpoint has **no authentication** and is intentionally bound to `127.0.0.1` only. Do not expose port 8765 to the internet. Keep your GitHub repository private because the archives may contain sensitive details. Do not commit tokens or API keys.

## Files

- `model.py` — Elo probabilities, walk-forward evaluation, simple K calibration
- `feeds.py` — ESPN NBA/NFL schedule and scores
- `workflow.py` — refresh, lock, settle, save
- `server.py` and `index.html` — local dashboard and functional Refresh button
- `data/forecasts.json`, `data/players.json`, `data/parlays.json` — recovered archives
- `.github/workflows/daily.yml` — optional daily GitHub Actions update

## Current hosted dashboard: GitHub Pages / on-demand jobs (November 2026)

Live site: https://bsg70124-collab.github.io/gill-sports/

The hosted site is a **static GitHub Pages site**. Its per-tab refresh buttons only fetch
recently published JSON and do not themselves generate new predictions.

### Optional "Run now" backend controls

The separate `github-actions-control.js` file adds authenticated workflow-dispatch
buttons for game projections, NBA player projections, sportsbook snapshots,
settlement, research previews, probability-calibration checks, and controlled retraining.

To enable them on the public site:

1. Sign in to your own GitHub account on GitHub. Create a **fine-grained**, short-lived
   personal access token restricted to the two repositories
   `Bsg70124-collab/gill-sports` and `Bsg70124-collab/gill-sports-engine`
   (or only the repository required for the selected workflow).
2. Grant repository permission **Actions: Read and write**. Do not grant unnecessary
   administration, contents, issues, or secrets permissions.
3. Open the dashboard and select **Connect GitHub for one-click runs**. Enter this
   limited token *only on your own trusted device*. It is kept in JavaScript page
   memory and discarded when the page is reloaded or closed. Do not post it in chat,
   put it in repository files, or use an unrestricted/classic token.
4. Choose a **Run** action. An accepted GitHub API dispatch means a job was queued,
   **not** that it succeeded. Check the GitHub Actions page for its result and
   reload data after publication.

This opt-in browser-token solution has the normal risks of entering secrets in a
web page. The preferred long-term production option is a separately hosted
OAuth/GitHub App backend; GitHub Pages alone cannot securely store service secrets.
The site also keeps links to GitHub's authenticated Actions interface as fallback.
The app never stores a token in browser localStorage or sessionStorage.

### Calibration and independently gated model edges

Historical outcomes are stored in
`data/calibration/nba_prop_outcome_history.json`. The walk-forward calibration
workflow `gill-sports-probability-calibration-v1.yml` runs daily and on supported
updates. It requires adequate independent games and dates, strictly later holdout
observations, verified pregame player availability, and improvement against a
sportsbook probability baseline. The model publishes **no betting probabilities**
until the holdout gates pass.

`gill-sports-validated-prop-edge-gate.yml` then checks only independently
holdout-approved market models, recent pre-tip sportsbook prices, matching quote
timestamps, model direction, price-adjusted expected return, and a conservative
probability stress check. It writes `data/validated_player_edges.json`, which
can legitimately contain **zero** opportunities. The strict parlay generator
reads this gated feed and also rejects stale or unmatched snapshots.
These are uncertain model estimates, never guaranteed or advice to wager.

**As of the first audit on November 27, 2026:** 802 sportsbook outcomes checked,
zero holdout-approved market models, and zero validated positive edges. This is
a data/validation limitation rather than a failed automation. Research parlay
previews stay separate and may use expired quotes, labeled as non-bettable.

The workflows collecting paid sportsbook quotes retain a daily API budget cap.


## November 2026 upgrade stages: prediction intelligence, mobile, parlays

### Stage 1 — Prediction intelligence and data quality

`quality_audit.py` reads published player forecasts and final actual statistics and writes
`data/model_quality_report.json` with per-market MAE, RMSE, signed bias, recent game-date
trends, per-player error samples, duplicate/missing-data warnings, and stale-odds warnings.
The `gill-sports-forecast-quality.yml` workflow runs on relevant data updates and on a
daily schedule. The **Model & Feeds** tab displays measured stats and limitations.
This audit measures descriptive forecast errors; it is **not** a fitted betting model,
calibrated win probability, or injury-adjusted projection.

### Stage 2 — iPhone and mobile

`app.webmanifest`, `gill-icon.svg`, `mobile-app.js`, and `service-worker.js`
provide an installable home-screen web-app shell, responsive mobile navigation and an
offline warning. On iPhone, in Safari use **Share → Add to Home Screen**.
Current sportsbook data, player forecasts, and private GitHub jobs all require a network.
The service worker caches the static shell, **never** market or projection JSON feeds.
This does not replace the separately planned secure GitHub OAuth/App backend;
manual workflows can be opened directly through **Run in GitHub (no token)**.

### Stage 3 — Advanced parlay research

The `gill-sports-parlay-research-previews.yml` workflow selects no repeated players
or games, spreads legs across market/stat categories when feasible, and publishes
explicit `risk_flags` and `diversification` metadata for every 2-, 3-, and 4-leg
research preview. The dashboard and CSV export display these warnings.
Diversification across distinct games reduces some obvious shared-event exposures,
but it **does not establish statistical independence, validated correlation
coefficients, parlay win probability, or expected value**.
Expired quotes and unverified availability are still marked **NOT BETTABLE**.

The dashboard smoke test validates new JavaScript, web manifest, JSON schemas, and
that no research preview repeats a game/player or asserts a joint win probability.


## Phase 3 — Parlay Intelligence (implemented November 2026)

This stage adds **working, automated research analytics** rather than unverified picks:

- `parlay_intelligence.py`: collects only uniquely keyed, settled player-game forecasts; calculates empirical stat-error correlations; performs reproducible 10,000-draw residual-bootstrap Monte Carlo experiments per 2-, 3-, and 4-leg research preview. Different games are sampled separately. The simulation output never claims calibrated joint betting probabilities or expected value. Residual samples are strictly from dates preceding each preview.
- `data/parlay_intelligence.json`: independent historical sample counts, modeling readiness criteria, correlation coefficients, per-preview simulation run statuses, odds staleness, and explicit blockers. Training/holdout readiness requires 15/5 independent game dates and 250/100 graded player-games; meeting these preliminary thresholds still does **not** validate a probability without forward holdout calibration.
- `data/parlay_research_history.json`: append-only forward research record. A research preview is archived only if the published quote was **still fresh at creation**, the workflow processes it within 10 minutes, all games are still at least 20 minutes before tipoff, and each leg uses a different player and game. Old snapshots are **never** backfilled as pregame picks. Each archived leg is graded only against the exact final player ID/game ID/date record; ambiguous DNP/unmatched player rows remain unresolved, never counted as a win or assumed zero.
- `.github/workflows/gill-sports-parlay-intelligence.yml`: schedule, published preview completion, and relevant feed changes trigger the Monte Carlo/grade pipeline; the workflow runs `test_parlay_intelligence.py` and asserts no betting probabilities or EV leak into published results.
- `parlay-intelligence-panel.js`: adds the Parlay Intelligence section in the dashboard's **Parlays** tab with historical correlation readings, sample size, simulation status, and a separate forward-tracking W/L/P/V record.

**Current limitations:** The available sample is concentrated in four distinct settled game dates, player availability has not been independently verified, and the latest sportsbook snapshot has expired. Consequently, **zero validated joint probabilities** and **zero approved positive-EV new slips** are published. Source data and scheduled workflows can fail or be stale. A real injury-integrated pricing model, out-of-sample joint calibration, and validated outcome correlation estimates remain future scientific/modeling work; the current release is a research and accountability system, not a wagering recommendation engine.

Phase 3 remains separate from the existing strict, fail-closed `gill-sports-daily-parlay-generator-v2.yml` and historical `gill-sports-parlay-settlement.yml`; neither is overwritten or granted false confidence by the experimental Monte Carlo output.
