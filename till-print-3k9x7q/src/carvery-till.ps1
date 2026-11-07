# Black Horse Beamish - carvery checks on a till's printer.
# Runs hidden on a till (no admin needed). It asks the order system, every few seconds on a carvery Sunday, whether there is a check for this till to print,
# and prints it on the printer chosen at install time.
#
# config.json (written by install.ps1):
#   { "mode": "raw" | "gdi" | "com", "printer": "<Windows printer name>", "port": "COM1", "baud": 9600, "checks": ["bar"] }
#   mode raw  sends receipt-printer (ESC/POS) commands straight to the Windows printer. Crisp, quick, cuts the paper. The first thing to try.
#   mode gdi  draws the check as a picture and prints it through the printer's Windows driver. Works with a normal driver when raw does not.
#   mode com  sends the same commands down a serial (COM) port, for a printer that has no Windows printer set up.
#   checks    any of bar (drinks only), kitchen (food only), pass (food only)
# Switches:  -Test  prints one test check for each of this till's checks and exits     -Once  one look at the queue, then exit
# A printer of "PREVIEW:<folder>" writes each check into that folder instead of printing (a .png for gdi, a .bin for raw/com) - for testing.

param([switch]$Test, [switch]$Once)

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Add-Type -AssemblyName System.Drawing

$SUPABASE = "https://safcrtrfdzsnftghibot.supabase.co"
$KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU"

$logDir = Join-Path $here "logs"; New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "carvery.log"
if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 2MB)) { Move-Item $logFile "$logFile.old" -Force }
function Log($m) { try { Add-Content -Path $logFile -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) } catch {}; if ($Test -or $Once -or [Environment]::UserInteractive) { Write-Host $m } }

$cfg = Get-Content (Join-Path $here "config.json") -Raw | ConvertFrom-Json
$mode = if ($cfg.mode) { "$($cfg.mode)".ToLower() } else { "raw" }
$checks = @($cfg.checks | ForEach-Object { "$_".ToLower() } | Where-Object { $_ -in @("bar", "kitchen", "pass") })
if (-not $checks.Count) { Log "config.json lists no checks (bar, kitchen, pass): nothing to do"; exit 1 }

# Only one copy per till.
if (-not $Test -and -not $Once) {
  $mutex = New-Object System.Threading.Mutex($false, "Local\BHB-Carvery-Printer")
  if (-not $mutex.WaitOne(0)) { Log "already running, exiting"; exit 0 }
}

function Rest($path, $method = "GET", $body = $null, $prefer = $null) {
  $h = @{ apikey = $KEY; Authorization = "Bearer $KEY" }
  if ($prefer) { $h["Prefer"] = $prefer }
  $req = @{ Uri = "$SUPABASE/rest/v1/$path"; Method = $method; Headers = $h; TimeoutSec = 20; ContentType = "application/json; charset=utf-8" }
  if ($body -ne $null) { $req["Body"] = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8 -Compress)) }
  return Invoke-RestMethod @req
}
$copyFilter = "payload-%3E%3Ecopy"      # payload->>copy

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class BhbRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)] static extern bool OpenPrinter(string name, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)] static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)] static extern bool WritePrinter(IntPtr h, IntPtr bytes, int count, out int written);
  public static string Send(string printer, string docName, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "could not open the printer (error " + Marshal.GetLastWin32Error() + ")";
    try {
      DOCINFOA di = new DOCINFOA(); di.pDocName = docName; di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) return "the printer would not start the job (error " + Marshal.GetLastWin32Error() + ")";
      try {
        StartPagePrinter(h);
        IntPtr p = Marshal.AllocCoTaskMem(data.Length);
        try { Marshal.Copy(data, 0, p, data.Length); int w; if (!WritePrinter(h, p, data.Length, out w) || w != data.Length) return "could not send the check to the printer (error " + Marshal.GetLastWin32Error() + ")"; }
        finally { Marshal.FreeCoTaskMem(p); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
    return null;
  }
}
"@

# ------------------------------------------------------------ the check as receipt-printer commands (modes raw and com)
$LINE = 32      # characters per line; the same width the pub's other receipt printers use
function Clean([string]$s) {
  if ($s -eq $null) { return "" }
  $sb = New-Object Text.StringBuilder
  foreach ($c in $s.Normalize([Text.NormalizationForm]::FormD).ToCharArray()) {      # accents are dropped (e-acute becomes e); anything else the printer cannot print becomes ?
    $i = [int]$c
    if ($i -eq 10 -or ($i -ge 32 -and $i -le 126)) { [void]$sb.Append($c) }
    elseif ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append("?") }
  }
  return $sb.ToString()
}
function Wrap([string]$text, [int]$width) {
  $lines = @(); $cur = ""
  foreach ($w in (Clean $text) -split " ") {
    $next = if ($cur) { "$cur $w" } else { $w }
    if ($next.Length -gt $width -and $cur) { $lines += $cur; $cur = $w } else { $cur = $next }
  }
  if ($cur) { $lines += $cur }
  return $lines
}
function Head-Of($copy) { switch ($copy) { "bar" { "BAR" } "kitchen" { "KITCHEN" } "pass" { "PASS" } default { "$copy".ToUpper() } } }

