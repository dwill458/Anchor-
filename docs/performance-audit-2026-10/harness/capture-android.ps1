[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._:-]+$')][string]$Serial,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._]+$')][string]$Package,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')][string]$Scenario,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')][string]$RunId,
  [Parameter(Mandatory = $true)][ValidateSet('begin', 'end')][string]$Phase,
  [switch]$ValidateOnly,
  [string]$OutputRoot = (Join-Path $PSScriptRoot 'captures'),
  [int]$PerfettoSeconds = 30
)

$ErrorActionPreference = 'Stop'
$expectedPackage = 'com.anchorintentions.perflab20261012'
. (Join-Path $PSScriptRoot 'capture-identity.ps1')
if ($Serial -ceq '.' -or $Serial -ceq '..') {
  throw 'ADB serial cannot be a path dot-segment.'
}
if ($Package -ceq 'com.anchorintentions.app' -or $Package -ceq 'com.anchorintentions.perfbaseline') {
  throw "Refusing protected package '$Package'."
}
if ($Package -cne $expectedPackage) {
  throw "Refusing package '$Package'. This harness is restricted to '$expectedPackage'."
}
if ($PerfettoSeconds -lt 5 -or $PerfettoSeconds -gt 35) {
  throw 'PerfettoSeconds must be between 5 and 35 to keep end-phase waiting bounded.'
}
$resolvedOutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$serialFolder = [BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($Serial)).Replace('-', '').ToLowerInvariant()
$runDir = [System.IO.Path]::GetFullPath((Join-Path (Join-Path (Join-Path $resolvedOutputRoot $serialFolder) $Scenario) $RunId))
$rootPrefix = $resolvedOutputRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $runDir.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Resolved capture directory escapes OutputRoot.'
}
if ($ValidateOnly) {
  Write-Output (@{
    validated = $true
    serial = $Serial
    captureDirectory = $runDir
    package = $Package
    scenario = $Scenario
    runId = $RunId
    phase = $Phase
    adbCommandsIssued = 0
  } | ConvertTo-Json -Compress)
  return
}

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) { throw 'adb was not found on PATH.' }
function Invoke-Adb([string[]]$Arguments) {
  $result = & $adb.Source -s $Serial @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "adb failed ($LASTEXITCODE): $($Arguments -join ' ')`n$($result -join "`n")"
  }
  return $result
}

$devices = & $adb.Source devices -l 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate ADB devices.' }
$deviceLine = @($devices | Where-Object { $_ -match "^$([regex]::Escape($Serial))\s+device\b" })
if ($deviceLine.Count -ne 1) { throw "Serial '$Serial' is not exactly one authorized online ADB target." }

$paths = Invoke-Adb @('shell', 'pm', 'path', '--user', '0', $Package)
if (-not ($paths -match '^package:')) { throw "Package '$Package' is not installed for Android user 0 on '$Serial'." }
$packageDump = Invoke-Adb @('shell', 'dumpsys', 'package', $Package)
$flagsLine = @($packageDump | Where-Object { $_ -match 'pkgFlags=\[' } | Select-Object -First 1)
if ($flagsLine.Count -ne 1 -or $flagsLine[0] -match '\bDEBUGGABLE\b') {
  throw "Expected installed non-debuggable release package; found: $($flagsLine -join '')"
}

New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$prefix = Join-Path $runDir "$stamp-$Phase"
$beginRecord = Join-Path $runDir "$RunId-begin.meta.txt"
$endRecord = Join-Path $runDir "$RunId-end.meta.txt"
$beginIdentityRecord = Join-Path $runDir "$RunId-identity-begin.json"
$endIdentityRecord = Join-Path $runDir "$RunId-identity-end.json"

function Get-VerifiedLabProcessIdentity {
  $pidOutput = Invoke-Adb @('shell', 'pidof', $expectedPackage)
  $appPid = ConvertFrom-ExactAndroidPidOutput -Output ($pidOutput -join "`n")
  $cmdlineOutput = Invoke-Adb @('shell', 'cat', "/proc/$appPid/cmdline")
  Test-ExactAndroidPackageCmdline -Cmdline ($cmdlineOutput -join "`n") -ExpectedPackage $expectedPackage | Out-Null
  $statOutput = Invoke-Adb @('shell', 'cat', "/proc/$appPid/stat")
  $startTimeTicks = ConvertFrom-AndroidProcStatStartTime -Output ($statOutput -join "`n")
  return [pscustomobject]@{ pid = $appPid; processStartTimeTicks = $startTimeTicks }
}

