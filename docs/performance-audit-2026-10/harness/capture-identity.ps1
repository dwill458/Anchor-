function ConvertFrom-ExactAndroidPidOutput {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Output)

  $candidate = $Output.Trim()
  if ($candidate -cnotmatch '^[1-9][0-9]*$') {
    throw 'Expected exactly one positive numeric Android process ID.'
  }
  return [long]$candidate
}

function Test-ExactAndroidPackageCmdline {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Cmdline,
    [Parameter(Mandatory = $true)][ValidateSet('com.anchorintentions.perflab20261012')][string]$ExpectedPackage
  )

  $normalized = $Cmdline.Replace([string][char]0, '')
  if ($normalized -cne $ExpectedPackage) {
    throw 'Android process cmdline does not exactly match the isolated lab package.'
  }
  return $true
}

function ConvertFrom-AndroidProcStatStartTime {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Output)

  $closeParen = $Output.LastIndexOf(')')
  if ($closeParen -lt 0 -or $closeParen -ge ($Output.Length - 1)) {
    throw 'Android process stat did not contain a complete command field.'
  }
  $fields = $Output.Substring($closeParen + 1).Trim() -split '\s+'
  if ($fields.Count -le 19 -or $fields[19] -cnotmatch '^[1-9][0-9]*$') {
    throw 'Android process stat did not contain a valid numeric start time.'
  }
  return [long]$fields[19]
}

function New-AndroidIdentityBeginRecord {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('com.anchorintentions.perflab20261012')][string]$Package,
    [Parameter(Mandatory = $true)][ValidateRange(1, [long]::MaxValue)][long]$ProcessId,
    [Parameter(Mandatory = $true)][ValidateRange(1, [long]::MaxValue)][long]$ProcessStartTimeTicks
  )

  return [ordered]@{
    schema = 1
    phase = 'begin'
    package = $Package
    pid = $ProcessId
    processStartTimeTicks = $ProcessStartTimeTicks
    hostCheckTimeUtc = [DateTimeOffset]::UtcNow.ToString('o')
    procCmdlineExact = $true
  }
}

function New-AndroidIdentityEndRecord {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('com.anchorintentions.perflab20261012')][string]$Package,
    [Parameter(Mandatory = $true)][ValidateRange(1, [long]::MaxValue)][long]$BeginPid,
    [Parameter(Mandatory = $true)][ValidateRange(1, [long]::MaxValue)][long]$EndPid,
    [Parameter(Mandatory = $true)][ValidateRange(1, [long]::MaxValue)][long]$BeginStartTimeTicks,
    [Parameter(Mandatory = $true)][ValidateRange(1, [long]::MaxValue)][long]$EndStartTimeTicks
  )

  return [ordered]@{
    schema = 1
    phase = 'end'
    package = $Package
    beginPid = $BeginPid
    pid = $EndPid
    beginProcessStartTimeTicks = $BeginStartTimeTicks
    processStartTimeTicks = $EndStartTimeTicks
    stablePid = ($BeginPid -eq $EndPid -and $BeginStartTimeTicks -eq $EndStartTimeTicks)
    hostCheckTimeUtc = [DateTimeOffset]::UtcNow.ToString('o')
    procCmdlineExact = $true
  }
}

function Write-NewJsonIdentityRecord {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Record
  )

  $json = ConvertTo-Json -InputObject $Record -Depth 4
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json + "`n")
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }
}
