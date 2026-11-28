"""Gill Sports Phase 4: honest feed health, injury research overlays and leakage-free baselines.
Public data only, no network calls. Never edits original projections or invents bet edges.
"""
import json, math, re, statistics, unicodedata
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
MARKETS={"points":("pred_points","actual_points"),"rebounds":("pred_rebounds","actual_rebounds"),"assists":("pred_assists","actual_assists"),"pra":("pred_pra","actual_pra")}
LIMITS_MIN={"games":120,"player_projections":180,"odds":30,"injuries":240,"model_accuracy":1440,"parlay_intelligence":240}
FILENAME={"games":"data/live.json","player_projections":"data/player_live.json","odds":"data/nba_market_comparison.json","injuries":"data/injury_watch.json","model_accuracy":"data/model_quality_report.json","parlay_intelligence":"data/parlay_intelligence.json"}
TIMESTAMP={"games":"last_refresh","player_projections":"updated_at_utc","odds":"odds_captured_at_utc","injuries":"updated_at_utc","model_accuracy":"generated_at_utc","parlay_intelligence":"generated_at_utc"}

def read(path):
    try:
        data=json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data,dict) else None
    except (OSError,ValueError,UnicodeDecodeError):return None

def date(s):
    if not isinstance(s,str):return None
    try:
        d=datetime.fromisoformat(s.replace("Z","+00:00"))
        return d.astimezone(timezone.utc) if d.tzinfo else None
    except (ValueError,TypeError,OverflowError):return None

def number(x):
    return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)

def norm(x):
    value=unicodedata.normalize("NFKD",str(x or ""))
    return re.sub(r"[^a-z0-9]","", "".join(c for c in value if not unicodedata.combining(c)).lower())

def feed_status(root,now):
    feeds={}
    for key,path in FILENAME.items():
        doc=read(root/path)
        at=date(doc.get(TIMESTAMP[key])) if doc else None
        minutes=round((now-at).total_seconds()/60,1) if at else None
        if doc is None:state="MISSING_OR_INVALID"
        elif minutes is None:state="MISSING_TIMESTAMP"
        elif minutes< -5:state="FUTURE_TIMESTAMP"
        elif minutes>LIMITS_MIN[key]:state="STALE"
        else:state="FRESH"
        feeds[key]={"state":state,"source_path":path,"observed_at_utc":at.isoformat() if at else None,
                    "age_minutes":minutes,"max_age_minutes":LIMITS_MIN[key]}
    return feeds

def overlay(players,injury,injury_fresh,now):
    entries=defaultdict(list)
    for r in (injury or {}).get("rows",[]):
        if not isinstance(r,dict):continue
        if not r.get("game_id") or not r.get("player_name"):continue
        entries[(str(r["game_id"]),norm(r["player_name"]))].append(r)
    result=[]
    statuses=Counter()
    for p in (players or {}).get("rows",[]):
        if not isinstance(p,dict):continue
        if p.get("status")!="PENDING":continue
        # Only upcoming / current day candidates. Never relabel historic settled rows.
        day=str(p.get("game_date") or "")
        if day<now.date().isoformat():continue
        hits=entries.get((str(p.get("game_id")),norm(p.get("player_name"))),[])
        matched=hits[0] if len(hits)==1 and injury_fresh else None
        raw=str(matched.get("injury_status") or "") if matched else ""
        status=raw.lower().strip()
        if not matched:level="UNVERIFIED"
        elif status in ("out","doubtful","injured reserve","suspended"):
            level="BLOCK_RESEARCH"
        elif status in ("questionable","day-to-day","game-time decision"):
            level="CAUTION_RESEARCH"
        else:
            level="UNVERIFIED"
        # Projection values remain immutable. Scenario illustrates sensitivity to
        # a hypothetical minutes reduction, not an injury-adjusted fitted forecast.
        mins=p.get("pred_minutes")
        scenarios={}
        if level=="CAUTION_RESEARCH" and number(mins) and mins>0:
            for stat,pred_field in [("points","pred_points"),("rebounds","pred_rebounds"),("assists","pred_assists")]:
                if number(p.get(pred_field)):
                    scenarios[stat+"_if_minutes_25pct_lower"]=round(float(p[pred_field])*0.75,2)
        result.append({"game_id":str(p.get("game_id")),"game_date":day,"player_id":str(p.get("player_id")),
                       "player_name":p.get("player_name"),"injury_status":raw or "NOT_VERIFIED",
                       "review_state":level,"availability_verified":False,
                       "original_projection_unchanged":True,
                       "illustrative_minutes_sensitivity":scenarios,
                       "note":"Unverified ESPN name/game match; no official confirmed lineup. Research gate only."})
        statuses[level]+=1
    return {"player_rows":result,"counts":dict(statuses),
            "source_fresh":bool(injury_fresh),
            "availability_verified":False,
            "policy":"Never change original pregame model values. Block risky research; do not assume not-listed players are healthy. Minutes sensitivity is a hypothetical proportional illustration, not a model prediction."}

