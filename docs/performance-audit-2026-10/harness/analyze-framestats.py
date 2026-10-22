"""Summarize retained Android gfxinfo frames; never equate its ring with a full run."""
import argparse
import csv
import io
import json
import math
import re
from pathlib import Path


def percentile(values, percent):
    position = (len(values) - 1) * percent / 100
    lower = math.floor(position)
    upper = math.ceil(position)
    return round(values[lower] + (values[upper] - values[lower]) * (position - lower), 3)


def summarize(text):
    durations = []
    flagged = invalid = sections = 0
    deadlines_missed = comparable_deadlines = 0
    for block in text.split("---PROFILEDATA---")[1::2]:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines or not lines[0].startswith("Flags,"):
            continue
        sections += 1
        for row in csv.DictReader(io.StringIO("\n".join(lines))):
            try:
                if int(row["Flags"]) != 0:
                    flagged += 1
                    continue
                intended = int(row["IntendedVsync"])
                completed = int(row["FrameCompleted"])
                # Long.MAX_VALUE and incomplete frames are sentinel values.
                if intended <= 0 or completed >= 2**63 - 1 or completed < intended:
                    invalid += 1
                    continue
                deadline = int(row.get("FrameDeadline", "0") or "0")
                durations.append((completed - intended) / 1_000_000)
                if intended < deadline < 2**63 - 1:
                    comparable_deadlines += 1
                    deadlines_missed += completed > deadline
            except (KeyError, ValueError, TypeError):
                invalid += 1
    durations.sort()
    result = {
        "evidence": "retained gfxinfo ring only; not all scenario frames, FPS, JS stalls, or causality",
        "window_sections": sections,
        "retained_valid_frames": len(durations),
        "excluded_flagged_frames": flagged,
        "excluded_invalid_frames": invalid,
        "retained_deadline_comparable_frames": comparable_deadlines,
        "retained_completed_after_deadline": deadlines_missed,
        "retained_frame_ms": None if not durations else {
            "p50": percentile(durations, 50),
            "p95": percentile(durations, 95),
            "p99": percentile(durations, 99),
            "max": round(durations[-1], 3),
        },
    }
    # Preserve platform aggregate counters separately from ring percentiles.
    for name, pattern in {
        "platform_total_frames": r"Total frames rendered:\s*(\d+)",
        "platform_janky_frames": r"Janky frames:\s*(\d+)\s*\(([\d.]+)%\)",
        "platform_missed_vsync": r"Number Missed Vsync:\s*(\d+)",
        "platform_slow_bitmap_uploads": r"Number Slow bitmap uploads:\s*(\d+)",
    }.items():
        match = re.search(pattern, text)
        if match:
            result[name] = int(match.group(1))
            if name == "platform_janky_frames":
                result["platform_janky_percent"] = float(match.group(2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gfxinfo", type=Path)
    args = parser.parse_args()
    # Only numeric evidence is emitted; source paths/process/window names stay local.
    print(json.dumps(summarize(args.gfxinfo.read_text(encoding="utf-8-sig")), indent=2))
