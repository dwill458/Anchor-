# ============================================================================
# Anchor App - ADB Reverse Port Forward Keep-Alive Daemon
# ============================================================================
# This script monitors your USB-connected Android device and automatically 
# re-applies ADB reverse port forwarding (ports 8081 and 8000) if it disconnects.
#
# USAGE:
#   .\scripts\adb-keep-alive.ps1
# ============================================================================

$adbPath = "c:\Users\dwill\AppData\Local\Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $adbPath)) {
    Write-Error "ADB executable not found at: $adbPath"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       ADB REVERSE PORT FORWARD KEEP-ALIVE DAEMON         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Monitoring devices every 3 seconds..." -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

$lastDeviceCount = -1

while ($true) {
    try {
        # Get list of devices (excluding header line and empty lines)
        $devicesOutput = & $adbPath devices
        $deviceLines = $devicesOutput | Where-Object { $_ -match "\bdevice\b" }
        $deviceCount = ($deviceLines | Measure-Object).Count

        if ($deviceCount -gt 0) {
            if ($deviceCount -ne $lastDeviceCount) {
                Write-Host "[+] Active device detected!" -ForegroundColor Green
                foreach ($line in $deviceLines) {
                    Write-Host "    Device: $($line.Split("`t")[0])" -ForegroundColor Gray
                }
            }

            # Check existing reverse forwards
            $reverseList = & $adbPath reverse --list 2>$null
            $has8081 = $reverseList -match "tcp:8081"
            $has8000 = $reverseList -match "tcp:8000"

            if (-not $has8081 -or -not $has8000) {
                Write-Host "[!] Port forwards disconnected or missing. Re-applying..." -ForegroundColor Yellow
                if (-not $has8081) {
                    $null = & $adbPath reverse tcp:8081 tcp:8081 2>$null
                }
                if (-not $has8000) {
                    $null = & $adbPath reverse tcp:8000 tcp:8000 2>$null
                }
                Write-Host "[OK] Forwarded tcp:8081 (Metro) and tcp:8000 (Backend)" -ForegroundColor Green
                Write-Host "--------------------------------------------------------" -ForegroundColor Gray
            } elseif ($deviceCount -ne $lastDeviceCount) {
                Write-Host "[OK] Port forwarding rules are already active." -ForegroundColor Green
                Write-Host "--------------------------------------------------------" -ForegroundColor Gray
            }
        } else {
            if ($lastDeviceCount -ne 0) {
                Write-Host "[!] No connected Android devices detected via ADB. Waiting for connection..." -ForegroundColor Yellow
                Write-Host "    Make sure USB Debugging is enabled on your phone." -ForegroundColor Gray
                Write-Host "--------------------------------------------------------" -ForegroundColor Gray
            }
        }

        $lastDeviceCount = $deviceCount
    } catch {
        Write-Host "[-] An error occurred: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 3
}