function Build-EscPos($job) {
  $p = $job.payload; $copy = "$($p.copy)".ToLower()
  $ms = New-Object IO.MemoryStream
  $raw = { param([byte[]]$b) $ms.Write($b, 0, $b.Length) }
  $text = { param([string]$s) $b = [Text.Encoding]::ASCII.GetBytes((Clean $s)); $ms.Write($b, 0, $b.Length) }
  $size = { param([byte]$n) & $raw ([byte[]](0x1d, 0x21, $n)) }
  $bold = { param([bool]$on) & $raw ([byte[]](0x1b, 0x45, [byte]$(if ($on) { 1 } else { 0 }))) }
  $align = { param([byte]$n) & $raw ([byte[]](0x1b, 0x61, $n)) }
  $rule = { & $text (("-" * $LINE) + "`n") }
  $banner = { & $bold $true; & $size 0x11; & $text "*** TEST ***`n"; & $size 0x00; & $text "DO NOT MAKE - TEST ORDER`n"; & $bold $false; & $rule }
  $big = { param($lines) & $size 0x01; & $bold $true; foreach ($l in $lines) { & $text "$l`n" }; & $size 0x00; & $bold $false }

  & $raw ([byte[]](0x1b, 0x40)); & $align 1
  $isTest = ($p.is_test -eq $true)
  if ($isTest) { & $banner }
  & $bold $true; & $size 0x11; & $text ((Head-Of $copy) + "`n"); & $text "CARVERY`n"; & $size 0x22; & $text ("Table " + $p.room_number + "`n"); & $size 0x00; & $bold $false
  & $rule; & $align 0
  $when = ""; try { $when = ([datetime]::Parse($job.created_at)).ToLocalTime().ToString("dd/MM/yyyy HH:mm") } catch {}
  & $text ("Order No. " + $p.order_no + "   " + $when + "`n")
  if ($p.guest_name) { & $big (Wrap ("" + $p.guest_name) $LINE) }
  & $rule
  & $bold $true; & $text ($(if ($copy -eq "bar") { "DRINKS" } else { "FOOD" }) + "`n"); & $bold $false
  $items = @(); foreach ($l in @($p.lines)) { $items += (Wrap ("" + $l.qty + " x " + $l.name) $LINE) }
  if (-not $items.Count) { $items = @("(no lines)") }
  & $big $items
  if ($p.notes) { & $rule; & $big (Wrap ("Note: " + $p.notes) $LINE) }
  if ($p.allergy_notes) { & $rule; & $bold $true; & $text "ALLERGY / DIETARY`n"; & $bold $false; & $big (Wrap ("" + $p.allergy_notes) $LINE) }
  if ($isTest) { & $align 1; & $rule; & $banner }
  & $raw ([byte[]](0x0a, 0x0a, 0x0a, 0x0a)); & $raw ([byte[]](0x1d, 0x56, 0x42, 0x00))      # feed + partial cut
  return $ms.ToArray()
}

# ------------------------------------------------------------ the check as a picture (mode gdi)
$script:y = 0.0
function Put($g, [float]$w, [string]$text, [float]$size, [bool]$bold, [bool]$center) {
  if ($text -eq $null -or $text -eq "") { return }
  $style = if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
  $font = New-Object Drawing.Font("Arial", $size, $style, [Drawing.GraphicsUnit]::Point)
  $fmt = New-Object Drawing.StringFormat
  if ($center) { $fmt.Alignment = [Drawing.StringAlignment]::Center }
  $h = $g.MeasureString($text, $font, [int]$w, $fmt).Height
  $g.DrawString($text, $font, [Drawing.Brushes]::Black, (New-Object Drawing.RectangleF(0, $script:y, $w, $h)), $fmt)
  $script:y += $h + 1
  $font.Dispose()
}
function Rule($g, [float]$w) { $script:y += 3; $g.DrawLine((New-Object Drawing.Pen([Drawing.Color]::Black, 2)), 0, $script:y, $w, $script:y); $script:y += 6 }