def historical_baseline(rows):
    """Compare locked original predictions with strictly earlier date global or player history.
    Never include current-date or future final stats when predicting a date.
    """
    by_date=defaultdict(list)
    for r in rows:
        if not isinstance(r,dict) or r.get("status")!="SETTLED":continue
        key=(str(r.get("game_id")),str(r.get("player_id")))
        if not all(key) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(r.get("game_date",""))):continue
        by_date[str(r["game_date"])].append(r)
    prior={k:[] for k in MARKETS}
    prior_player=defaultdict(list)
    all_results={k:{"model":[],"baseline":[],"player_baseline":[],"compared_player_games":0} for k in MARKETS}
    dated_metrics=[]
    for d in sorted(by_date):
        values_by_day={k:[] for k in MARKETS}
        for row in by_date[d]:
            pid=str(row.get("player_id"))
            for market,(predkey,actualkey) in MARKETS.items():
                pred=row.get(predkey);actual=row.get(actualkey)
                if not (number(pred) and number(actual)):continue
                values_by_day[market].append(float(actual))
                # Benchmarks unavailable if too little strictly prior history;
                # never score a model as a winner solely because baseline missing.
                if len(prior[market])>=30:
                    baseline=statistics.mean(prior[market])
                    bucket=all_results[market]
                    bucket["model"].append(abs(float(pred)-float(actual)))
                    bucket["baseline"].append(abs(baseline-float(actual)))
                    if len(prior_player[(pid,market)])>=5:
                        bucket["player_baseline"].append({"model_abs_error":abs(float(pred)-float(actual)),
                                                          "baseline_abs_error":abs(statistics.mean(prior_player[(pid,market)][-10:])-float(actual))})
        # Update history ONLY AFTER all same-date observations have been scored.
        for row in by_date[d]:
            pid=str(row.get("player_id"))
            for market,(_,actualkey) in MARKETS.items():
                if number(row.get(actualkey)):
                    prior_player[(pid,market)].append(float(row[actualkey]))
        for market, vals in values_by_day.items():prior[market].extend(vals)
        dated_metrics.append({"date":d,"settled_player_rows":len(by_date[d])})
    comparison={}
    for market,v in all_results.items():
        n=len(v["model"])
        player=v["player_baseline"]
        comparison[market]={
            "paired_game_rows":n,
            "model_mae":round(statistics.mean(v["model"]),3) if n else None,
            "strictly_prior_global_mean_mae":round(statistics.mean(v["baseline"]),3) if n else None,
            "model_better_than_global_baseline":bool(n>=100 and statistics.mean(v["model"])<statistics.mean(v["baseline"])),
            "player_mean_paired_rows":len(player),
            "model_mae_on_player_baseline_subset":round(statistics.mean(x["model_abs_error"] for x in player),3) if player else None,
            "prior_player_mean_mae":round(statistics.mean(x["baseline_abs_error"] for x in player),3) if player else None,
            "validated_for_betting":False
        }
    return {"date_coverage":len(by_date),"by_date":dated_metrics,"markets":comparison,
            "notice":"No same-date or future-label leakage. Earlier-date global/player means are diagnostic baselines, not independent betting-market evidence."}

def generate(root=ROOT,now=None):
    now=now or datetime.now(timezone.utc)
    feeds=feed_status(root,now)
    p=read(root/FILENAME["player_projections"])
    i=read(root/FILENAME["injuries"])
    injury_fresh=feeds["injuries"]["state"]=="FRESH"
    over=overlay(p,i,injury_fresh,now)
    baseline=historical_baseline((p or {}).get("rows",[]))
    critical=[key for key in ("games","player_projections") if feeds[key]["state"] not in ("FRESH",)]
    caution=[key for key in ("odds","injuries","model_accuracy","parlay_intelligence") if feeds[key]["state"]!="FRESH"]
    approved=read(root/"data/validated_player_edges.json") or {}
    generation=read(root/"data/parlay_generation_status.json") or {}
    report={
      "schema_version":1,"generated_at_utc":now.isoformat(),
      "overall_state":"ACTION_REQUIRED" if critical else "DEGRADED" if caution else "HEALTHY",
      "feed_checks":feeds,
      "alerts":{"critical":[{"key":x,"reason":feeds[x]["state"]} for x in critical],
                "warning":[{"key":x,"reason":feeds[x]["state"]} for x in caution],
                "notifiable":bool(critical or caution)},
      "injury_research_overlay":over,
      "historical_backtest":baseline,
      "betting_gate":{"validated_positive_edges":int(approved.get("validated_positive_edges") or 0),
                      "fresh_odds":feeds["odds"]["state"]=="FRESH",
                      "verified_availability":False,
                      "parlay_generator_state":generation.get("state") or "UNKNOWN",
                      "readiness":"NOT_APPROVED" if not (feeds["odds"]["state"]=="FRESH" and over["availability_verified"]) else "REQUIRES_MODEL_CALIBRATION"},
      "alerts_policy":"GitHub issue notification on state changes when enabled by workflow. Do not disclose secrets, publish picks, or claim iOS push notifications.",
      "notice":"Monitoring plus conservative injury research gate, not a modification to trained models or verified real-time player availability."
    }
    out=root/"data/phase4_control_center.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+"\n",encoding="utf8")
    print("PHASE4_CONTROL_CENTER",report["overall_state"],"CRITICAL",critical,"WARN",caution,
          "BASELINE_DATES",baseline["date_coverage"],"PENDING_OVERLAY",len(over["player_rows"]))
    return report

if __name__=="__main__":generate()
