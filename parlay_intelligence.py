"""Gill Sports Phase 3. Correlation-aware exploratory simulation and forward-only tracking.
No simulated probability, confidence interval, or positive EV is approved for betting.
Standard library only so GitHub Actions runs without a paid API or model download.
"""
import argparse
import hashlib
import json
import math
import random
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

STATS=("points","rebounds","assists","pra")
PRED={"points":"pred_points","rebounds":"pred_rebounds","assists":"pred_assists","pra":"pred_pra"}
ACTUAL={"points":"actual_points","rebounds":"actual_rebounds","assists":"actual_assists","pra":"actual_pra"}
MIN_TRAIN_DATES=15
MIN_HOLDOUT_DATES=5
MIN_TRAIN_SAMPLES=250
MIN_HOLDOUT_SAMPLES=100
SIMS=10000
MAX_QUOTE_AGE_MINUTES=30

def num(value):
    return float(value) if isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) else None

def utc(value):
    if not isinstance(value,str):return None
    try:
        d=datetime.fromisoformat(value.replace("Z","+00:00"))
        return d.astimezone(timezone.utc) if d.tzinfo else None
    except (ValueError,TypeError,OverflowError):return None

def read(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except (OSError,ValueError):return default

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+"\n",encoding="utf8")

def corr(values):
    if len(values)<30:return None
    x,y=zip(*values)
    ax=sum(x)/len(x);ay=sum(y)/len(y)
    xx=sum((z-ax)**2 for z in x);yy=sum((z-ay)**2 for z in y)
    if xx<=0 or yy<=0:return None
    return round(sum((a-ax)*(b-ay) for a,b in values)/math.sqrt(xx*yy),4)

def residual_rows(rows):
    out=[]
    unique=set()
    for row in rows:
        if not isinstance(row,dict) or row.get("status")!="SETTLED":continue
        gid=str(row.get("game_id") or "")
        pid=str(row.get("player_id") or "")
        day=str(row.get("game_date") or "")
        if not gid.isdigit() or not pid.isdigit() or len(day)!=10:continue
        key=(gid,pid,day)
        if key in unique:continue
        unique.add(key)
        residual={}
        for market in STATS:
            pred=num(row.get(PRED[market]))
            actual=num(row.get(ACTUAL[market]))
            if pred is not None and actual is not None:
                residual[market]=actual-pred
        if residual:out.append({"day":day,"game_id":gid,"player_id":pid,"residual":residual})
    return out

def correlations(rows):
    pairs={}
    for a,b in (("points","rebounds"),("points","assists"),("rebounds","assists"),
                ("points","pra"),("rebounds","pra"),("assists","pra")):
        observations=[(r["residual"][a],r["residual"][b]) for r in rows
                      if a in r["residual"] and b in r["residual"]]
        pairs[a+"_vs_"+b]={"paired_player_games":len(observations),"pearson":corr(observations)}
    return pairs

def simulation(legs,history,seed,simulations=SIMS):
    """Historical empirical residual Monte Carlo, one randomly sampled error per independent game.
    Deliberately separates model-projection gaps from calibrated prop probabilities.
    """
    pools=defaultdict(list)
    for row in history:
        for market,error in row["residual"].items():
            pools[market].append(error)
    if not all(len(pools[leg["stat"]])>=30 for leg in legs):
        return {"runs":0,"outcome_rate":None,"note":"Insufficient per-market graded player residuals"}
    rng=random.Random(seed)
    hit=0
    joint_errors=[]
    for _ in range(simulations):
        ok=True
        total=0.0
        for leg in legs:
            err=rng.choice(pools[leg["stat"]])
            value=float(leg["model_projection"])+err
            total+=err
            if (value>float(leg["line"])) != (leg["side"]=="Over"):
                ok=False
            if value==float(leg["line"]):
                ok=False
        if ok:hit+=1
        joint_errors.append(total)
    return {"runs":simulations,"outcome_rate":round(hit/simulations,5),
            "mean_sum_sampled_errors":round(sum(joint_errors)/len(joint_errors),3),
            "note":"Exploratory residual bootstrap. Different-game errors sampled independently, not proven independent. No injury or live-line calibration."}