function Draw-Check($g, [float]$w, $job) {
  $p = $job.payload
  $copy = "$($p.copy)".ToLower()
  $script:y = 4.0
  $isTest = ($p.is_test -eq $true)
  if ($isTest) { Put $g $w "*** TEST ***" 18 $true $true; Put $g $w "DO NOT MAKE - TEST ORDER" 10 $true $true; Rule $g $w }
  Put $g $w (Head-Of $copy) 28 $true $true
  Put $g $w "CARVERY" 20 $true $true
  Put $g $w ("Table " + $p.room_number) 30 $true $true
  Rule $g $w
  $when = ""; try { $when = ([datetime]::Parse($job.created_at)).ToLocalTime().ToString("dd/MM/yyyy HH:mm") } catch {}
  Put $g $w ("Order No. " + $p.order_no + "   " + $when) 9 $false $false
  if ($p.guest_name) { Put $g $w ("" + $p.guest_name) 14 $true $false }
  Rule $g $w
  Put $g $w $(if ($copy -eq "bar") { "DRINKS" } else { "FOOD" }) 10 $true $false
  foreach ($l in @($p.lines)) { Put $g $w ("" + $l.qty + " x " + $l.name) 16 $true $false }
  if (-not @($p.lines).Count) { Put $g $w "(no lines)" 12 $false $false }
  if ($p.notes) { Rule $g $w; Put $g $w ("Note: " + $p.notes) 14 $true $false }
  if ($p.allergy_notes) { Rule $g $w; Put $g $w "ALLERGY / DIETARY" 10 $true $false; Put $g $w ("" + $p.allergy_notes) 14 $true $false }
  if ($isTest) { Rule $g $w; Put $g $w "*** TEST ***" 18 $true $true; Put $g $w "DO NOT MAKE - TEST ORDER" 10 $true $true }
  $script:y += 40      # blank paper so the cut falls below the last line
}

# ------------------------------------------------------------ printing
function Printer-Offline($name) {
  try {
    $q = "Name='" + ($name -replace "\\", "\\\\" -replace "'", "\'") + "'"
    $pr = Get-WmiObject -Class Win32_Printer -Filter $q -ErrorAction Stop
    if ($pr -and ($pr.WorkOffline -or $pr.PrinterStatus -eq 7)) { return $true }
  } catch {}
  return $false
}

function Print-Job($job) {
  $name = "$($cfg.printer)"
  $tag = "$($job.payload.copy)-$($job.payload.order_no)"
  if ($name -like "PREVIEW:*") {
    $dir = $name.Substring(8); New-Item -ItemType Directory -Force -Path $dir | Out-Null
    if ($mode -eq "gdi") {
      $bmp = New-Object Drawing.Bitmap(290, 2400); $bmp.SetResolution(100, 100)
      $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::White); $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAlias
      Draw-Check $g 290 $job
      $h = [int][Math]::Ceiling($script:y); $g.Dispose()
      $crop = $bmp.Clone((New-Object Drawing.Rectangle(0, 0, 290, $h)), $bmp.PixelFormat)
      $crop.Save((Join-Path $dir "check-$tag.png"), [Drawing.Imaging.ImageFormat]::Png)
      $crop.Dispose(); $bmp.Dispose()
    } else { [IO.File]::WriteAllBytes((Join-Path $dir "check-$tag.bin"), (Build-EscPos $job)) }
    return
  }
  if ($mode -eq "com") {
    $baud = if ($cfg.baud) { [int]$cfg.baud } else { 9600 }
    $sp = New-Object IO.Ports.SerialPort("$($cfg.port)", $baud, [IO.Ports.Parity]::None, 8, [IO.Ports.StopBits]::One)
    $sp.WriteTimeout = 8000; $sp.DtrEnable = $true; $sp.RtsEnable = $true
    try {
      $sp.Open(); $b = Build-EscPos $job; $sp.Write($b, 0, $b.Length); $sp.BaseStream.Flush()
      Start-Sleep -Milliseconds ([int]($b.Length * 10 / $baud * 1000) + 1500)      # let it all go down the cable before the port is closed
    } finally { if ($sp.IsOpen) { $sp.Close() }; $sp.Dispose() }
    return
  }
  if (Printer-Offline $name) { throw "the printer '$name' is switched off or unplugged" }
  if ($mode -eq "raw") {
    $err = [BhbRawPrint]::Send($name, "Carvery $tag", (Build-EscPos $job))
    if ($err) { throw $err }
    return
  }
  $doc = New-Object Drawing.Printing.PrintDocument
  $doc.PrinterSettings.PrinterName = $name
  if (-not $doc.PrinterSettings.IsValid) { throw "no printer called '$name' on this till" }
  $doc.DocumentName = "Carvery $tag"
  $doc.DefaultPageSettings.Margins = New-Object Drawing.Printing.Margins(8, 8, 4, 4)
  $script:jobNow = $job
  $doc.add_PrintPage({ param($s, $e) Draw-Check $e.Graphics ([float]$e.MarginBounds.Width) $script:jobNow; $e.HasMorePages = $false })
  $doc.Print()
  $doc.Dispose()
}

