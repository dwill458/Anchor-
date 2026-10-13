$ErrorActionPreference = 'Stop'
$capture = Join-Path $PSScriptRoot 'capture-android.ps1'
$identityHelpers = Join-Path $PSScriptRoot 'capture-identity.ps1'
. $identityHelpers

# Offline parser tests exercise the ownership gate without invoking adb.
if ((ConvertFrom-ExactAndroidPidOutput -Output "4508`n" ) -ne 4508) {
  throw 'A single numeric Android PID was not parsed.'
}
foreach ($invalidPidOutput in @('', "4508`n5813", '4508 shell', '0')) {
  $pidRejected = $false
  try { ConvertFrom-ExactAndroidPidOutput -Output $invalidPidOutput | Out-Null } catch { $pidRejected = $true }
  if (-not $pidRejected) { throw 'A zero, multiple, malformed, or invalid Android PID was accepted.' }
}
if (-not (Test-ExactAndroidPackageCmdline -Cmdline "com.anchorintentions.perflab20261012`0" -ExpectedPackage 'com.anchorintentions.perflab20261012')) {
  throw 'The exact NUL-terminated package cmdline was not accepted.'
}
foreach ($invalidCmdline in @('com.anchorintentions.perflab20261012.extra', 'com.anchorintentions.perflab20261012 arg', 'com.anchorintentions.app')) {
  $cmdlineRejected = $false
  try { Test-ExactAndroidPackageCmdline -Cmdline $invalidCmdline -ExpectedPackage 'com.anchorintentions.perflab20261012' | Out-Null } catch { $cmdlineRejected = $true }
  if (-not $cmdlineRejected) { throw 'A non-exact Android process cmdline was accepted.' }
}
$samePidEnd = New-AndroidIdentityEndRecord -Package 'com.anchorintentions.perflab20261012' -BeginPid 4508 -EndPid 4508 -BeginStartTimeTicks 900 -EndStartTimeTicks 900
$restartedPidEnd = New-AndroidIdentityEndRecord -Package 'com.anchorintentions.perflab20261012' -BeginPid 4508 -EndPid 5813 -BeginStartTimeTicks 900 -EndStartTimeTicks 1000
$reusedPidEnd = New-AndroidIdentityEndRecord -Package 'com.anchorintentions.perflab20261012' -BeginPid 4508 -EndPid 4508 -BeginStartTimeTicks 900 -EndStartTimeTicks 1000
$beginIdentity = New-AndroidIdentityBeginRecord -Package 'com.anchorintentions.perflab20261012' -ProcessId 4508 -ProcessStartTimeTicks 900
if (-not $samePidEnd.stablePid -or $restartedPidEnd.stablePid -or $reusedPidEnd.stablePid -or $restartedPidEnd.beginPid -ne 4508 -or $restartedPidEnd.pid -ne 5813) {
  throw 'Stable PID comparison did not distinguish same-process and restarted-process captures.'
}
if ($beginIdentity.package -cne 'com.anchorintentions.perflab20261012' -or $beginIdentity.phase -cne 'begin' -or $beginIdentity.pid -ne 4508 -or -not $beginIdentity.hostCheckTimeUtc -or $samePidEnd.package -cne 'com.anchorintentions.perflab20261012' -or $samePidEnd.phase -cne 'end' -or -not $samePidEnd.hostCheckTimeUtc) {
  throw 'Identity records did not retain fixed package, phase, PID, and host check time.'
}
$syntheticProcFields = @('S') + @(1..18) + @(987)
$syntheticProcStat = "123 (synthetic fixture) $($syntheticProcFields -join ' ')"
if ((ConvertFrom-AndroidProcStatStartTime -Output $syntheticProcStat) -ne 987) {
  throw 'Android proc stat parser did not read numeric process start time ticks.'
}
$proofPath = Join-Path $env:TEMP ('anchor-identity-proof-' + [guid]::NewGuid().ToString('N') + '.json')
try {
  Write-NewJsonIdentityRecord -Path $proofPath -Record $beginIdentity
  $existingProofRefused = $false
  try { Write-NewJsonIdentityRecord -Path $proofPath -Record $beginIdentity } catch { $existingProofRefused = $true }
  if (-not $existingProofRefused) { throw 'Identity proof writer overwrote an existing proof path.' }
} finally {
  if (Test-Path -LiteralPath $proofPath) { Remove-Item -LiteralPath $proofPath -Force }
}

$package = 'com.anchorintentions.perflab20261012'
$argsBase = @{
  Serial = 'isolated-device-serial'
  Package = $package
  Scenario = 'validation-only'
  RunId = 'validation01'
  Phase = 'begin'
  ValidateOnly = $true
}

$valid = (& $capture @argsBase | ConvertFrom-Json)
if (-not $valid.validated -or $valid.adbCommandsIssued -ne 0) {
  throw 'ValidateOnly did not return a zero-ADB dry run.'
}
$expectedSerialFolder = [BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($argsBase.Serial)).Replace('-', '').ToLowerInvariant()
$expectedRunDir = [System.IO.Path]::GetFullPath((Join-Path (Join-Path (Join-Path (Join-Path $PSScriptRoot 'captures') $expectedSerialFolder) $argsBase.Scenario) $argsBase.RunId))
if ($valid.captureDirectory -cne $expectedRunDir) {
  throw 'ValidateOnly serial encoding does not match the stable UTF-8 hex output convention.'
}
$badSerial = $false
try {
  $bad = $argsBase.Clone()
  $bad.Serial = '..'
  & $capture @bad | Out-Null
} catch {
  $badSerial = $_.Exception.Message -like 'ADB serial cannot be a path dot-segment*'
}
if (-not $badSerial) { throw 'Dot-segment ADB serial was not rejected.' }

$specialRoot = Join-Path $env:TEMP ('anchor-perf-root-' + [guid]::NewGuid().ToString('N'))
$special = $argsBase.Clone()
$special.Serial = '127.0.0.1:5555'
$special.OutputRoot = $specialRoot
$specialResult = (& $capture @special | ConvertFrom-Json)
$expectedPrefix = [System.IO.Path]::GetFullPath($specialRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $specialResult.captureDirectory.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Special-character ADB serial escaped the configured output root.'
}

$refused = $false
try {
  $bad = $argsBase.Clone()
  $bad.Package = 'com.anchorintentions.app'
  & $capture @bad | Out-Null
} catch {
  $refused = $_.Exception.Message -like "Refusing protected package*"
}
if (-not $refused) { throw 'Owner-package refusal was not enforced.' }
$oldPackageRefused = $false
try {
  $bad = $argsBase.Clone()
  $bad.Package = 'com.anchorintentions.perfbaseline'
  & $capture @bad | Out-Null
} catch {
  $oldPackageRefused = $_.Exception.Message -like 'Refusing protected package*'
}
if (-not $oldPackageRefused) { throw 'User-touched old-package refusal was not enforced.' }

$secondsRefused = $false
try {
  $badDuration = $argsBase.Clone()
  $badDuration.PerfettoSeconds = 181
  & $capture @badDuration | Out-Null
} catch {
  $secondsRefused = $_.Exception.Message -like 'PerfettoSeconds must be between*'
}
if (-not $secondsRefused) { throw 'Perfetto duration bound was not enforced.' }

Write-Output 'Harness preflight checks passed: zero-ADB dry run, owner and user-touched package refusals, Perfetto duration bound.'
