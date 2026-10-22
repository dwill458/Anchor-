$ErrorActionPreference = 'Stop'
$adb = 'C:\Users\dwill\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$qa = 'E:\Projects\Anchor\anchor\mobile\docs\qa\chart-opening-20261008'
$frames = Join-Path $qa 'full-replay-framestats-sweeps.txt'
Set-Content -LiteralPath $frames -Value ''
& $adb logcat -c
& $adb shell dumpsys gfxinfo com.anchorintentions.app reset | Out-Null
Start-Process -FilePath $adb -ArgumentList 'shell screenrecord --time-limit 12 /sdcard/chart-opening-full-replay.mp4' -WindowStyle Hidden
Start-Sleep -Milliseconds 500
& $adb shell input tap 393 686
$until = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $until) {
  & $adb shell dumpsys gfxinfo com.anchorintentions.app framestats | Add-Content -LiteralPath $frames
  Start-Sleep -Milliseconds 750
}
& $adb shell screencap -p /sdcard/chart-opening-full-replay.png
& $adb pull /sdcard/chart-opening-full-replay.png (Join-Path $qa 'full-replay-final.png')
Start-Sleep -Seconds 3
& $adb pull /sdcard/chart-opening-full-replay.mp4 (Join-Path $qa 'full-replay.mp4')
& $adb shell uiautomator dump /sdcard/chart-opening-full-replay.xml
& $adb pull /sdcard/chart-opening-full-replay.xml (Join-Path $qa 'full-replay-hierarchy.xml')
& $adb logcat -d -s ReactNativeJS:V | Set-Content -LiteralPath (Join-Path $qa 'full-replay-logcat.txt')
python (Join-Path $qa 'chart-opening-evidence.py') frames $frames
Get-Item (Join-Path $qa 'full-replay-final.png'), (Join-Path $qa 'full-replay.mp4'), $frames | Select-Object Name, Length
