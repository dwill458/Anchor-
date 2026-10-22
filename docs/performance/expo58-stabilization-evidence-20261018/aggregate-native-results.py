#!/usr/bin/env python3
"""Aggregate only the completed corrected native Focus run.

This is an evidence-only reader. It intentionally never opens the initial
unscoped logs, source files, databases, or key material. Run only after both
native-focus-cycles.jsonl and native-focus-traces.json contain the complete
corrected 20-sample run. The optional native-focused-observations.json adds
partial database and development-only JS timing data.
"""
from __future__ import annotations

import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
CYCLES_PATH = HERE / "native-focus-cycles.jsonl"
TRACES_PATH = HERE / "native-focus-traces.json"
OBSERVATIONS_PATH = HERE / "native-focused-observations.json"
OUTPUT_PATH = HERE / "native-focused-summary.json"

EXPECTED_SAMPLES = 20
BASELINE_COUNT = 21
EXPECTED_FINAL_COUNT = BASELINE_COUNT + EXPECTED_SAMPLES
TRACE_ID_RANGE = range(43, 83)  # corrected run's 20 writes and 20 same-session duplicates
DB_CAPTURE_AFTER_CORRECTED_SAMPLES = 2
DB_COMPLETIONS_BEFORE_CAPTURE = 23
JS_TIMER_RESUMED_AT_SAMPLE = 18
JS_TIMER_COVERAGE_END_SAMPLE = 20


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"{path.name}:{line_number} is not a JSON object")
        records.append(value)
    return records


def find_first(value: Any, key: str) -> Any:
    """Find a field under direct JSON, CDP wrapper, or nested `value` objects."""
    if isinstance(value, dict):
        if key in value:
            return value[key]
        for child in value.values():
            found = find_first(child, key)
            if found is not None:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_first(child, key)
            if found is not None:
                return found
    elif isinstance(value, str) and value[:1] in ("{", "["):
        try:
            return find_first(json.loads(value), key)
        except json.JSONDecodeError:
            pass
    return None