if ($Phase -eq 'begin') {
  if (Test-Path -LiteralPath $beginRecord) { throw "RunId '$RunId' already has a begin record; use a new RunId." }
  if (Test-Path -LiteralPath $endRecord) { throw "RunId '$RunId' already has an end record; use a new RunId." }
  if (Test-Path -LiteralPath $beginIdentityRecord) { throw "RunId '$RunId' already has an identity begin proof; use a new RunId." }
  if (Test-Path -LiteralPath $endIdentityRecord) { throw "RunId '$RunId' already has an identity end proof; use a new RunId." }
  Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $Package, 'reset') | Out-Null
  $deviceTrace = "/data/misc/perfetto-traces/anchor-perf-$Scenario-$RunId.pftrace"
  & $adb.Source -s $Serial shell test -e $deviceTrace | Out-Null
  if ($LASTEXITCODE -eq 0) { throw 'Refusing an existing device trace path.' }
  if ($LASTEXITCODE -ne 1) { throw 'Cannot verify the device trace path is unused.' }
  $appBeginIdentity = Get-VerifiedLabProcessIdentity
  $identityBegin = New-AndroidIdentityBeginRecord -Package $expectedPackage -ProcessId $appBeginIdentity.pid -ProcessStartTimeTicks $appBeginIdentity.processStartTimeTicks
  Write-NewJsonIdentityRecord -Path $beginIdentityRecord -Record $identityBegin
  $traceArgs = @(
    'shell', 'perfetto', '--background-wait', '-o', $deviceTrace,
    '-t', "${PerfettoSeconds}s", '-a', $Package, 'gfx', 'view', 'dalvik', 'sched', 'freq', 'idle'
  )
  $traceOutput = Invoke-Adb $traceArgs
  $pidMatches = @([regex]::Matches(($traceOutput -join "`n"), '(?m)^\s*(\d+)\s*$'))
  if ($pidMatches.Count -ne 1) {
    throw 'Perfetto did not confirm a background capture.'
  }
  $perfettoPid = $pidMatches[0].Groups[1].Value
  @(
    "utc=$([DateTime]::UtcNow.ToString('o'))",
    "startedAtUnixMs=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())",
    "serial=$Serial",
    "package=$Package",
    "scenario=$Scenario",
    "runId=$RunId",
    "perfettoSeconds=$PerfettoSeconds",
    "tracePath=$deviceTrace",
    "perfettoPid=$perfettoPid",
    "identityBegin=$beginIdentityRecord",
    'appStartOrInstall=not-performed',
    'logcat=not-captured'
  ) | Set-Content -LiteralPath $beginRecord -Encoding utf8
  $traceOutput | Set-Content -LiteralPath "$prefix.perfetto-start.txt" -Encoding utf8
  Write-Output "Capture started for '$Scenario' / '$RunId'. Perform only the named scenario on the isolated target; do not switch accounts or enter user data. Trace auto-finishes after $PerfettoSeconds seconds."
  return
}

if (Test-Path -LiteralPath $endRecord) { throw "RunId '$RunId' already has an end record; use a new RunId." }
if (Test-Path -LiteralPath $endIdentityRecord) { throw "RunId '$RunId' already has an identity end proof; use a new RunId." }
$beginFiles = @(Get-ChildItem -LiteralPath $runDir -Filter "$RunId-begin.meta.txt" -File)
if ($beginFiles.Count -ne 1) { throw "Expected exactly one begin record for RunId '$RunId'; found $($beginFiles.Count)." }
if (-not (Test-Path -LiteralPath $beginIdentityRecord -PathType Leaf)) { throw "Expected the unique identity begin proof '$beginIdentityRecord'." }
$identityBegin = Get-Content -LiteralPath $beginIdentityRecord -Raw | ConvertFrom-Json
if ($identityBegin.phase -cne 'begin' -or $identityBegin.package -cne $expectedPackage -or $identityBegin.pid -isnot [long] -and $identityBegin.pid -isnot [int]) {
  throw 'Identity begin proof does not match the fixed package, phase, and numeric PID contract.'
}

$gfx = Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $Package, 'framestats')
$mem = Invoke-Adb @('shell', 'dumpsys', 'meminfo', $Package)
$gfx | Set-Content -LiteralPath "$prefix.gfxinfo.txt" -Encoding utf8
$mem | Set-Content -LiteralPath "$prefix.meminfo.txt" -Encoding utf8

