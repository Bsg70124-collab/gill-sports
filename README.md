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
