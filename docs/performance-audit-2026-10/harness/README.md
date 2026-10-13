# Release baseline harness (safe preparation)

This folder contains only new harness assets. Nothing here installs, launches,
clears, or signs into the app. Native capture is restricted to the isolated
candidate package `com.anchorintentions.perflab20261012` (Android label `Anchor PERF LAB`, scheme `anchor-perflab20261012`); the parent release
operator controls the device, artifact installation, account, and scenario.

## Synthetic fixtures

From the repository root, run:

```powershell
node docs/performance-audit-2026-10/harness/generate-synthetic-fixtures.mjs $env:TEMP\anchor-perf-fixtures
```

The script generates a single 10,000-character synthetic Anchor and a
72-Anchor JSON array calibrated to 719,217 characters (UTF-8 bytes are also
reported). The records contain synthetic IDs and intention strings, generated
SVG path geometry, no image URLs, and no owner data. The 1,800-character
chunk count is arithmetic matching the current adapter constant; generation
does not exercise `encryptedPersistStorage`, SecureStore, Zustand hydration,
auth, or Focus.

The 72-record size matches the historical audit payload size only. Its data
distribution is a size fixture, not a recovered user payload or a claim that
all real Anchors have the same shape. Treat JSON parse/stringify timings from
any local benchmark as host-side synthetic timings, never as release-device
hydration or write results.

## Device capture

The diagnostic app accepts only these exact, cold-start fixture controls after
its package-ID, loopback API, signed-out, and V2 guards pass:

| Stage | Exact initial URL |
|---|---|
| Seed one Anchor | `anchor-perflab20261012://perf/seed-small` |
| Seed 72 Anchors | `anchor-perflab20261012://perf/seed-large` |
| Measure native adapter | `anchor-perflab20261012://perf/measure-adapter` |
| Prime selected synthetic motion caches | `anchor-perflab20261012://perf/prepare-motion` |
| Arm one-shot startup fault | Three exact `anchor-perflab20261012://perf/arm-startup-*` literals in `diagnostic-src/startupFaultDiagnostic.ts` |

The default cold launch has no stage action. A null initial URL may use the
optional build-time `EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION` fallback; any
non-null unrecognized URL, including a query string, is a no-op and does not
fall back. The app compares complete literal strings, never parses or logs the
URL. Force-stop the isolated package before each explicit stage intent so
`Linking.getInitialURL()` sees the supplied URL; use only the parent-authorized
serial and package:

```powershell
$serial = 'AUTHORIZED_ISOLATED_SERIAL'
$package = 'com.anchorintentions.perflab20261012'
adb -s $serial shell am force-stop $package
adb -s $serial shell am start -a android.intent.action.VIEW -d 'anchor-perflab20261012://perf/seed-small' $package
```

Use the matching `seed-large` or `measure-adapter` URL for those stages. For
measured cold hydration, force-stop and launch normally without a fixture URL.
These controls stage only synthetic guest persistence; they do not perform
onboarding UI or Firebase authentication.

Use a new run ID for every repetition. The package and online ADB serial are
mandatory, and the script accepts only the isolated candidate package. It explicitly refuses both the owner package com.anchorintentions.app and the previously user-touched com.anchorintentions.perfbaseline package.
It checks install visibility for Android user 0 and rejects a package whose installed flags include
`DEBUGGABLE`. The script does not install/start/stop the app, change app data,
capture logcat, capture screenshots, or enumerate shared storage.

```powershell
$script = 'docs/performance-audit-2026-10/harness/capture-android.ps1'
& $script -Serial 'DEVICE_SERIAL' -Package 'com.anchorintentions.perflab20261012' -Scenario 'small-cold-hydration' -RunId 'rep01' -Phase begin -PerfettoSeconds 30
# Operator performs only the named scenario in the isolated candidate app.
& $script -Serial 'DEVICE_SERIAL' -Package 'com.anchorintentions.perflab20261012' -Scenario 'small-cold-hydration' -RunId 'rep01' -Phase end
```

