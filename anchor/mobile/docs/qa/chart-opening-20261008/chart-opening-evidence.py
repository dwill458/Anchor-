"""Compare Chart intro screenshots or summarize Android gfxinfo framestats."""
from __future__ import annotations

import argparse
import csv
import json
import statistics
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageDraw


def compare(before_path: Path, after_path: Path, out_dir: Path) -> dict[str, object]:
    before = Image.open(before_path).convert("RGB")
    after = Image.open(after_path).convert("RGB")
    if before.size != after.size:
        raise ValueError(f"Screenshot dimensions differ: {before.size} vs {after.size}")
    width, height = before.size
    delta = ImageChops.difference(before, after)
    pixels = delta.load()
    total = width * height
    # The approved paper zone runs from 55% through 78% of screen height.
    paper_y0, paper_y1 = round(height * 0.55), round(height * 0.78)
    # Status/nav glyphs vary between captures; exclude only those system strips.
    status_y1 = round(height * 0.045)
    nav_y0 = round(height * 0.976)
    included = changed = severe = channel_sum = 0
    heat = Image.new("RGB", (width, height), "black")
    heat_pixels = heat.load()
    for y in range(height):
        for x in range(width):
            if paper_y0 <= y < paper_y1 or y < status_y1 or y >= nav_y0:
                continue
            r, g, b = pixels[x, y]
            peak = max(r, g, b)
            included += 1
            channel_sum += r + g + b
            if peak > 12:
                changed += 1
            if peak > 32:
                severe += 1
            heat_pixels[x, y] = (min(255, r * 4), min(255, g * 4), min(255, b * 4))
    out_dir.mkdir(parents=True, exist_ok=True)
    heat_path = out_dir / "final-outside-paper-diff.png"
    heat.save(heat_path)
    overlay = Image.blend(before, after, 0.5)
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, paper_y0, width - 1, paper_y1 - 1), outline=(255, 0, 255), width=2)
    overlay_path = out_dir / "final-before-after-overlay.png"
    overlay.save(overlay_path)
    result = {
        "before": str(before_path),
        "after": str(after_path),
        "dimensions": [width, height],
        "maskedPaperZoneY": [paper_y0, paper_y1],
        "maskedSystemBandsY": [[0, status_y1], [nav_y0, height]],
        "includedPixels": included,
        "pixelsOver12Of255": changed,
        "pixelsOver12Pct": round(100 * changed / included, 4),
        "pixelsOver32Of255": severe,
        "meanAbsoluteChannelDifference": round(channel_sum / (included * 3), 4),
        "diffImage": str(heat_path),
        "overlayImage": str(overlay_path),
    }
    (out_dir / "final-image-diff.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def frames(path: Path, start_ms: float | None = None, end_ms: float | None = None) -> dict[str, object]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    header: list[str] | None = None
    dedup: dict[int, int] = {}
    for row in csv.reader(text.splitlines()):
        if not row:
            continue
        if row[0] == "Flags":
            header = row
            continue
        if header is None or len(row) < len(header):
            continue
        try:
            sample = dict(zip(header, row))
            if int(sample["Flags"]) != 0:
                continue
            intended = int(sample["IntendedVsync"])
            completed = int(sample["FrameCompleted"])
        except (KeyError, ValueError):
            continue
        if completed < intended or completed - intended > 10**10:
            continue
        dedup[intended] = max(completed, dedup.get(intended, 0))
    ordered = sorted(
        (intended, completed)
        for intended, completed in dedup.items()
        if (start_ms is None or intended >= start_ms * 1_000_000)
        and (end_ms is None or intended <= end_ms * 1_000_000)
    )
    durations = [(complete - intended) / 1_000_000 for intended, complete in ordered]
    gaps = [(b[0] - a[0]) / 1_000_000 for a, b in zip(ordered, ordered[1:])]
    n = len(ordered)
    result = {
        "source": str(path),
        "windowUptimeMs": [start_ms, end_ms] if start_ms is not None or end_ms is not None else None,
        "uniqueIntendedVsyncFrames": n,
        "durationSeconds": round((ordered[-1][0] - ordered[0][0]) / 1e9, 3) if n > 1 else 0,
        "fps": round((n - 1) * 1e9 / (ordered[-1][0] - ordered[0][0]), 2) if n > 1 else None,
        "framesOver16_7ms": sum(x > 16.7 for x in durations),
        "framesOver16_7Pct": round(100 * sum(x > 16.7 for x in durations) / n, 3) if n else None,
        "framesOver32ms": sum(x > 32 for x in durations),
        "maxFrameMs": round(max(durations), 3) if durations else None,
        "maxIntendedVsyncGapMs": round(max(gaps), 3) if gaps else None,
        "medianFrameMs": round(statistics.median(durations), 3) if durations else None,
        "thresholdsPass": bool(n and sum(x > 16.7 for x in durations) / n <= 0.03 and not any(x > 32 for x in durations)),
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    diff_parser = sub.add_parser("diff")
    diff_parser.add_argument("before", type=Path)
    diff_parser.add_argument("after", type=Path)
    diff_parser.add_argument("out_dir", type=Path)
    frame_parser = sub.add_parser("frames")
    frame_parser.add_argument("framestats", type=Path)
    window_parser = sub.add_parser("frames-window")
    window_parser.add_argument("framestats", type=Path)
    window_parser.add_argument("start_uptime_ms", type=float)
    window_parser.add_argument("end_uptime_ms", type=float)
    args = parser.parse_args()
    if args.command == "diff":
        result = compare(args.before, args.after, args.out_dir)
    elif args.command == "frames-window":
        result = frames(args.framestats, args.start_uptime_ms, args.end_uptime_ms)
    else:
        result = frames(args.framestats)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
