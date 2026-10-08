from __future__ import annotations
import csv, json, statistics, sys
from pathlib import Path

FIELDS = ("IntendedVsync", "AnimationStart", "PerformTraversalsStart", "DrawStart", "FrameCompleted")

def read_frames(path: Path, start_ms: float, end_ms: float):
    header = None
    latest = {}
    with path.open(newline="", errors="replace") as stream:
        for row in csv.reader(stream):
            if row and row[0] == "Flags":
                header = row
                continue
            if not header or not row or len(row) < len(header):
                continue
            try:
                s = dict(zip(header, row))
                if int(s["Flags"]) != 0:
                    continue
                vals = {key: int(s[key]) for key in FIELDS}
            except (KeyError, ValueError):
                continue
            t = vals["IntendedVsync"]
            if t < start_ms * 1_000_000 or t > end_ms * 1_000_000:
                continue
            if vals["FrameCompleted"] < t:
                continue
            old = latest.get(t)
            if old is None or vals["FrameCompleted"] > old["FrameCompleted"]:
                latest[t] = vals
    return [latest[t] for t in sorted(latest)]

def stats(values):
    if not values:
        return {"n": 0}
    xs = sorted(values)
    p95 = xs[min(len(xs)-1, round(.95*(len(xs)-1)))]
    return {"n": len(xs), "meanMs": round(statistics.mean(xs), 3), "medianMs": round(statistics.median(xs), 3), "p95Ms": round(p95, 3), "maxMs": round(max(xs), 3)}

def summarize(name, path, start, end):
    frames = read_frames(Path(path), start, end)
    if not frames:
        raise SystemExit(f"No frames in {name} window")
    rows=[]
    for f in frames:
        row={"run":name,"intendedVsyncMs":f["IntendedVsync"]/1e6}
        row["vsyncToAnimationMs"]=(f["AnimationStart"]-f["IntendedVsync"])/1e6 if f["AnimationStart"] else None
        row["animationToTraversalsMs"]=(f["PerformTraversalsStart"]-f["AnimationStart"])/1e6 if f["PerformTraversalsStart"] and f["AnimationStart"] else None
        row["traversalsToDrawMs"]=(f["DrawStart"]-f["PerformTraversalsStart"])/1e6 if f["DrawStart"] and f["PerformTraversalsStart"] else None
        row["drawToCompleteMs"]=(f["FrameCompleted"]-f["DrawStart"])/1e6 if f["DrawStart"] and f["FrameCompleted"] else None
        row["totalFrameMs"]=(f["FrameCompleted"]-f["IntendedVsync"])/1e6
        rows.append(row)
    def vals(key): return [r[key] for r in rows if r[key] is not None and r[key]>=0]
    period=(frames[-1]["IntendedVsync"]-frames[0]["IntendedVsync"])/1e9
    result={"run":name,"source":str(path),"windowUptimeMs":[start,end],"uniqueFrames":len(frames),"coverageSeconds":round(period,3),"fps":round((len(frames)-1)/period,2) if period else None,
      "vsyncToAnimation":stats(vals("vsyncToAnimationMs")),"animationToTraversals":stats(vals("animationToTraversalsMs")),"traversalsToDraw":stats(vals("traversalsToDrawMs")),"drawToComplete":stats(vals("drawToCompleteMs")),"totalFrame":stats(vals("totalFrameMs")),"over16_7ms":sum(r["totalFrameMs"]>16.7 for r in rows),"over32ms":sum(r["totalFrameMs"]>32 for r in rows)}
    return result,rows

qa=Path(sys.argv[1])
runs=[("prechange-static",qa/"baseline-static-idle-polls.txt",21355330,21362530),("staticbase-opening",qa/"staticbase-perf-polls.txt",27399303,27406503)]
results=[]; all_rows=[]
for name,path,start,end in runs:
    summary,rows=summarize(name,path,start,end); results.append(summary); all_rows.extend(rows)
with (qa/"staticbase-frame-stage-profile.csv").open("w",newline="") as f:
    writer=csv.DictWriter(f,fieldnames=list(all_rows[0].keys())); writer.writeheader(); writer.writerows(all_rows)
(qa/"staticbase-stage-duration-profile.json").write_text(json.dumps({"method":"Flags==0; exact recorded IntendedVsync window; latest FrameCompleted per IntendedVsync; durations in ms","runs":results},indent=2)+"\n")
print(json.dumps(results,indent=2))