# ------------------------------------------------------------ the queue
function Is-ServiceTime { $n = Get-Date; return ($n.DayOfWeek -eq [DayOfWeek]::Sunday -and $n.Hour -ge 11 -and $n.Hour -lt 17) }

function Work-Queue {
  foreach ($copy in $checks) {
    $jobs = @(Rest "print_jobs?destination=eq.carvery&$copyFilter=eq.$copy&status=eq.pending&order=created_at.asc&limit=50&select=*")
    foreach ($job in $jobs) {
      $label = "$copy check, order $($job.payload.order_no), table $($job.payload.room_number)"
      try {
        $claimed = @(Rest "print_jobs?id=eq.$($job.id)&status=eq.pending" "PATCH" @{ status = "printing" } "return=representation")
        if (-not $claimed.Count) { continue }      # another till or a retry already has it
        Print-Job $job
        Rest "print_jobs?id=eq.$($job.id)" "PATCH" @{ status = "printed"; printed_at = (Get-Date).ToUniversalTime().ToString("o") } | Out-Null
        Log "printed $label"
      } catch {
        Log "FAILED to print $label : $($_.Exception.Message)"
        try { Rest "print_jobs?id=eq.$($job.id)&status=eq.printing" "PATCH" @{ status = "pending" } | Out-Null } catch {}
        return      # the printer is probably off or out of paper: stop here and try again next time, keeping the order
      }
    }
  }
}

if ($Test) {
  $bad = 0
  foreach ($copy in $checks) {
    $lines = if ($copy -eq "bar") { @(@{ qty = 2; name = "Pint of Lager" }, @{ qty = 1; name = "Large Glass of Merlot" }) } else { @(@{ qty = 2; name = "Soup of the Day" }, @{ qty = 1; name = "Sticky Toffee Pudding" }) }
    $job = [pscustomobject]@{ created_at = (Get-Date).ToUniversalTime().ToString("o"); payload = [pscustomobject]@{ copy = $copy; order_no = 999; room_number = "12"; guest_name = "Test Guest"; is_test = $true; notes = "Test check from the installer"; allergy_notes = ""; lines = $lines } }
    try { Print-Job $job; Log "test $copy check sent ($mode, '$($cfg.printer)$($cfg.port)')" } catch { Log "test $copy check FAILED: $($_.Exception.Message)"; $bad++ }
  }
  exit $bad
}

Log "carvery printer started: checks $($checks -join ', '), mode $mode, '$($cfg.printer)$($cfg.port)'"
foreach ($copy in $checks) { try { Rest "print_jobs?destination=eq.carvery&$copyFilter=eq.$copy&status=eq.printing" "PATCH" @{ status = "pending" } | Out-Null } catch { Log "start-up release failed: $($_.Exception.Message)" } }
while ($true) {
  try { Work-Queue } catch { Log "check failed: $($_.Exception.Message)" }
  if ($Once) { break }
  Start-Sleep -Seconds $(if (Is-ServiceTime) { 5 } else { 60 })      # quiet outside a carvery Sunday, so it costs the order system next to nothing
}