def key_for(preview):
    ident=str(preview.get("id",""))
    legs=preview.get("legs",[])
    signature=[[str(l.get("game_id")),str(l.get("player_id")),str(l.get("stat")),
                str(l.get("side")),num(l.get("line")),str(l.get("quote_updated_at_utc"))] for l in legs]
    return hashlib.sha256(json.dumps([ident,signature],sort_keys=True).encode()).hexdigest()[:16]

def qualifies_for_forward_tracking(preview,created):
    """Reject stale/pre-tip/offline sources and missing IDs; never backfill old selections."""
    legs=preview.get("legs") or []
    if len(legs) not in (2,3,4) or len(legs)!=preview.get("size"):return False,"invalid_leg_count"
    if len({str(l.get("game_id")) for l in legs})!=len(legs):return False,"shared_game"
    if len({str(l.get("player_id")) for l in legs})!=len(legs):return False,"shared_player"
    if not created:return False,"missing_generation_timestamp"
    for leg in legs:
        cap=utc(leg.get("odds_captured_at_utc"))
        quote=utc(leg.get("quote_updated_at_utc"))
        tip=utc(leg.get("tipoff_utc"))
        if not all([cap,quote,tip]):return False,"missing_timestamp"
        if quote>cap+timedelta(minutes=2):return False,"quote_newer_than_capture"
        if not (0<=(created-cap).total_seconds()<=MAX_QUOTE_AGE_MINUTES*60):
            return False,"capture_expired_at_generation"
        if not (0<=(created-quote).total_seconds()<=MAX_QUOTE_AGE_MINUTES*60):
            return False,"price_expired_at_generation"
        if tip-created<timedelta(minutes=20):return False,"not_pre_tip"
        if leg.get("stat") not in STATS or leg.get("side") not in ("Over","Under"):
            return False,"unsupported_market"
        if num(leg.get("line")) is None or num(leg.get("model_projection")) is None:
            return False,"invalid_line"
    return True,"eligible_for_research_grading"

def archive_new(previews,archive,now):
    rows=archive.setdefault("rows",[])
    if not isinstance(rows,list):raise ValueError("Refuse to overwrite invalid research history")
    seen={str(x.get("audit_id")) for x in rows}
    skipped=Counter()
    for preview in previews.get("previews",[]):
        if not isinstance(preview,dict):continue
        when=utc(preview.get("created_at_utc"))
        good,reason=qualifies_for_forward_tracking(preview,when)
        if good and (now-when).total_seconds()>600:
            good,reason=False,"historical_preview_not_forward_archivable"
        if good and (now-when).total_seconds()<0:
            good,reason=False,"future_preview_generation"
        if good:
            for leg in preview["legs"]:
                if utc(leg.get("tipoff_utc"))-now<timedelta(minutes=20):
                    good,reason=False,"late_archival_after_lock"
                    break
        if not good:
            skipped[reason]+=1
            continue
        # Persist the original exact research snapshot: no hindsight editing.
        audit_id=key_for(preview)
        if audit_id in seen:continue
        seen.add(audit_id)
        rows.append({
            "audit_id":audit_id,
            "preview_id":preview.get("id"),
            "generated_at_utc":preview.get("created_at_utc"),
            "archived_at_utc":now.isoformat(),
            "classification":"RESEARCH_ONLY_NOT_BETTABLE",
            "joint_probability":None,"estimated_ev":None,
            "status":"PENDING",
            "legs":[{"game_id":str(l["game_id"]),"player_id":str(l["player_id"]),
                     "player_name":l.get("player_name"),"game_date":l.get("game_date"),
                     "stat":l["stat"],"side":l["side"],"line":l["line"],
                     "model_projection":l["model_projection"],
                     "quote_updated_at_utc":l["quote_updated_at_utc"],
                     "tipoff_utc":l["tipoff_utc"],
                     "status":"PENDING","actual":None} for l in preview["legs"]]
        })
    return dict(skipped)

