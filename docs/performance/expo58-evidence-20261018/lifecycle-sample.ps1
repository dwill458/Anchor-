$ErrorActionPreference = 'Stop'
$adb = 'C:\Users\dwill\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$device = 'R5CX12KBNGR'
$package = 'com.anchorintentions.sqlcipherpreview20261015'
$out = $PSScriptRoot
$results = @()
for ($cycle = 1; $cycle -le 20; $cycle++) {
  $before = & $adb -s $device shell dumpsys meminfo $package
  & $adb -s $device shell input keyevent 3 | Out-Null
  Start-Sleep -Milliseconds 500
  $background = & $adb -s $device shell dumpsys meminfo $package
  $launch = & $adb -s $device shell am start -W -n "$package/com.anchorintentions.app.MainActivity"
  Start-Sleep -Milliseconds 500
  $after = & $adb -s $device shell dumpsys meminfo $package
  $before | Set-Content "$out\cycle-$cycle-before.txt"
  $background | Set-Content "$out\cycle-$cycle-background.txt"
  $after | Set-Content "$out\cycle-$cycle-after.txt"
  $launch | Set-Content "$out\cycle-$cycle-launch.txt"
  function Pss($lines) { $match = [regex]::Match(($lines -join "`n"), 'TOTAL PSS:\s+(\d+)'); if ($match.Success) { [int]$match.Groups[1].Value } else { $null } }
  $results += [pscustomobject]@{ cycle=$cycle; utc=[DateTime]::UtcNow.ToString('o'); beforePssKb=(Pss $before); backgroundPssKb=(Pss $background); afterPssKb=(Pss $after); launchState=(($launch | Select-String 'LaunchState:').ToString().Trim()); activityTotalMs=(($launch | Select-String '^TotalTime:').ToString().Trim()) }
  $results | ConvertTo-Json | Set-Content "$out\lifecycle-samples.json"
  Write-Output "Lifecycle cycle $cycle/20 recorded"
}
