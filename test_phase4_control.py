"""Tests for phase 4: never backfill current results, future data or treat injury absence as healthy."""
import tempfile,unittest,json
from datetime import datetime,timedelta,timezone
from pathlib import Path
from phase4_control import feed_status,overlay,historical_baseline,generate
T=datetime(2026,11,27,20,0,tzinfo=timezone.utc)

class Phase4(unittest.TestCase):
    def test_missing_feeds_fail_closed(self):
        with tempfile.TemporaryDirectory() as p:
            states=feed_status(Path(p),T)
            self.assertTrue(all(x["state"]=="MISSING_OR_INVALID" for x in states.values()))
    def test_stale_fresh_and_future_feeds(self):
        with tempfile.TemporaryDirectory() as p:
            root=Path(p);(root/"data").mkdir()
            (root/"data/live.json").write_text(json.dumps({"last_refresh":(T-timedelta(hours=3)).isoformat()}))
            (root/"data/player_live.json").write_text(json.dumps({"updated_at_utc":(T+timedelta(hours=2)).isoformat()}))
            status=feed_status(root,T)
            self.assertEqual(status["games"]["state"],"STALE")
            self.assertEqual(status["player_projections"]["state"],"FUTURE_TIMESTAMP")
    def test_injury_absence_never_verified_and_flagged_out(self):
        players={"rows":[{"status":"PENDING","game_date":"2026-11-27","game_id":"123","player_id":12,"player_name":"Player One","pred_minutes":32,"pred_points":22,"pred_rebounds":5,"pred_assists":4},
                         {"status":"SETTLED","game_date":"2026-11-27","game_id":"124","player_id":13,"player_name":"Old Player"}]}
        injuries={"rows":[{"game_id":"123","player_name":"Player One","injury_status":"Out"}]}
        data=overlay(players,injuries,True,T)
        self.assertEqual(data["counts"]["BLOCK_RESEARCH"],1)
        self.assertFalse(data["player_rows"][0]["availability_verified"])
        self.assertNotIn("pred_points",data["player_rows"][0])
        data=overlay(players,injuries,False,T)
        self.assertEqual(data["counts"]["UNVERIFIED"],1)
        self.assertEqual(len(data["player_rows"]),1)
    def test_questionable_sensitivity_is_illustrative(self):
        p={"rows":[{"status":"PENDING","game_date":"2026-11-27","game_id":"1","player_name":"Sam","player_id":"5","pred_minutes":30,"pred_points":20,"pred_rebounds":6}]}
        i={"rows":[{"game_id":"1","player_name":"Sam","injury_status":"Questionable"}]}
        r=overlay(p,i,True,T)["player_rows"][0]
        self.assertEqual(r["review_state"],"CAUTION_RESEARCH")
        self.assertEqual(r["illustrative_minutes_sensitivity"]["points_if_minutes_25pct_lower"],15)
        self.assertEqual(p["rows"][0]["pred_points"],20)
    def test_strict_time_cutoff(self):
        rows=[]
        for n in range(35):
            rows.append({"game_id":str(100+n),"player_id":str(300+n),
                         "game_date":"2026-11-20","status":"SETTLED","pred_points":10,"actual_points":10})
        rows.append({"game_id":"999","player_id":"700","game_date":"2026-11-21",
                     "status":"SETTLED","pred_points":10,"actual_points":110})
        r=historical_baseline(rows)["markets"]["points"]
        self.assertEqual(r["paired_game_rows"],1)
        self.assertEqual(r["strictly_prior_global_mean_mae"],100)
        self.assertEqual(r["model_mae"],100)
    def test_generates_truthful_status(self):
        with tempfile.TemporaryDirectory() as p:
            r=generate(Path(p),T)
            self.assertEqual(r["overall_state"],"ACTION_REQUIRED")
            self.assertEqual(r["betting_gate"]["readiness"],"NOT_APPROVED")
            self.assertTrue((Path(p)/"data/phase4_control_center.json").exists())
if __name__=="__main__":unittest.main()