`begin` resets only that package's gfxinfo counters and starts a bounded,
30-second Perfetto capture filtered to the candidate app's graphics, view, and
Dalvik atrace categories, with scheduler/frequency/idle events for thread/CPU
analysis. At each capture boundary the script writes a separate, create-only
identity JSON record after requiring one positive PID from `pidof` and an exact
`/proc/<pid>/cmdline` match; it records numeric `/proc/<pid>/stat` start-time
ticks as a process-reuse check. The end record includes both numeric PIDs and
start-time ticks. `stablePid` is true only when both match, so a restart is
reported false even if Android reuses a PID. A cold restart may produce false
and is allowed. These are boundary checks, not proof of uninterrupted
ownership throughout the trace.
Scheduler data includes system process metadata in the restricted local trace;
shared summaries must filter to the exact lab process and contain numeric
results only. Activity/window categories and screenshots are excluded.
`end` waits for the exact bounded Perfetto process to
exit on its timer, verifies the corresponding trace file reaches a stable
size, saves that package's frame statistics and memory summary, and removes
only that exact trace file. The session also has a 35-second maximum if the end
step is interrupted. The script never signals a stored PID. Output stays under
`harness/captures/<serial-token>/<scenario>/<run-id>/`, where serial-token is a
hex encoding of the serial for filesystem safety. Preserve numeric summaries and trace
metadata only; do not attach raw private logs or screenshots to the audit.
The gfxinfo framestats output is a bounded platform history, not a complete
30-cycle distribution. Capture each repetition with its own run ID and report
per-run samples; do not infer a full loop distribution from one dump.

### Numeric Perfetto summary

Run `app-filtered-summary.sql` locally against a pulled `.pftrace` with the
official Trace Processor v58.2 wrapper available at
`$env:TEMP\anchor-perf-release-20261012\tools\trace_processor.py`:

```powershell
$traceProcessor = Join-Path $env:TEMP 'anchor-perf-release-20261012\tools\trace_processor.py'
python $traceProcessor query -f 'docs/performance-audit-2026-10/harness/app-filtered-summary.sql' 'PATH_TO_LOCAL_TRACE.pftrace'
```

The SQL matches only `com.anchorintentions.perflab20261012` and emits numeric
counts/durations plus fixed thread codes (0 other/unknown, 1 main via Trace
Processor's `is_main_thread` flag, 2 JS, 3
native modules, 4 render, 5 JIT, 6 heap task). It never selects raw slice,
thread, frame-layer, or process names into the output. FrameTimeline and
scheduler sections can be empty when those events were not captured; absence
is not evidence of zero frame work or CPU activity. Inclusive slices can
overlap, so their sum is not wall time. Scheduler durations represent CPU
execution; these aggregates alone do not establish what caused a JS event-loop
gap or frame delay. Some Android traces may omit the package from Perfetto's
process name and command-line metadata; in that case this exact-package SQL
cannot attribute app CPU/frame rows. Do not broaden it with a package-prefix
match. A numeric PID fallback requires the matching exact-package identity
checks at both capture boundaries and the numeric collector's exact `/proc`
cmdline checks before and after a read within the capture window; report that
external provenance and its time bounds, since Perfetto itself did not attest
the package. If the process changes during capture, boundary PIDs alone do not
associate a PID with the trace. The raw trace contains system process/thread
metadata and stays a restricted local artifact; share only numeric summaries.

Before any seed marker or storage access, the storage fixture runner requires the hydrated first-run draft to be pristine (welcome step, empty life-change list, and no other draft fields); a pending onboarding draft is a no-op. The runner independently checks `expo-application.applicationId` equals the isolated package and `API_URL` equals `http://127.0.0.1:39999` before any marker read or store mutation; the auth adapter helper repeats both fail-closed checks. The original V2 storage-only patch predates Auth Emulator support. The V4 Auth delta is a separate review-only patch under `auth-emulator/`, configured for only the `demo-anchor-perf` project and loopback endpoints. Its Account C (`synthetic-account-c`) is a verified demo account with a fixture API `isComped=true` profile; it exercises only the unchanged local Pro gate and does not imply production entitlement, billing, or RevenueCat behavior. V5 motion/fault actions require the verified C claims plus a byte-exact canonical Account A 72-record fixture check before any cache/marker write. They do not transfer Anchor ownership: only the selected synthetic Anchor's C-scoped Vision and Chart caches are primed, while all Anchor records remain Account A. See `diagnostic-src/INTEGRATION.md` for action details. Before each capture, the operator must ensure the isolated package contains no
owner account or data and that the selected device is the explicitly authorized
isolated target. Do not run this against the owner's installed package.
Use `-ValidateOnly` to check the argument path without issuing ADB commands; it
returns the resolved `captureDirectory`. Dot-segment serials are rejected, and
the script verifies the resolved path stays beneath `OutputRoot`. Package refusal is checked before device discovery. The bounded trace wait does
not bound a hung ADB transport command; if ADB stalls, stop the script and
inspect only the explicitly named isolated target and run ID.

## Scenario matrix and current limits

