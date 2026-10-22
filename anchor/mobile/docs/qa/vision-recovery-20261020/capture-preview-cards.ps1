$ErrorActionPreference = 'Stop'
$package = 'com.anchorintentions.sqlcipherpreview20261015'
$surfaces = @('home-1-notes', 'details-1-notes', 'home-2', 'details-2', 'home-8-notes', 'details-8-notes', 'home-0-notes', 'details-0-notes', 'home-3-portrait', 'details-3-mixed')
foreach ($surface in $surfaces) {
  & adb shell am start -a android.intent.action.VIEW -d "anchor-sqlcipher-qa://vision-visual-qa?surface=$surface" $package | Out-Null
  Start-Sleep -Seconds 3
  & adb shell uiautomator dump /sdcard/vision-ui.xml | Out-Null
  $xmlPath = Join-Path $PSScriptRoot "card-$surface.xml"
  & adb pull /sdcard/vision-ui.xml $xmlPath | Out-Null
  $ui = [xml](Get-Content -LiteralPath $xmlPath -Raw)
  if (!$ui.SelectSingleNode("//node[@text='QA fixture · $surface']")) { throw "Surface not ready: $surface" }
  $id = if ($surface.StartsWith('home')) { 'v2-home-vision' } else { 'v2-details-vision' }
  $card = $ui.SelectSingleNode("//node[@resource-id='$id']")
  if (!$card) { throw "Production card missing: $surface" }
  $count = [int]$surface.Split('-')[1]
  $prints = $ui.SelectNodes("//node[starts-with(@resource-id,'$id-print-') and starts-with(@content-desc,'Vision photograph ')]")
  if ($prints.Count -ne [Math]::Min(3, $count)) { throw "Unexpected print count for $surface : $($prints.Count)" }
  $footer = $ui.SelectSingleNode("//node[@resource-id='$id-footer']")
  $footerTop = [int]([regex]::Matches($footer.bounds, '\d+')[1].Value)
  foreach ($print in $prints) {
    $bottom = [int]([regex]::Matches($print.bounds, '\d+')[3].Value)
    if ($bottom -gt $footerTop) { throw "Print overlaps footer: $surface" }
  }
  & adb shell screencap -p /sdcard/vision-recovery.png
  & adb pull /sdcard/vision-recovery.png (Join-Path $PSScriptRoot "card-$surface.png") | Out-Null
  Write-Output "Captured $surface ($($prints.Count) prints)"
}
