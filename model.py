"""Transparent, reproducible Elo model; NOT the proprietary original Sites code."""
import math
from datetime import datetime, timedelta, timezone

SPORTS = {'nba': {'base': 1500, 'home': 65, 'k': 22, 'lookback': 130},
          'nfl': {'base': 1500, 'home': 55, 'k': 28, 'lookback': 210}}

def expected(home_rating, away_rating, home_advantage=60):
    return 1 / (1 + 10 ** ((away_rating - home_rating - home_advantage) / 400))

def train_elo(games, sport, k=None):
    """Walk-forward training, oldest first; never includes uncompleted games."""
    cfg = SPORTS[sport]
    k = k or cfg['k']
    ratings, evaluation = {}, []
    for game in sorted(games, key=lambda g: (g['start'], g['id'])):
        if game.get('sport') != sport or not game.get('completed') or game.get('home_score') is None or game.get('away_score') is None:
            continue
        h, a = game['home_id'], game['away_id']
        rh, ra = ratings.get(h, cfg['base']), ratings.get(a, cfg['base'])
        p = expected(rh, ra, cfg['home'])
        actual = 1 if game['home_score'] > game['away_score'] else 0 if game['home_score'] < game['away_score'] else 0.5
        evaluation.append({'id': game['id'], 'p': p, 'actual': actual})
        change = k * (actual - p)
        ratings[h], ratings[a] = rh + change, ra - change
    return ratings, evaluation

def choose_k(games, sport):
    """Select K using the last 25% of walk-forward observations; avoid overfitting."""
    options = [12, 18, 22, 28, 36]
    candidates = []
    for k in options:
        _, evaluation = train_elo(games, sport, k)
        tail = evaluation[max(0, len(evaluation) * 3 // 4):]
        if len(tail) < 25:
            continue
        brier = sum((e['p'] - e['actual'])**2 for e in tail) / len(tail)
        candidates.append((brier, k))
    return min(candidates)[1] if candidates else SPORTS[sport]['k']

def project(games, sport, k=None):
    cfg = SPORTS[sport]
    k = k or cfg['k']
    ratings, validation = train_elo(games, sport, k)
    predictions = []
    for g in sorted(games, key=lambda x: x['start']):
        if g['sport'] != sport or g.get('completed'):
            continue
        p = expected(ratings.get(g['home_id'], cfg['base']), ratings.get(g['away_id'], cfg['base']), cfg['home'])
        predictions.append({**g, 'home_probability': round(p, 4), 'away_probability': round(1-p, 4),
                            'pick': g['home'] if p >= .5 else g['away'], 'confidence': round(max(p, 1-p), 4),
                            'model': 'elo-v1', 'k': k})
    return predictions, validation
