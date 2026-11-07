# Black Horse Beamish - installs the carvery check printer on this till. No administrator needed.
# Run it by double-clicking install.cmd. It asks which printer this till prints to and which checks it should print (bar, kitchen, pass),
# prints a test check, and sets itself to start whenever this user signs in.
# For testing: -Unattended -Mode raw|gdi|com -Printer "name" -Port COM1 -Checks bar,kitchen -Dir <folder> -NoStartup

param([switch]$Unattended, [string]$Role = "main", [string]$Mode = "raw", [string]$Printer = "", [string]$Port = "", [string[]]$Checks = @(), [string]$Dir = "", [switch]$NoStartup)

$ErrorActionPreference = "Stop"
$Checks = @($Checks | ForEach-Object { "$_" -split "," } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Dir) { $Dir = Join-Path $env:LOCALAPPDATA "BHB Carvery Printer" }
$startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$vbs = Join-Path $startup "BHB Carvery Printer.vbs"
Add-Type -AssemblyName System.Drawing

function Say($m, $c = "White") { Write-Host $m -ForegroundColor $c }
function Ask($q) { if ($Unattended) { return "" }; return (Read-Host $q).Trim() }
function Stop-Old {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*carvery-till.ps1*" -and $_.ProcessId -ne $PID } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }
}
$script:StatusCheck = $false
function Write-Config($mode, $printer, $port, $checks) {
  $o = [ordered]@{ role = $Role; backupDelaySeconds = 45; statusCheck = $script:StatusCheck; mode = $mode; printer = $printer; port = $port; baud = 9600; checks = @($checks) }
  Set-Content -Path (Join-Path $Dir "config.json") -Value ($o | ConvertTo-Json) -Encoding ASCII
}
function Test-Print {
  $p = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Dir 'carvery-till.ps1')`" -Test" -Wait -PassThru -WindowStyle Hidden
  return $p.ExitCode
}

Say ""
Say "Black Horse Beamish - carvery check printer" "Cyan"
Say "This sets up THIS till to print carvery checks. It does not need an administrator." "Gray"
Say ""

# ---- which printer
$all = @([Drawing.Printing.PrinterSettings]::InstalledPrinters)
$def = (New-Object Drawing.Printing.PrinterSettings).PrinterName
$ports = @([IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
if (-not $Unattended) {
  Say "Printers on this till:" "Yellow"
  for ($i = 0; $i -lt $all.Count; $i++) { Say ("  {0}.  {1}{2}" -f ($i + 1), $all[$i], $(if ($all[$i] -eq $def) { "   (the till's usual printer)" } else { "" })) }
  Say ""
  Say "Pick the receipt printer next to this till. The Partner RP-700 may show as Partner, RP-700, POS or Receipt." "Gray"
  Say "If it is NOT in the list (many tills print to it through a serial COM port instead), type C." "Gray"
  do {
    $n = Ask "Type the number of the printer, or C"
    $useCom = ($n -match '^[Cc]$')
    $ok = $useCom -or (($n -match '^\d+$') -and [int]$n -ge 1 -and [int]$n -le $all.Count)
    if (-not $ok) { Say "Please type one of the numbers above, or C." "Red" }
  } until ($ok)
  if ($useCom) { $Mode = "com" } else { $Printer = $all[[int]$n - 1] }
}
if (-not $Printer -and $Mode -ne "com") { throw "No printer chosen." }

# ---- which checks
$names = @{ "1" = "bar"; "2" = "kitchen"; "3" = "pass"; "4" = "guest"; "5" = "botanicals" }
if (-not $Unattended) {
  Say ""
  Say "Which should this till print?" "Yellow"
  Say "  1.  Bar check          (carvery drinks)"
  Say "  2.  Kitchen check      (carvery food)"
  Say "  3.  Pass check         (carvery food)"
  Say "  4.  Guest copy         (carvery: the full VAT receipt for the customer, with prices)"
  Say "  5.  Botanicals receipts (the Black Horse Botanicals shop: choose ONLY this on the Botanicals till)"
  Say "Type the numbers, with commas between them. For example 1 for a bar till, 2,3 for a till that prints both the kitchen and pass checks, 5 for Botanicals." "Gray"
  do {
    $t = Ask "Checks for this till"
    $Checks = @($t -split '[,\s]+' | Where-Object { $names.ContainsKey($_) } | ForEach-Object { $names[$_] } | Select-Object -Unique)
    if (-not $Checks.Count) { Say "Please type 1, 2 and/or 3." "Red" }
  } until ($Checks.Count)
}
if (-not $Checks.Count) { throw "No checks chosen." }

# ---- main or backup
if (-not $Unattended) {
  Say ""
  Say "Is this printer the MAIN one for these, or the BACKUP?" "Yellow"
  Say "  M.  Main    prints them as soon as they arrive"
  Say "  B.  Backup  prints a check ONLY if the main printer has not printed it within 45 seconds"
  Say "              (no power, lost connection, paper being changed, cover open, till switched off)." "Gray"
  do { $r = Ask "Type M or B"; $okr = ($r -match '^[MmBb]$'); if (-not $okr) { Say "Please type M or B." "Red" } } until ($okr)
  $Role = if ($r -match '^[Bb]$') { "backup" } else { "main" }
}
$Role = $Role.ToLower()

# ---- copy the program in
Stop-Old
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
Copy-Item (Join-Path $src "carvery-till.ps1") $Dir -Force
Copy-Item (Join-Path $src "uninstall.cmd") $Dir -Force -ErrorAction SilentlyContinue
Write-Config $Mode $Printer $Port $Checks
Say ""
Say "Installed in $Dir" "Green"

# ---- can it reach the order system?
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $h = @{ apikey = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU" }
  Invoke-RestMethod -Uri "https://safcrtrfdzsnftghibot.supabase.co/rest/v1/print_jobs?limit=1&select=id" -Headers $h -TimeoutSec 20 | Out-Null
  Say "Connected to the order system." "Green"
} catch { Say "Could not reach the order system from this till: $($_.Exception.Message)" "Red"; Say "Check the till is online, then run this installer again." "Red" }

# ---- test print, trying each way of printing until one comes out
function Try-Com {
  # The printer is on a serial (COM) port. Try each port on this till in turn until a check comes out.
  if (-not $ports.Count) { Say "This till shows no COM ports, so the printer cannot be reached that way." "Red"; return $false }
  Say ""
  Say "COM ports on this till: $($ports -join ', ')" "Yellow"
  foreach ($pc in $ports) {
    Write-Config "com" "" $pc $Checks
    [void](Ask "Press Enter to print a test on $pc")
    $code = Test-Print
    $a = Ask "Did a TEST check or receipt come out of the receipt printer? (Y or N)"
    if ($a -match '^[Yy]') { $script:Mode = "com"; $script:Port = $pc; $script:Printer = ""; return $true }
    if ($code -ne 0) { Say "($pc could not be opened. If the till's own software is using it, that is why.)" "Gray" }
  }
  return $false
}
if (-not $Unattended) {
  Say ""
  Say "Now a TEST will print. Look at the receipt printer." "Yellow"
  $worked = $false
  if ($Mode -eq "com") { $worked = Try-Com }
  else {
    foreach ($try in @("raw", "gdi")) {
      Write-Config $try $Printer $Port $Checks
      [void](Ask "Press Enter to print a test ($try method)")
      $code = Test-Print
      $a = Ask "Did a TEST check or receipt come out, with clear writing? (Y or N)"
      if ($a -match '^[Yy]') { $Mode = $try; $worked = $true; break }
    }
    if (-not $worked) { Say ""; Say "That printer may not be set up in Windows. Trying the serial (COM) ports instead." "Yellow"; $worked = Try-Com }
  }
  if (-not $worked) {
    Say ""
    Say "The test check did not print by any method. The program is installed but will not be able to print yet." "Red"
    Say "Tell Paul which printer you chose and what happened (and send the file $Dir\logs\carvery.log)." "Red"
  } else {
    if ($Mode -eq "com") {
      # Can the printer tell us how it is? If so, it is checked before every print: switched off, cover open and paper out are all caught, and the backup takes over.
      Write-Config $Mode $Printer $Port $Checks
      Say ""
      $sp = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Dir 'carvery-till.ps1')`" -Status" -Wait -PassThru -WindowStyle Hidden
      if ($sp.ExitCode -eq 0) { $script:StatusCheck = $true; Say "The printer reports its own status, so a switched-off printer, open cover or empty paper roll will be noticed." "Green" }
      else { Say "This printer does not report its status. A switched-off printer will NOT be noticed on its own (a backup only helps if the whole till is off or offline)." "Yellow" }
    }
    Write-Config $Mode $Printer $Port $Checks
  }
}

# ---- start it now, and every time this user signs in
if (-not $NoStartup) {
  New-Item -ItemType Directory -Force -Path $startup | Out-Null
  $line = 'CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""' + (Join-Path $Dir "carvery-till.ps1") + '""", 0, False'
  Set-Content -Path $vbs -Value $line -Encoding ASCII
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`""
  Say ""
  Say "Done. The carvery printer is running (hidden) and will start itself whenever this user signs in." "Green"
  Say "It is the $($Role.ToUpper()) printer for: $($Checks -join ', '). Nothing else to do on this till." "Green"
}
if (-not $Unattended) { Say ""; [void](Read-Host "Press Enter to close this window") }
