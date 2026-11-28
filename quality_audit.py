"""Gill Sports: auditable report from persisted player forecasts, no inferred betting EV."""
import json
import math
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/"data/player_live.json"
MARKET=ROOT/"data/nba_market_comparison.json"
OUTPUT=ROOT/"data/model_quality_report.json"
STATS={"points":("pred_points","actual_points"),"rebounds":("pred_rebounds","actual_rebounds"),
       "assists":("pred_assists","actual_assists"),"pra":("pred_pra","actual_pra"),"minutes":("pred_minutes","actual_minutes")}

def number(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def summary(rows,pred,actual):
    errors=[float(r[pred])-float(r[actual]) for r in rows if number(r.get(pred)) and number(r.get(actual))]
    if not errors:return {"count":0,"mae":None,"bias":None,"rmse":None}
    n=len(errors)
    return {"count":n,"mae":round(sum(abs(x) for x in errors)/n,3),
            "bias":round(sum(errors)/n,3),
            "rmse":round(math.sqrt(sum(x*x for x in errors)/n),3)}

def main():
    data=json.loads(SOURCE.read_text(encoding="utf8"))
    market=json.loads(MARKET.read_text(encoding="utf8"))
    rows=[r for r in data.get("rows",[]) if isinstance(r,dict)]
    settled=[r for r in rows if r.get("status")=="SETTLED"]
    dates=sorted({str(r.get("game_date")) for r in settled if r.get("game_date")})
    windows={"all":settled,
             "last_7_game_dates":[r for r in settled if r.get("game_date") in dates[-7:]],
             "previous_7_game_dates":[r for r in settled if r.get("game_date") in dates[-14:-7]],
             "last_30_game_dates":[r for r in settled if r.get("game_date") in dates[-30:]]}
    metrics={window:{k:summary(v,*columns) for k,columns in STATS.items()} for window,v in windows.items()}
    per_player=defaultdict(list)
    for r in settled:
        if r.get("player_id") and r.get("player_name"):
            per_player[(str(r["player_id"]),r["player_name"])].append(r)
    player_stats=[]
    for (pid,name),pr in per_player.items():
        if len(pr)<3:continue
        ordered=sorted(pr,key=lambda r:str(r.get("game_date","")))
        stats={k:summary(ordered[-10:],*v) for k,v in STATS.items()}
        player_stats.append({"player_id":pid,"player_name":name,"settled_games":len(pr),
                             "last_10_games":stats})
    player_stats.sort(key=lambda x:(-x["settled_games"],x["player_name"]))
    reasons=[]
    n=len(settled)
    if n<100:reasons.append("INSUFFICIENT_PLAYER_GRADES")
    for k in ("points","rebounds","assists","pra"):
        recent=metrics["last_7_game_dates"][k]
        prior=metrics["previous_7_game_dates"][k]
        if recent["count"]>=30 and prior["count"]>=30 and prior["mae"] and recent["mae"]>prior["mae"]*1.15:
            reasons.append("RECENT_MAE_DEGRADATION_"+k.upper())
    counts=Counter(str(r.get("status","UNKNOWN")) for r in rows)
    problems=[]
    identifiers=Counter((str(r.get("game_id")),str(r.get("player_id")),str(r.get("game_date"))) for r in rows)
    for count in identifiers.values():
        if count>1:problems.append("DUPLICATE_PLAYER_GAME_FORECAST")
    for r in rows:
        if not r.get("game_id") or not r.get("player_id") or not r.get("game_date"):
            problems.append("MISSING_FORECAST_ID")
        if r.get("status")=="SETTLED" and not any(number(r.get(x[1])) for x in STATS.values()):
            problems.append("SETTLED_WITHOUT_ACTUAL")
        if all(number(r.get(key)) for key in ("pred_points","pred_rebounds","pred_assists","pred_pra")):
            if abs(r["pred_pra"]-(r["pred_points"]+r["pred_rebounds"]+r["pred_assists"]))>0.2:
                problems.append("PRA_SUM_INCONSISTENCY")
    warnings=dict(Counter(problems))
    quote_time=market.get("odds_captured_at_utc")
    try:
        stamp=datetime.fromisoformat(str(quote_time).replace("Z","+00:00"))
        age=(datetime.now(timezone.utc)-stamp).total_seconds()/60
    except (ValueError,TypeError):age=None
    if age is None or age>30:reasons.append("SPORTSBOOK_SNAPSHOT_NOT_LIVE")
    if not any(r.get("availability_verified") is True for r in market.get("rows",[]) if isinstance(r,dict)):
        reasons.append("NO_INDEPENDENT_PLAYER_AVAILABILITY")
    report={
        "schema_version":1,"generated_at_utc":datetime.now(timezone.utc).isoformat(),
        "player_source_updated_at_utc":data.get("updated_at_utc"),
        "market_quote_captured_at_utc":quote_time,
        "market_quote_age_minutes":round(age,1) if age is not None else None,
        "counts":{"forecast_rows":len(rows),"settled":n,"pending":counts["PENDING"],
                  "dnp_or_unmatched":counts["DNP_OR_UNMATCHED"],
                  "data_error":counts["DATA_ERROR"],"independent_settled_dates":len(dates)},
        "metrics":metrics,"player_sample_size_minimum":3,"players":player_stats,
        "integrity_warnings":warnings,"quality_flags":reasons,
        "notice":"Descriptive forecast MAE, bias and RMSE, not wagering win probability, expected value or validated betting edge."
    }
    OUTPUT.write_text(json.dumps(report,indent=2,allow_nan=False,ensure_ascii=False)+"\n",encoding="utf8")
    print("Forecast rows",len(rows),"settled",n,"quality flags",reasons)
    for key in ("points","rebounds","assists","pra"):
        print(key,metrics["all"][key], "recent",metrics["last_7_game_dates"][key])
if __name__=="__main__":main()