| Scenario | Fixture / action | Capture | Evidence boundary |
|---|---|---|---|
| Small cold hydration | Explicit `seed-small` action creates the canonical Guest fixture; action is unset for the measured relaunch | perfetto + gfxinfo + meminfo | Diagnostic source delta required; record `appComponentMountElapsedMs` (JS App component elapsed time) and Anchor-store hydration separately; it is not OS launch-to-Home time. Seed bypasses onboarding UI. |
| Large cold hydration | Explicit `seed-large` stage creates 72 synthetic Anchors after readiness; action is unset for measured relaunch | perfetto + gfxinfo + meminfo | 719,217 JSON chars; synthetic SVG geometry is a storage fixture, not visual acceptance evidence. |
| Complete write | Explicit `measure-adapter` action writes through actual `encryptedPersistStorage` and auth adapter using fixed synthetic keys | perfetto + gfxinfo + meminfo | Require direct SecureStore readback, native success/error counts, and zero fallback. |
| Auth wait | Three synthetic auth adapter control writes compared with three auth writes overlapping separate debounced 72-Anchor writes | perfetto + gfxinfo + meminfo | Reports adapter `setItem` time, full helper settlement, and write-only control delta; cannot isolate queue wait or model Firebase auth/UI. |
| Focus awaited queue x10 | Ten 10-second Focus runs, one named capture per run | perfetto + gfxinfo + meminfo | Requires V4 local Auth Emulator Account C with verified claims and the loopback API. Guest Focus rejects before durable queue. This is synthetic local-gate coverage only, not production entitlement evidence. |
| JS event loop / frames | During each scenario, bounded numeric JS event-loop histogram alongside gfxinfo | perfetto + gfxinfo | The existing Home-startup, render, and stall probes remain dev-only; the diagnostic JS loop histogram runs in release only when its diagnostic flag is enabled. Native traces alone do not identify JS semantic spans. |

## Required instrumentation gap

The existing Home-startup profiler, render reporter, and stall detector remain
disabled outside development. The separate diagnostic-only release source
delta adds numeric SecureStore timings, Anchor hydration marks, auth-adapter
control/overlap comparisons, Focus persistence-await marks, app component-mount
elapsed time, and the bounded JS loop histogram when its diagnostic flag is
enabled. External ADB capture alone cannot report those semantic timings; they
require the reviewed diagnostic build and numeric event collector. Auth
overlap is a control comparison, not an isolated queue-wait measurement. The
delta emits fixed event names and numeric counts/timings only, with no account
IDs, intention text, credentials, image URLs, or payloads. If the delta is not
included, mark each semantic timing unmeasured; do not substitute synthetic
fixture calculations or native frame traces for it.

The stubbed Jest suite validates fixture guards and benchmark timing boundaries only; its adapter mocks are not SecureStore or device evidence. From the isolated diagnostic project root, run it with the repository harness config (the test file remains under `docs/.../harness/diagnostic-src`):

```powershell
$env:ANCHOR_PERF_HARNESS_ROOT = (Get-Location).Path
npx jest --runInBand --config 'E:\Projects\Anchor\docs\performance-audit-2026-10\harness\diagnostic-src\jest.harness.config.cjs' --no-cache
```

The exact initial URLs allow all three fixture stages in one diagnostic build; the optional compile-time action is only a fallback when the initial URL is null. Keep the diagnostic artifact distinct from the clean baseline; measured cold launches must have no fixture URL or fallback action.

This harness does not seed or inspect an owner app/account and does not define
or change any persistence schema, migration, production instrumentation, or
product behavior.

## Numeric diagnostic collection

`collect-numeric-diagnostics.ps1` accepts only the lab package, resolves its
single live PID, verifies the process command line before and after the read,
and retains only fixed `[PERF-DIAG]` events with allowlisted finite numeric
fields. Raw app log lines remain transient in memory; unknown events, string
fields, credentials and payloads are not written or displayed. Existing output
files are refused. Use a new absolute output path per launch; `-ValidateOnly`
checks package/serial gates and performs zero ADB calls.
The collector also retains Android's numeric log epoch timestamp for aligning
diagnostic events with trace clocks. Those checks bracket the collector read,
not the entire Perfetto capture; durations alone do not establish causality.

```powershell
& .\docs\performance-audit-2026-10\harness\collect-numeric-diagnostics.ps1 `
  -Serial 'AUTHORIZED_ISOLATED_SERIAL' -Package 'com.anchorintentions.perflab20261012' `
  -OutputPath "$env:TEMP\anchor-perf-release-20261012\numeric\launch-01.jsonl"
```