def quantiles(values: list[float]) -> dict[str, float | int]:
    if not values:
        return {"n": 0, "min": None, "median": None, "p95_nearest_rank": None, "max": None}
    ordered = sorted(float(v) for v in values)
    p95_index = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return {
        "n": len(ordered),
        "min": round(ordered[0], 3),
        "median": round(statistics.median(ordered), 3),
        "p95_nearest_rank": round(ordered[p95_index], 3),
        "max": round(ordered[-1], 3),
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> None:
    # Never emit a partial summary. Missing inputs or incomplete samples fail closed.
    for path in (CYCLES_PATH, TRACES_PATH):
        require(path.is_file(), f"Required completed-run input is missing: {path.name}")

    cycles = read_jsonl(CYCLES_PATH)
    start_records = [x for x in cycles if x.get("event") == "start"]
    require(len(start_records) == 1, "Expected exactly one corrected-run start record")
    start = start_records[0]
    require(start.get("baseline") == BASELINE_COUNT, "Corrected run must start from baseline 21")
    require(start.get("controlledSamples") == EXPECTED_SAMPLES and start.get("pilotSamples") == 0,
            "Expected 20 corrected controlled samples and no pilot in this run")

    route_starts = [x for x in cycles if x.get("event") == "route-start"]
    interrupted_starts = [x for x in cycles if x.get("event") == "interrupted-route-start"]
    inspector_disconnects = [x for x in cycles if x.get("event") == "inspector-disconnected"]
    resume_records = [x for x in cycles if x.get("event") == "resume-after-background"]
    verified = [x for x in cycles if x.get("event") == "cycle-verified"]
    homes = [x for x in cycles if x.get("event") == "home-returned"]
    require(len(interrupted_starts) == 1, f"Expected one explicitly marked interrupted attempt, found {len(interrupted_starts)}")
    require(len(inspector_disconnects) == 1 and inspector_disconnects[0].get("excludedFromControlledSamples") is True,
            "Expected one inspector-disconnected record explicitly excluded from controlled samples")
    require(len(verified) == EXPECTED_SAMPLES, f"Expected 20 verified cycles, found {len(verified)}")
    require(len(homes) == EXPECTED_SAMPLES, f"Expected 20 focused Home returns, found {len(homes)}")
    require([x.get("cycle") for x in verified] == list(range(1, EXPECTED_SAMPLES + 1)),
            "Verified cycle numbers are missing, duplicated, or out of order")
    require([x.get("cycle") for x in homes] == list(range(1, EXPECTED_SAMPLES + 1)),
            "Home-return cycle numbers are missing, duplicated, or out of order")
    for cycle_number, result in enumerate(verified, 1):
        require(result.get("controlled") is True and result.get("status") == "complete",
                f"Cycle {cycle_number} is not a completed controlled sample")
        require(result.get("expected") == BASELINE_COUNT + cycle_number,
                f"Cycle {cycle_number} does not reach expected canonical count {BASELINE_COUNT + cycle_number}")
        require(result.get("duplicatePrevented") is True and result.get("reopened") is True,
                f"Cycle {cycle_number} lacks duplicate-prevention or reopen verification")
        require(isinstance(result.get("observedCompletionMs"), (int, float)),
                f"Cycle {cycle_number} lacks focused completion timing")
    require(all(x.get("focusedRouteName") == "V2DevelopmentHome" for x in homes),
            "At least one sample did not return to focused V2DevelopmentHome")
    successful_cycle_numbers = {x["cycle"] for x in verified}
    route_started_cycles = {x.get("cycle") for x in route_starts}
    require(successful_cycle_numbers.issubset(route_started_cycles),
            "At least one successful sample has no route-start event")
    require(verified[-1].get("expected") == EXPECTED_FINAL_COUNT,
            "Final corrected canonical count must be 41")

    trace_doc = read_json(TRACES_PATH)
    trace_events = find_first(trace_doc, "traces")
    require(isinstance(trace_events, list), "native-focus-traces.json has no traces array")
    verified_cycles = find_first(trace_doc, "verifiedCycles")
    require(verified_cycles == EXPECTED_FINAL_COUNT,
            f"Trace artifact must attest verifiedCycles=41, got {verified_cycles!r}")
    corrected_events = [
        event for event in trace_events
        if isinstance(event, dict) and event.get("id") in TRACE_ID_RANGE
    ]
    begin_events = [event for event in corrected_events if event.get("phase") == "begin"]
    durable_events = [event for event in corrected_events if event.get("phase") == "durable"]
    require(len(begin_events) == 40 and len(durable_events) == 40,
            f"Expected 40 begin and 40 durable corrected service events; got {len(begin_events)} and {len(durable_events)}")
    require({event.get("id") for event in begin_events} == set(TRACE_ID_RANGE),
            "Corrected service begin IDs must cover 43 through 82")
    require({event.get("id") for event in durable_events} == set(TRACE_ID_RANGE),
            "Corrected service durable IDs must cover 43 through 82")
    require(all(event.get("duplicate") in (True, False) for event in durable_events),
            "Every corrected durable trace must identify whether it was a duplicate")
    durable_writes = [event for event in durable_events if event.get("duplicate") is False]
    duplicate_checks = [event for event in durable_events if event.get("duplicate") is True]
    require(len(durable_writes) == EXPECTED_SAMPLES and len(duplicate_checks) == EXPECTED_SAMPLES,
            "Expected 20 non-duplicate durable writes and 20 excluded duplicate checks")
    require(all(isinstance(event.get("ms"), (int, float)) for event in durable_writes),
            "A corrected durable write is missing its latency")

    observations: Any = read_json(OBSERVATIONS_PATH) if OBSERVATIONS_PATH.is_file() else None
    db_events = find_first(observations, "dbEvents") if observations is not None else None
    if not isinstance(db_events, list):
        db_events = []
    # Prefer completed queue records to avoid counting queue-started and queue twice.
    queue_complete = [e for e in db_events if isinstance(e, dict) and e.get("event") == "queue" and isinstance(e.get("waitMs"), (int, float))]
    queue_started = [e for e in db_events if isinstance(e, dict) and e.get("event") == "queue-started" and isinstance(e.get("waitMs"), (int, float))]
    queue_events = queue_complete if queue_complete else queue_started
    transaction_events = [
        e for e in db_events if isinstance(e, dict)
        and e.get("event") == "transaction-settled" and isinstance(e.get("ms"), (int, float))
    ]
    js_timing = find_first(observations, "jsTiming") if observations is not None else None
    if not isinstance(js_timing, dict):
        js_timing = None

    device_files = []
    for path in sorted(HERE.glob("focused-*-after.txt")):
        device_files.append({
            "file": path.name,
            "lastWriteUtc": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
            "text": path.read_text(encoding="utf-8-sig", errors="replace"),
        })

    output = {
        "artifact": "Corrected native Focus aggregation",
        "generatedUtc": datetime.now(timezone.utc).isoformat(),
        "classification": "DEV_ONLY",
        "releaseSamples": 0,
        "inputs": {
            "cycles": CYCLES_PATH.name,
            "traces": TRACES_PATH.name,
            "observations": OBSERVATIONS_PATH.name if observations is not None else None,
            "initialUnscopedLogsRead": False,
        },
        "correctedRun": {
            "baselineCount": BASELINE_COUNT,
            "plannedSamples": EXPECTED_SAMPLES,
            "completedSamples": len(verified),
            "homeReturns": len(homes),
            "routeStartEvents": len(route_starts),
            "uniqueStartedCycles": len(route_started_cycles),
            "extraRouteStartEvents": len(route_starts) - len(route_started_cycles),
            "finalCanonicalCount": EXPECTED_FINAL_COUNT,
            "resumedSamples": [JS_TIMER_RESUMED_AT_SAMPLE, JS_TIMER_COVERAGE_END_SAMPLE],
            "status": "complete",
        },
        "excludedInterruption": {
            "attempts": len(interrupted_starts),
            "interruptedCycle": interrupted_starts[0].get("cycle"),
            "inspectorDisconnects": len(inspector_disconnects),
            "excludedFromControlledSamples": True,
            "resumeMarkers": [{"baseline": x.get("baseline"), "utc": x.get("utc")} for x in resume_records],
            "rawPreInterruptionLog": "native-focus-pre-interruption.jsonl",
        },
        "routeToFocusedCompletionMs": quantiles([x["observedCompletionMs"] for x in verified]),
        "serviceDurableLatencyMs": {
            **quantiles([x["ms"] for x in durable_writes]),
            "correctedServiceTraceIdRangeInclusive": [min(TRACE_ID_RANGE), max(TRACE_ID_RANGE)],
            "duplicateTrueEventsExcluded": len(duplicate_checks),
        },
        "databaseObserver": {
            "coverage": "partial; observer was installed after two corrected samples and spans the later background/interruption gap",
            "correctedSamplesBeforeCapture": DB_CAPTURE_AFTER_CORRECTED_SAMPLES,
            "completionCountBeforeCapture": DB_COMPLETIONS_BEFORE_CAPTURE,
            "correctedSampleCoverage": "samples 3-17, then resumed samples 18-20; background gap is included in capture interval",
            "queueWaitMs": quantiles([x["waitMs"] for x in queue_events]),
            "queueWaitEventCount": len(queue_events),
            "transactionLatencyMs": quantiles([x["ms"] for x in transaction_events]),
            "transactionEventCount": len(transaction_events),
        },
        "jsTiming": {
            "classification": "DEV_ONLY; interval timer covers resumed samples 18-20 only and is not release frame-pacing evidence",
            "captureStartedBeforeCorrectedSample": JS_TIMER_RESUMED_AT_SAMPLE,
            "captureEndsAtCorrectedSample": JS_TIMER_COVERAGE_END_SAMPLE,
            "captureSampleCount": JS_TIMER_COVERAGE_END_SAMPLE - JS_TIMER_RESUMED_AT_SAMPLE + 1,
            "capture": js_timing,
        },
        "focusedDeviceAfterFiles": device_files,
        "timingDefinition": {
            "routeToFocusedCompletionMs": "cycle-verified.observedCompletionMs; time from route start until the focused route reports active=false, complete=true and the expected canonical count",
            "percentile": "nearest-rank p95",
            "serviceDurableLatencyMs": "ms from durable service traces with duplicate=false only",
        },
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.name}: 20 corrected samples, 20 Home returns, 20 durable writes; DEV_ONLY, release samples=0")


if __name__ == "__main__":
    main()
