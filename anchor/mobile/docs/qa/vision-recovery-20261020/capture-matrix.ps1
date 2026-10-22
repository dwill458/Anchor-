$ErrorActionPreference = 'Stop'
$captureRoot = $PSScriptRoot
$package = 'com.anchorintentions.sqlcipherpreview20261015'
& adb shell wm size 628x1280
& adb shell wm density 256
Start-Sleep -Seconds 2
foreach ($surface in @('recovery-1-0', 'recovery-1-1', 'recovery-4-1', 'recovery-8-3', 'recovery-0-3')) {
  & adb shell am start -a android.intent.action.VIEW -d "anchor-sqlcipher-qa://vision-visual-qa?surface=$surface" $package | Out-Null
  Start-Sleep -Seconds 3
  & adb shell screencap -p /sdcard/vision-recovery.png
  & adb pull /sdcard/vision-recovery.png (Join-Path $captureRoot "$surface.png") | Out-Null
  & adb shell uiautomator dump /sdcard/vision-ui.xml | Out-Null
  & adb pull /sdcard/vision-ui.xml (Join-Path $captureRoot "$surface.xml") | Out-Null
  $xml = [xml](Get-Content -LiteralPath (Join-Path $captureRoot "$surface.xml") -Raw)
  $expectedPhotos = [int]$surface.Split('-')[1]
  $actualPhotos = $xml.SelectNodes('//node[starts-with(@content-desc,"Vision image ")]').Count
  if (!$xml.SelectSingleNode('//node[@text="Vision"]') -or $actualPhotos -ne $expectedPhotos) {
    throw "Surface not ready: $surface (expected $expectedPhotos photos, observed $actualPhotos)"
  }
  Write-Output "Captured $surface"
}
