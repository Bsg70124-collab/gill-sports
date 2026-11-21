"""Fetch, lock predictions before tipoff, settle, calibrate, save. Python stdlib only."""
import argparse, json, os, tempfile
from datetime import datetime, date, timezone
from pathlib import Path
from feeds import collect
from model import SPORTS, choose_k, project

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)

def load(name, default):
    path = DATA / name
    if not path.exists(): return default
    with path.open(encoding='utf-8') as f: return json.load(f)

def save(name, obj):
    target = DATA / name
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=DATA, delete=False) as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        tmp = f.name
    os.replace(tmp, target)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sport', choices=['nba', 'nfl', 'all'], default='all')
    parser.add_argument('--lookback', type=int, default=75)
    args = parser.parse_args()
    if not 1 <= args.lookback <= 240: parser.error('--lookback must be 1..240')
    now = datetime.now(timezone.utc)
    stored = load('live.json', {'games': {}, 'forecasts': {}, 'errors': [], 'last_refresh': None})
    sports = list(SPORTS) if args.sport == 'all' else [args.sport]
    fresh_count = 0
    errors = []
    for sport in sports:
        games, fetch_errors = collect(sport, now.date(), args.lookback)
        errors.extend(fetch_errors)
        if not games:
            errors.append(f'{sport}: no data received; prior data preserved')
            continue
        for g in games: stored['games'][g['id']] = g
        all_games = [g for g in stored['games'].values() if g['sport'] == sport]
        completed = [g for g in all_games if g['completed']]
        # Recalibrate K only after at least 100 settled forecasts; otherwise use fixed default.
        settled_count = sum(1 for p in stored['forecasts'].values() if p['sport'] == sport and p.get('result') in ('win', 'loss'))
        k = choose_k(completed, sport) if settled_count >= 100 else SPORTS[sport]['k']
        predictions, _ = project(all_games, sport, k)
        for p in predictions:
            try: start = datetime.fromisoformat(p['start'].replace('Z', '+00:00'))
            except ValueError: continue
            if start <= now: continue
            if p['id'] not in stored['forecasts']:
                stored['forecasts'][p['id']] = {**p, 'locked_at': now.isoformat(), 'result': 'pending'}
                fresh_count += 1
        for id_, p in stored['forecasts'].items():
            g = stored['games'].get(id_)
            if not g or not g['completed'] or p.get('result') != 'pending': continue
            if g['home_score'] is None or g['away_score'] is None or g['home_score'] == g['away_score']:
                p['result'] = 'void'; continue
            winner = g['home'] if g['home_score'] > g['away_score'] else g['away']
            p['result'] = 'win' if winner == p['pick'] else 'loss'
            p['settled_at'] = now.isoformat()
            p['final_score'] = f'{g["away"]} {g["away_score"]:g} – {g["home"]} {g["home_score"]:g}'
    stored['last_refresh'] = now.isoformat()
    stored['errors'] = errors[:100]
    save('live.json', stored)
    print(f'Refresh complete: {fresh_count} new locked forecasts; {len(stored["forecasts"])} total; {len(errors)} feed errors')
    if errors: print('Warning: partial data feed failures. See data/live.json')

if __name__ == '__main__': main()
