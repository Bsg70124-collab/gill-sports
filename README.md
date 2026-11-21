# Gill Sports migration backup

This repository snapshot contains the exported state of the existing Gill Sports Prediction Lab site.

## Contents
- `data/gill-sports-state.json`: 197 historical match-winner forecasts, model metadata and feed status, exported November 21, 2026.
- `verify_backup.py`: validates the JSON structure and counts outcomes.

## Verification
Run `python verify_backup.py` from the project folder.

## Important limitations
- This is a **data backup**, not the website source code or a running model.
- The export includes 117 wins, 54 losses, 26 pending forecasts; 171 settled, 68.42% settled hit rate.
- Player-prop and parlay histories are **not** present in this export.
- The export reports the feed as `Not connected` and model version `baseline-1` with 0 compatible samples.
- No GitHub Actions, external hosting, or automatic retraining has been set up by this package.
- Keep the old site running until replacement data and workflows have been verified.
