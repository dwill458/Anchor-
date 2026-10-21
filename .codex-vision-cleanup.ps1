$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath('E:\Projects\Anchor')
$targets = [Collections.Generic.List[string]]::new()
function Add-Target([string]$path) {
  if (Test-Path -LiteralPath $path) { $targets.Add([IO.Path]::GetFullPath($path)) }
}
foreach ($relative in @(
  'anchor/mobile/android/app/build', 'anchor/mobile/android/app/.cxx',
  'anchor/mobile/android/build', 'anchor/mobile/android/.gradle', 'anchor/mobile/android/.kotlin',
  'anchor/mobile/.codex-vision-export', '.codex-vision-avd', '.codex-vision-provider-qa'
)) { Add-Target (Join-Path $workspace $relative) }
$modules = Join-Path $workspace 'anchor\mobile\node_modules'
$packages = @(Get-ChildItem -LiteralPath $modules -Directory -Force | Where-Object { $_.Name -notlike '@*' })
foreach ($scope in @(Get-ChildItem -LiteralPath $modules -Directory -Force | Where-Object { $_.Name -like '@*' })) {
  $packages += @(Get-ChildItem -LiteralPath $scope.FullName -Directory -Force)
}
foreach ($package in $packages) {
  if ($package.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
  Add-Target (Join-Path $package.FullName 'android\build')
  Add-Target (Join-Path $package.FullName 'android\.cxx')
}
foreach ($relative in @(
  '@react-native/gradle-plugin/react-native-gradle-plugin/build',
  '@react-native/gradle-plugin/settings-plugin/build',
  '@react-native/gradle-plugin/shared/build',
  '@react-native/gradle-plugin/shared-testutil/build',
  'expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/build',
  'expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-settings-plugin/build',
  'expo-modules-autolinking/android/expo-gradle-plugin/shared/build',
  'expo-modules-core/expo-module-gradle-plugin/build'
)) { Add-Target (Join-Path $modules $relative) }
$ownIni = [IO.Path]::GetFullPath('C:\Users\dwill\.android\avd\VisionConversationQA20261020.ini')
$ownHarness = [IO.Path]::GetFullPath((Join-Path $env:TEMP 'anchor-vision-pg-harness-20261020'))
$ownSchema = [IO.Path]::GetFullPath((Join-Path $env:TEMP 'anchor-vision-schema-index-20261020.prisma'))
Add-Target $ownIni
Add-Target $ownHarness
Add-Target $ownSchema
Add-Target (Join-Path $workspace 'backend\.codex-vision-schema.patch')
foreach ($file in @(Get-ChildItem -LiteralPath $workspace -File -Force -Filter '.codex-vision-*')) {
  if ($file.FullName -ne $PSCommandPath) { Add-Target $file.FullName }
}
$rows = @()
foreach ($target in @($targets | Sort-Object -Unique)) {
  $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
  $inside = $resolved.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)
  if (-not $inside -and $resolved -notin @($ownIni, $ownHarness, $ownSchema)) { throw "Unsafe cleanup target: $resolved" }
  $item = Get-Item -LiteralPath $resolved -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing reparse cleanup target: $resolved" }
  # Refuse to remove any tracked source or retained QA evidence.
  if ($inside) {
    $relative = [IO.Path]::GetRelativePath($workspace, $resolved).Replace('\','/')
    $tracked = @(git -C $workspace ls-files -- $relative)
    if ($tracked.Count -gt 0) { throw "Tracked files under cleanup target: $relative" }
  }
  $files = if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $resolved -Recurse -File -Force -ErrorAction Stop) } else { @($item) }
  $bytes = ($files | Measure-Object -Property Length -Sum).Sum
  Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop
  if (Test-Path -LiteralPath $resolved) { throw "Cleanup did not remove: $resolved" }
  $rows += [pscustomobject]@{ path=$resolved; files=$files.Count; logicalBytes=[long]$bytes; removed=$true }
  Write-Output "Removed $resolved"
}
$receipt = [ordered]@{
  date='2026-10-20'; scope='Primary checkout generated native outputs and this task temporary artifacts only'
  pathsRemoved=$rows.Count; filesRemoved=($rows | Measure-Object files -Sum).Sum
  logicalBytesRemoved=($rows | Measure-Object logicalBytes -Sum).Sum
  note='Logical file sizes, not a measured free-volume delta. Source, compact QA evidence, global SDK/Gradle caches and other worktrees preserved.'
  targets=$rows
}
$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspace 'docs\qa\vision-conversational\cleanup-receipt.json')
