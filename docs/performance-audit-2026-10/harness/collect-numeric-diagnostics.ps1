[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9._:-]+$')][string]$Serial,
  [Parameter(Mandatory)][string]$Package,
  [Parameter(Mandatory)][string]$OutputPath,
  [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
if ($Package -cne 'com.anchorintentions.perflab20261012') { throw 'Refusing protected or unknown package.' }
if ($Serial -ceq '.' -or $Serial -ceq '..') { throw 'Invalid serial.' }
$events = @('secure-read','secure-write','storage-fallback','fixture-seed','fixture-roundtrip','auth-adapter-control','benchmark-skip','benchmark-complete','benchmark-error','app-ready','anchor-hydration','focus-await','auth-adapter-write','js-loop-histogram','auth-emulator-route','startup-recovery','startup-fault','motion-fixture-seed')
$fields = @('durationMs','elapsedMs','resultCode','sceneCount','waypointCount','cacheCount','payloadChars','chunkCount','secureChunkCount','previousChunkCount','nativeCallCount','nativeFailureCount','fallbackCode','phaseCode','anchorCount','hydratedCount','readParseDurationMs','verifyDurationMs','writeDurationMs','combinedDurationMs','secureVerifyDurationMs','authAdapterWriteDurationMs','authHelperSettlementDurationMs','authControlMaxDurationMs','authControlMinDurationMs','authWriteControlDeltaMs','authControlSettlementMaxDurationMs','trial','trials','maxDurationMs','minDurationMs','reasonCode','okCode','fixtureCount','payloadCharCount','p50Ms','p95Ms','maxMs','sampleCount','over50Count','appComponentMountElapsedMs','secureReadEventCount','secureWriteEventCount','fallbackCount')
if ($ValidateOnly) { Write-Output 'PASS: exact lab package; no ADB calls.'; return }
$adb = Get-Command adb -ErrorAction Stop
$pidText = & $adb.Source -s $Serial shell pidof $Package 2>$null
if ($LASTEXITCODE -ne 0 -or "$pidText" -notmatch '^\d+$') { throw 'Expected one live lab process.' }
$labPid = "$pidText".Trim()
$commandLine = & $adb.Source -s $Serial shell cat "/proc/$labPid/cmdline" 2>$null
if ($LASTEXITCODE -ne 0 -or "$commandLine".Trim([char]0).Trim() -cne $Package) { throw 'Lab PID ownership check failed.' }
$raw = & $adb.Source -s $Serial logcat --pid=$labPid -d -v epoch 'ReactNativeJS:W' '*:S' 2>$null
if ($LASTEXITCODE -ne 0) { throw 'App-filtered diagnostic read failed.' }
$commandLine = & $adb.Source -s $Serial shell cat "/proc/$labPid/cmdline" 2>$null
if ($LASTEXITCODE -ne 0 -or "$commandLine".Trim([char]0).Trim() -cne $Package) { throw 'Lab process changed; refusing evidence output.' }
$records = @()
foreach ($line in $raw) {
  $logEpochSeconds = $null
  if ($line -match '^\s*(\d{9,}(?:\.\d+)?)\s') { $logEpochSeconds = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture) }
  # React Native can quote/comma-separate the two console arguments in release.
  if ($line -notmatch '\[PERF-DIAG\][\s\x27\x22\x2c]*(\{.*\})[\s\x27\x22\x2c]*$') { continue }
  try { $record = $Matches[1] | ConvertFrom-Json -AsHashtable -ErrorAction Stop } catch { continue }
  if ($record.event -cnotin $events) { continue }
  $safe = [ordered]@{ event = $record.event }
  if ($null -ne $logEpochSeconds) { $safe.logEpochSeconds = $logEpochSeconds }
  $valid = $true
  foreach ($name in $record.Keys) {
    if ($name -ceq 'event') { continue }
    $value = $record[$name]
    if ($name -cnotin $fields -or $value -isnot [ValueType] -or $value -is [bool] -or
        [double]::IsNaN([double]$value) -or [double]::IsInfinity([double]$value)) { $valid = $false; break }
    $safe[$name] = $value
  }
  if ($valid) { $records += ($safe | ConvertTo-Json -Compress) }
}
$resolved = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $resolved) { throw 'Refusing to overwrite prior numeric evidence.' }
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($resolved)) | Out-Null
$records | Set-Content -LiteralPath $resolved -Encoding utf8
Write-Output ("Saved {0} numeric events from lab PID {1}; raw logs not retained." -f $records.Count,$labPid)

