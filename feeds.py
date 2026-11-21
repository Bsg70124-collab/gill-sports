"""Public ESPN scoreboard data. Not an official ESPN API; subject to change."""
import json, time, urllib.request
from datetime import date, timedelta

URL = 'https://site.api.espn.com/apis/site/v2/sports/{league}/{sport}/scoreboard?dates={day}&limit=300'

def fetch_day(sport, day, retries=2):
    league = 'basketball' if sport == 'nba' else 'football'
    req = urllib.request.Request(URL.format(league=league, sport=sport, day=day.strftime('%Y%m%d')),
                                 headers={'User-Agent': 'GillSportsResearch/1.0', 'Accept': 'application/json'})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                payload = json.load(response)
            break
        except Exception:
            if attempt == retries:
                raise
            time.sleep(1.5 * (attempt + 1))
    result = []
    for e in payload.get('events', []):
        comps = e.get('competitions', [])
        if not comps:
            continue
        c = comps[0]
        sides = {v.get('homeAway'): v for v in c.get('competitors', [])}
        if 'home' not in sides or 'away' not in sides:
            continue
        h, a = sides['home'], sides['away']
        complete = bool(e.get('status', {}).get('type', {}).get('completed'))
        def score(v):
            try: return float(v.get('score')) if complete else None
            except (TypeError, ValueError): return None
        result.append({'id': f'{sport}-{e["id"]}', 'sport': sport, 'start': e.get('date', ''),
                       'home_id': str(h['team']['id']), 'away_id': str(a['team']['id']),
                       'home': h['team'].get('displayName', 'Home'), 'away': a['team'].get('displayName', 'Away'),
                       'home_score': score(h), 'away_score': score(a), 'completed': complete})
    return result

def collect(sport, today, lookback=75):
    """Collect past days + today and tomorrow; partial failures are reported."""
    games, errors = {}, []
    for n in range(-lookback, 2):
        day = today + timedelta(days=n)
        try:
            for g in fetch_day(sport, day): games[g['id']] = g
        except Exception as exc:
            errors.append(f'{sport} {day}: {type(exc).__name__}: {exc}')
        time.sleep(.04)
    return list(games.values()), errors
