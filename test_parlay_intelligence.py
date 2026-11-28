"""Unit tests for forward-only Phase 3 parlay tracking and research simulation."""
import tempfile
import unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
from parlay_intelligence import (
    archive_new,grade_archive,qualifies_for_forward_tracking,correlations,
    residual_rows,simulation,main,utc)

NOW=datetime(2026,11,27,22,0,tzinfo=timezone.utc)

def preview(generated=NOW,stale=False):
    legs=[]
    for idx in range(2):
        cap=generated-timedelta(minutes=45 if stale else 3)
        legs.append({
            "game_id":str(401900000+idx),"player_id":str(1620000+idx),
            "player_name":f"Player {idx}","game_date":generated.date().isoformat(),
            "tipoff_utc":(generated+timedelta(hours=2)).isoformat(),
            "odds_captured_at_utc":cap.isoformat(),
            "quote_updated_at_utc":cap.isoformat(),
            "stat":"points" if idx==0 else "assists",
            "side":"Over","line":14.5 if idx==0 else 4.5,
            "model_projection":20.3 if idx==0 else 6.1
        })
    return {"id":"test-2-research","size":2,"created_at_utc":generated.isoformat(),"legs":legs}

class Phase3Tests(unittest.TestCase):
    def test_forward_eligible_only(self):
        good,reason=qualifies_for_forward_tracking(preview(),NOW)
        self.assertTrue(good,reason)
        archive={"rows":[]}
        self.assertEqual(archive_new({"previews":[preview()]},archive,NOW),{})
        self.assertEqual(len(archive["rows"]),1)
        self.assertEqual(archive_new({"previews":[preview()]},archive,NOW),{})
        self.assertEqual(len(archive["rows"]),1)
        self.assertEqual(archive["rows"][0]["joint_probability"],None)
        self.assertEqual(archive["rows"][0]["estimated_ev"],None)

    def test_stale_and_backfilled_are_rejected(self):
        a={"rows":[]}
        bad=preview(stale=True)
        skipped=archive_new({"previews":[bad]},a,NOW)
        self.assertEqual(skipped.get("capture_expired_at_generation"),1)
        old=preview(NOW-timedelta(hours=3))
        skipped=archive_new({"previews":[old]},a,NOW)
        self.assertEqual(skipped.get("historical_preview_not_forward_archivable"),1)
        self.assertEqual(a["rows"],[])

    def test_grading_uses_exact_ids_and_final_stats(self):
        a={"rows":[]}
        archive_new({"previews":[preview()]},a,NOW)
        legs=preview()["legs"]
        results=[
            {"game_id":legs[0]["game_id"],"player_id":legs[0]["player_id"],
             "game_date":legs[0]["game_date"],"status":"SETTLED","actual_points":21.0},
            {"game_id":legs[1]["game_id"],"player_id":legs[1]["player_id"],
             "game_date":legs[1]["game_date"],"status":"SETTLED","actual_assists":7.0}
        ]
        grade_archive(a,results,NOW+timedelta(hours=4))
        self.assertEqual(a["rows"][0]["status"],"WIN")
        self.assertEqual([x["status"] for x in a["rows"][0]["legs"]],["WIN","WIN"])
        # Already graded entries are immutable across later refresh.
        grade_archive(a,[],NOW+timedelta(hours=5))
        self.assertEqual(a["rows"][0]["status"],"WIN")

    def test_ambiguous_dnp_never_void(self):
        a={"rows":[]}
        archive_new({"previews":[preview()]},a,NOW)
        l=a["rows"][0]["legs"][0]
        grade_archive(a,[{"game_id":l["game_id"],"player_id":l["player_id"],
                         "game_date":l["game_date"],"status":"DNP_OR_UNMATCHED"}],NOW)
        self.assertEqual(a["rows"][0]["status"],"PENDING")

    def test_correlations_and_monte_carlo_are_exploratory(self):
        rows=[]
        for i in range(100):
            rows.append({"game_id":str(401000000+i),"player_id":str(1600000+i),
                         "game_date":"2026-11-20","status":"SETTLED",
                         "pred_points":15,"actual_points":15+i%9-4,
                         "pred_assists":5,"actual_assists":5+i%5-2,
                         "pred_rebounds":6,"actual_rebounds":6+i%3-1,
                         "pred_pra":26,"actual_pra":26+i%9-4+i%5-2+i%3-1})
        residuals=residual_rows(rows)
        self.assertEqual(len(residuals),100)
        self.assertIsNotNone(correlations(residuals)["points_vs_assists"]["pearson"])
        sim=simulation(preview()["legs"],residuals,seed=122,simulations=1000)
        self.assertEqual(sim["runs"],1000)
        self.assertGreaterEqual(sim["outcome_rate"],0)
        self.assertLessEqual(sim["outcome_rate"],1)

if __name__=="__main__":unittest.main()