def grade_archive(archive,player_rows,now):
    by_key={}
    ambiguous=set()
    for row in player_rows:
        gid=str(row.get("game_id") or "")
        pid=str(row.get("player_id") or "")
        key=(gid,pid)
        if not gid or not pid:continue
        if key in by_key:
            # Duplicate sanitized output is ambiguous, never silently use first.
            if row.get("status")!=by_key[key].get("status") or row.get("game_date")!=by_key[key].get("game_date"):
                ambiguous.add(key)
        else:by_key[key]=row
    counts=Counter()
    for slip in archive["rows"]:
        if slip.get("status") in ("WIN","LOSS","VOID"):continue
        for leg in slip.get("legs",[]):
            if leg.get("status")!="PENDING":continue
            key=(str(leg.get("game_id")),str(leg.get("player_id")))
            if key in ambiguous:
                counts["ambiguous_player_game"]+=1;continue
            result=by_key.get(key)
            if not result:counts["missing_published_player_result"]+=1;continue
            if result.get("game_date")!=leg.get("game_date"):
                counts["game_date_mismatch"]+=1;continue
            status=result.get("status")
            if status=="DNP_OR_UNMATCHED":
                # DNP_OR_UNMATCHED conflates absences and matching failures.
                counts["unverified_dnp_or_unmatched"]+=1;continue
            if status!="SETTLED":
                counts["not_yet_settled"]+=1;continue
            actual=num(result.get(ACTUAL[leg["stat"]]))
            line=num(leg.get("line"))
            if actual is None or line is None:
                counts["actual_or_line_missing"]+=1;continue
            side=leg.get("side")
            grade="VOID" if abs(actual-line)<1e-9 else "WIN" if (actual>line if side=="Over" else actual<line) else "LOSS"
            leg.update(status=grade,actual=actual,settled_at_utc=now.isoformat(),
                       source="published_player_results_final_stats")
        grades=[x.get("status") for x in slip.get("legs",[])]
        if any(x=="LOSS" for x in grades):slip["status"]="LOSS"
        elif any(x=="PENDING" for x in grades):slip["status"]="PENDING"
        elif any(x=="VOID" for x in grades):slip["status"]="VOID"
        elif grades and all(x=="WIN" for x in grades):slip["status"]="WIN"
        else:slip["status"]="PENDING"
        if slip["status"]!="PENDING" and not slip.get("settled_at_utc"):
            slip["settled_at_utc"]=now.isoformat()
    return dict(counts)