$meta = Get-Content -LiteralPath $beginRecord
$traceLine = $meta | Where-Object { $_ -like 'tracePath=*' } | Select-Object -First 1
if (-not $traceLine) { throw 'Matching begin record has no exact trace path.' }
$durationLine = $meta | Where-Object { $_ -like 'perfettoSeconds=*' } | Select-Object -First 1
if (-not $durationLine -or $durationLine -notmatch '^perfettoSeconds=(\d+)$') { throw 'Matching begin record has no valid trace duration.' }
$traceDurationSeconds = [int]$Matches[1]
if ($traceDurationSeconds -lt 5 -or $traceDurationSeconds -gt 35) { throw 'Matching trace duration is outside the permitted bound.' }
$startLine = $meta | Where-Object { $_ -like 'startedAtUnixMs=*' } | Select-Object -First 1
if (-not $startLine -or $startLine -notmatch '^startedAtUnixMs=(\d+)$') { throw 'Matching begin record has no valid start timestamp.' }
$traceStartedAtMs = [long]$Matches[1]
$expectedDeviceTrace = "/data/misc/perfetto-traces/anchor-perf-$Scenario-$RunId.pftrace"
$deviceTrace = $traceLine.Substring('tracePath='.Length)
if ($deviceTrace -cne $expectedDeviceTrace) { throw 'Refusing a trace path that does not match this exact scenario and run ID.' }
$pidLine = $meta | Where-Object { $_ -like 'perfettoPid=*' } | Select-Object -First 1
if (-not $pidLine -or $pidLine -notmatch '^perfettoPid=(\d+)$') { throw 'Matching begin record has no valid Perfetto process identity.' }
$perfettoPid = $Matches[1]
# The bounded Perfetto timer auto-finishes. Poll only this PID's command line
# and require the exact per-run trace path while it is active; this prevents a
# reused PID for an unrelated owner process from being mistaken for the trace.
# No signal is sent to any process.
$processEnded = $false
for ($attempt = 0; $attempt -lt ($traceDurationSeconds + 15); $attempt++) {
  $processArgs = & $adb.Source -s $Serial shell cat "/proc/$perfettoPid/cmdline" 2>&1
  $processExit = $LASTEXITCODE
  $processText = ($processArgs -join ' ') -replace "`0", ' '
  if ($processExit -ne 0 -or $processText -notlike "*$deviceTrace*") {
    $processEnded = $true
    break
  }
  Start-Sleep -Seconds 1
}
if (-not $processEnded) { throw 'The exact bounded Perfetto process remained active past its expected duration; leave the trace for operator inspection.' }
# Verify the exact trace output is stable after that exact process exits.
$previousSize = -1L
$stableReads = 0
for ($attempt = 0; $attempt -lt 8 -and $stableReads -lt 3; $attempt++) {
  Start-Sleep -Seconds 1
  $listing = & $adb.Source -s $Serial shell ls -ln $deviceTrace 2>&1
  if ($LASTEXITCODE -ne 0) { continue }
  $match = [regex]::Match(($listing -join ' '), '\s(\d+)\s+\d{4}-\d\d-\d\d\s+\d\d:\d\d\s+.+$')
  if ($match.Success -and [long]$match.Groups[1].Value -eq $previousSize) {
    $stableReads++
  } elseif ($match.Success) {
    $previousSize = [long]$match.Groups[1].Value
    $stableReads = 0
  }
}
if ($stableReads -lt 3) { throw 'Perfetto trace did not reach a stable file size within the bounded post-exit wait; leave the exact trace for operator inspection.' }

$appEndIdentity = Get-VerifiedLabProcessIdentity
$identityEnd = New-AndroidIdentityEndRecord -Package $expectedPackage -BeginPid ([long]$identityBegin.pid) -EndPid $appEndIdentity.pid -BeginStartTimeTicks ([long]$identityBegin.processStartTimeTicks) -EndStartTimeTicks $appEndIdentity.processStartTimeTicks
Write-NewJsonIdentityRecord -Path $endIdentityRecord -Record $identityEnd

$traceOut = Join-Path $runDir "$RunId-$stamp.pftrace"
if (Test-Path -LiteralPath $traceOut) { throw "Refusing to overwrite existing trace '$traceOut'." }
Invoke-Adb @('pull', $deviceTrace, $traceOut) | Out-Null
Invoke-Adb @('shell', 'rm', '-f', $deviceTrace) | Out-Null
@(
  "utc=$([DateTime]::UtcNow.ToString('o'))",
  "serial=$Serial",
  "package=$Package",
  "scenario=$Scenario",
  "runId=$RunId",
  "tracePulled=$traceOut",
  "identityEnd=$endIdentityRecord",
  "stablePid=$($identityEnd.stablePid.ToString().ToLowerInvariant())",
  'logcat=not-captured',
  'screenshots=not-captured'
) | Set-Content -LiteralPath $endRecord -Encoding utf8
Write-Output "Saved one bounded app-scoped gfxinfo sample, package meminfo, and trace for '$Scenario' / '$RunId'. No app log text or screenshots captured."
