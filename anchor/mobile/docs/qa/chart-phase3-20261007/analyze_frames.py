"""De-duplicate gfxinfo frames by intended vsync. Keep all gaps, including stalls."""
import json
from pathlib import Path

root = Path(__file__).parent
results = {}
for path in root.glob('*-framestats.txt'):
    raw = path.read_bytes()
    text = raw.decode('utf-16') if raw.startswith(b'\xff\xfe') else raw.decode('utf-8-sig')
    columns = None
    frames = {}
    for line in text.splitlines():
        values = line.strip().split(',')
        if values[0] == 'Flags':
            columns = values
        elif columns and values[0].isdigit() and len(values) >= len(columns) - 1:
            row = dict(zip(columns, values))
            if int(row['Flags']) != 0:
                continue
            vsync, end = int(row['IntendedVsync']), int(row['FrameCompleted'])
            if end < vsync or end - vsync > 10**10:
                continue
            frames[vsync] = max(end, frames.get(vsync, 0))
    times = sorted(frames)
    gaps = [(b-a)/1e6 for a,b in zip(times, times[1:])]
    durations = [(end-start)/1e6 for start,end in frames.items()]
    results[path.stem] = dict(frames=len(times), seconds=round((times[-1]-times[0])/1e9,3), fps=round((len(times)-1)*1e9/(times[-1]-times[0]),2), max_frame_ms=round(max(durations),2), max_vsync_gap_ms=round(max(gaps),2), over_32ms=sum(x>32 for x in durations), over_50ms=sum(x>50 for x in gaps)) if len(times)>1 else dict(frames=len(times))
root.joinpath('frame-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