def main(base):
    now=datetime.now(timezone.utc)
    players=read(base/"data/player_live.json",{}).get("rows",[])
    market=read(base/"data/nba_market_comparison.json",{})
    previews=read(base/"data/parlay_research_previews.json",{})
    archive_path=base/"data/parlay_research_history.json"
    archive=read(archive_path,{"schema_version":1,"rows":[]})
    if not isinstance(players,list) or not isinstance(market,dict) or not isinstance(previews,dict):
        raise SystemExit("SOURCE_SCHEMA_INVALID")
    residuals=residual_rows(players)
    dates=sorted(set(r["day"] for r in residuals))
    cutoff=dates[-MIN_HOLDOUT_DATES] if len(dates)>=MIN_TRAIN_DATES+MIN_HOLDOUT_DATES else None
    train=[r for r in residuals if cutoff and r["day"]<cutoff]
    holdout=[r for r in residuals if cutoff and r["day"]>=cutoff]
    train_dates=len(set(r["day"] for r in train))
    holdout_dates=len(set(r["day"] for r in holdout))
    ready=bool(train_dates>=MIN_TRAIN_DATES and holdout_dates>=MIN_HOLDOUT_DATES
               and len(train)>=MIN_TRAIN_SAMPLES and len(holdout)>=MIN_HOLDOUT_SAMPLES)
    # NEVER fit an implied win probability from current or future actuals.
    # Even if sample sizes pass, joint betting probability needs independent
    # holdout joint-outcome calibration, verified player availability, and live pricing.
    odds_age=None
    captured=utc(market.get("odds_captured_at_utc"))
    if captured:odds_age=round((now-captured).total_seconds()/60,1)
    correlation=correlations(residuals)
    previews_out=[]
    for p in previews.get("previews",[]):
        if not isinstance(p,dict):continue
        legs=p.get("legs",[])
        generated=utc(p.get("created_at_utc"))
        qualifies,why=qualifies_for_forward_tracking(p,generated)
        clean=[l for l in legs if isinstance(l,dict) and l.get("stat") in STATS
               and num(l.get("line")) is not None and num(l.get("model_projection")) is not None
               and l.get("side") in ("Over","Under")]
        seed=int(key_for(p),16)
        # Historical model error data must predate the preview, preventing future-game leakage.
        past_residuals=[r for r in residuals if generated and r["day"]<generated.date().isoformat()]
        simulated=simulation(clean,past_residuals,seed) if len(clean)==len(legs) and clean else {"runs":0,"outcome_rate":None}
        # Simulation is run for research only; never publish the raw estimated rate
        # when holdout data are insufficient or when calibration was not verified.
        previews_out.append({
            "preview_id":p.get("id"),"size":p.get("size"),"classification":"RESEARCH_ONLY_NOT_BETTABLE",
            "forward_tracking_eligible":qualifies,"tracking_blocker":None if qualifies else why,
            "monte_carlo":{"runs":simulated.get("runs",0),
                "published_joint_win_probability":None,
                "published_ev":None,
                "method":"empirical historical residual bootstrap",
                "model_limitations":simulated.get("note","No estimate available"),
                "internal_study_completed":bool(simulated.get("runs"))},
            "correlation_note":"Pooled same-player residual stat correlations estimated; distinct games use independent bootstrap draws. Same-game joints are not modeled.",
            "validation":"NOT_CALIBRATED" if not ready else "HOLDOUT_JOINT_VALIDATION_STILL_REQUIRED"
        })
    skipped=archive_new(previews,archive,now)
    grading=grade_archive(archive,players,now)
    counts=Counter(x.get("status") for x in archive["rows"])
    archive["generated_at_utc"]=now.isoformat()
    archive["summary"]={"total_forward_eligible":len(archive["rows"]),
                         "wins":counts["WIN"],"losses":counts["LOSS"],
                         "voids":counts["VOID"],"pending":counts["PENDING"],
                         "excluded_current_previews":skipped,"grading_blockers":grading}
    archive["policy"]="Append only forward-valid live research snapshots. Stale quotes are excluded. Unverified DNP never graded void. No paid slips/ROI claims. Research outcomes are separate from betting picks."
    report={
        "schema_version":1,"generated_at_utc":now.isoformat(),
        "status":"EXPERIMENTAL_NO_VERIFIED_JOINT_PROBABILITIES",
        "readiness":{"independent_settled_dates":len(dates),
            "graded_player_games":len(residuals),"training_dates":train_dates,
            "holdout_dates":holdout_dates,"training_samples":len(train),
            "holdout_samples":len(holdout),"sample_size_gate_passed":ready,
            "minimum_training_dates":MIN_TRAIN_DATES,"minimum_holdout_dates":MIN_HOLDOUT_DATES,
            "minimum_training_samples":MIN_TRAIN_SAMPLES,"minimum_holdout_samples":MIN_HOLDOUT_SAMPLES,
            "verified_joint_calibration":False,"verified_player_availability":False,
            "fresh_odds_snapshot":bool(odds_age is not None and 0<=odds_age<=MAX_QUOTE_AGE_MINUTES)},
        "odds_quote_age_minutes":odds_age,"residual_correlations":correlation,
        "simulation_count_per_preview":SIMS,"preview_simulations":previews_out,
        "research_tracking_summary":archive["summary"],
        "notice":"Monte Carlo uses historical residuals, not a validated joint-probability or betting edge model. Joint probabilities, EV and confidence intervals are intentionally suppressed pending forward holdout calibration, confirmed availability and fresh odds."
    }
    write(base/"data/parlay_intelligence.json",report)
    write(archive_path,archive)
    print("PHASE3_GENERATED",len(previews_out),"SIMS_PER_PREVIEW",SIMS)
    print("INDEPENDENT_SETTLED_DATES",len(dates),"HOLDOUT_READY",ready)
    print("ARCHIVED_FORWARD_RESEARCH",len(archive["rows"]),"REASONS",skipped)
    print("MODEL_SAFE_NO_JOINT_BETTING_PROBABILITIES")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,default=Path(__file__).resolve().parent)
    args=parser.parse_args()
    main(args.root)
