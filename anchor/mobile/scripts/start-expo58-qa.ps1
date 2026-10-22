$ErrorActionPreference = 'Stop'

$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$expectedPackage = 'com.anchorintentions.sqlcipherpreview20261015'
$expectedRuntime = '2.0-sqlcipher-v2-realdata-qa'
$expectedApi = 'https://anchor-production-26bf.up.railway.app'

Set-Location -LiteralPath $mobileRoot

if (-not (Test-Path -LiteralPath (Join-Path $mobileRoot 'package.json'))) {
  throw "Mobile project not found at $mobileRoot"
}

$package = Get-Content -Raw (Join-Path $mobileRoot 'package.json') | ConvertFrom-Json
$expoVersion = (& node -p "require('expo/package.json').version").Trim()
if ($LASTEXITCODE -ne 0 -or $expoVersion -notmatch '^58\.') {
  throw "Expected installed Expo SDK 58; found '$expoVersion'. Run npm ci in $mobileRoot."
}
if ($package.dependencies.expo -notmatch '^\^?58\.') {
  throw "package.json does not declare Expo SDK 58 (found '$($package.dependencies.expo)')."
}

# Always select the real-account owner QA profile. The similarly named
# ANCHOR_EXPO58_QA profile is synthetic and uses a placeholder backend.
$env:ANCHOR_EXPO58_QA = $null
$env:ANCHOR_SQLCIPHER_PRODUCTION_QA = '1'
$env:ANCHOR_SQLCIPHER_OWNER_PILOT = $null
$env:ANCHOR_SQLCIPHER_OWNER_PILOT_ACTIVATE = $null
$env:ANCHOR_SQLCIPHER_PREVIEW = $null
$env:ANCHOR_SQLCIPHER_LAB = $null

if ($env:EXPO_PUBLIC_API_URL -and $env:EXPO_PUBLIC_API_URL -match '\.invalid') {
  throw "EXPO_PUBLIC_API_URL points to a synthetic/invalid backend: $env:EXPO_PUBLIC_API_URL"
}
if ($env:EXPO_PUBLIC_API_URL -and $env:EXPO_PUBLIC_API_URL.TrimEnd('/') -ne $expectedApi) {
  throw "EXPO_PUBLIC_API_URL is '$($env:EXPO_PUBLIC_API_URL)'; owner QA expects $expectedApi."
}
$env:EXPO_PUBLIC_API_URL = $expectedApi

# Evaluate the same dynamic Expo config Metro will bundle, then verify the
# runtime gate and native SQLCipher plugin that select the encrypted adapter.
$configOutput = & npx expo config --type public --json
if ($LASTEXITCODE -ne 0) { throw 'Expo config evaluation failed; Metro was not started.' }
$config = ($configOutput -join "`n") | ConvertFrom-Json
if ($config.android.package -ne $expectedPackage -or $config.runtimeVersion -ne $expectedRuntime) {
  throw "Expo config mismatch. Expected $expectedPackage / $expectedRuntime; got $($config.android.package) / $($config.runtimeVersion)."
}
if ($config.extra.sqlCipherLab -ne $true -or $config.extra.sqlCipherOwnerPilot -ne $false) {
  throw 'Expo runtime config does not enable the isolated SQLCipher storage cohort.'
}
$sqlitePlugin = $config.plugins | Where-Object { $_ -is [array] -and $_[0] -eq 'expo-sqlite' } | Select-Object -First 1
if (-not $sqlitePlugin -or $sqlitePlugin[1].useSQLCipher -ne $true) {
  throw 'Expo config does not compile expo-sqlite with useSQLCipher=true.'
}
$cohortPath = Join-Path $mobileRoot 'src/storage/sqlcipher/cohort.ts'
$cohortSource = Get-Content -Raw $cohortPath
if ($cohortSource -notmatch [regex]::Escape($expectedPackage) -or $cohortSource -notmatch 'return labEnabled \|\|') {
  throw 'SQLCipher runtime cohort gate does not admit this package and configured storage flag.'
}

$listeners = @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  $details = foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = if ($process) { $process.CommandLine } else { '<process details unavailable>' }
    $owner = if ($commandLine -and $commandLine.IndexOf($mobileRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
      'this clean worktree'
    } elseif ($commandLine -and $commandLine -match 'expo58-upgrade') {
      'the previous Expo 58 worktree'
    } else {
      'another or unidentified project'
    }
    "PID $($listener.OwningProcess) ($owner): $commandLine"
  }
  $detailText = $details -join [Environment]::NewLine
  throw ("Port 8081 is occupied. No process was stopped.`n{0}`nStop or reconfigure the identified Metro process, then rerun this command." -f $detailText)
}

Write-Host "Expo SDK: $expoVersion"
Write-Host "Worktree: $mobileRoot"
Write-Host "Runtime: $expectedRuntime"
Write-Host "Android package: $expectedPackage"
Write-Host "API: $expectedApi"
Write-Host 'Storage: SQLCipher (expo-sqlite useSQLCipher=true; sqlCipherLab cohort gate enabled)'
Write-Host 'The installed dev client must be this package and runtime. This script never installs, clears, or uninstalls an app.'

& npx expo start --dev-client --clear --scheme anchor-sqlcipher-qa --host lan --port 8081
exit $LASTEXITCODE
