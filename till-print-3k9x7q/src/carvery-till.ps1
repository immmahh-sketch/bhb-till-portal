# Black Horse Beamish - carvery checks on a till's printer.   (BHB-TILL-PRINT-PROGRAM)
# Runs hidden on a till (no admin needed). It asks the order system, every few seconds on a carvery Sunday, whether there is a check for this till to print,
# and prints it on the printer chosen at install time.
#
# config.json (written by install.ps1):
#   { "mode": "raw" | "gdi" | "com", "printer": "<Windows printer name>", "port": "COM1", "baud": 9600, "checks": ["bar"] }
#   mode raw  sends receipt-printer (ESC/POS) commands straight to the Windows printer. Crisp, quick, cuts the paper. The first thing to try.
#   mode gdi  draws the check as a picture and prints it through the printer's Windows driver. Works with a normal driver when raw does not.
#   mode com  sends the same commands down a serial (COM) port, for a printer that has no Windows printer set up.
#   checks    any of bar (drinks only), kitchen (food only), pass (food only), guest (the full guest copy / VAT receipt of the whole carvery order, with prices),
#             botanicals (the Black Horse Botanicals shop receipts; these are not carvery orders)
#   role      "main" (the default) prints its checks as they arrive. "backup" only prints a check the main printer has not printed within backupDelaySeconds (default 45):
#             nobody has printed it (no power, lost connection, out of paper, cover open, till off). Backup prints say BACKUP PRINT at the top.
#   statusCheck  true: before printing, ask a serial (COM) printer how it is (it must answer: switched off, offline, cover open and paper out are all caught); a printer that is not ready does not take the job.
# Switches:  -Test  prints one test check for each of this till's checks and exits     -Once  one look at the queue, then exit     -Status  asks a COM printer for its status and exits
# A printer of "PREVIEW:<folder>" writes each check into that folder instead of printing (a .png for gdi, a .bin for raw/com) - for testing.

param([switch]$Test, [switch]$Once, [switch]$Status)

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class BhbAwake { [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f); }
"@

$VERSION = "2026-11-08a"
$SUPABASE = "https://safcrtrfdzsnftghibot.supabase.co"
$KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU"

$logDir = Join-Path $here "logs"; New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "carvery.log"
if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 2MB)) { Move-Item $logFile "$logFile.old" -Force }
$script:lastError = ""; $script:lastErrorAt = $null; $script:lastPrintedAt = $null; $script:startedAt = (Get-Date).ToUniversalTime()
function Log($m) { if ("$m" -match "^(FAILED|printer not ready|check failed|update check failed|start-up release failed)") { $script:lastError = "$m"; $script:lastErrorAt = (Get-Date).ToUniversalTime() }; if ("$m" -like "printed *") { $script:lastPrintedAt = (Get-Date).ToUniversalTime() }; try { Add-Content -Path $logFile -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) } catch {}; if ($Test -or $Once -or [Environment]::UserInteractive) { Write-Host $m } }

$cfg = Get-Content (Join-Path $here "config.json") -Raw | ConvertFrom-Json
$mode = if ($cfg.mode) { "$($cfg.mode)".ToLower() } else { "raw" }
$checks = @($cfg.checks | ForEach-Object { "$_".ToLower() } | Where-Object { $_ -in @("bar", "kitchen", "pass", "guest", "botanicals") })
if (-not $checks.Count) { Log "config.json lists no checks (bar, kitchen, pass, guest, botanicals): nothing to do"; exit 1 }
$role = if ($cfg.role) { "$($cfg.role)".ToLower() } else { "main" }
$backupDelay = if ($cfg.backupDelaySeconds) { [int]$cfg.backupDelaySeconds } else { 45 }
$statusCheck = ($cfg.statusCheck -eq $true)

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
# Some versions of Windows PowerShell hand back a whole JSON list as ONE object (an empty list, or a list of two jobs, looked like a single blank job). This always gives the real rows.
function Rows($r) {
  $o = New-Object System.Collections.ArrayList
  foreach ($x in @($r)) {
    if ($x -is [array]) { foreach ($y in $x) { if ($y -ne $null) { [void]$o.Add($y) } } }
    elseif ($x -ne $null) { [void]$o.Add($x) }
  }
  return , @($o.ToArray())
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
    if ($i -eq 35) { continue }      # # prints as a pound sign on this printer, so it is never sent from order text; money is written as {P}
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

# ------------------------------------------------------------ the receipts with prices (the guest copy of a carvery order, and the Botanicals shop receipts)
# Each is described as a list of lines { t = text; b = bold; c = centred; z = 0 normal, 1 bold, 2 double size }, which is then drawn either as printer commands or as a picture.
# Money is written {P}12.50 : on the printer {P} becomes the pound sign.
$VAT_RATE = 0.20      # as on the pub's other guest receipts
$VAT_NO = "GB113205865"
function GbpS([double]$n) { $a = [Math]::Round([Math]::Abs($n), 2).ToString("0.00", [Globalization.CultureInfo]::InvariantCulture); if ($n -lt -0.004) { return "-{P}" + $a } else { return "{P}" + $a } }
function PRows([string]$label, [double]$n, [int]$labW = 32) {
  $a = GbpS $n; $disp = $a.Length - 2
  $ls = @(Wrap $label $labW); if (-not $ls.Count) { $ls = @("") }
  $res = @(); for ($i = 0; $i -lt $ls.Count - 1; $i++) { $res += $ls[$i] }
  $last = $ls[$ls.Count - 1]
  if ($last.Length + 1 + $disp -gt $LINE) { $res += $last; $res += ((" " * ($LINE - $disp)) + $a) } else { $res += ($last + (" " * ($LINE - $last.Length - $disp)) + $a) }
  return $res
}
function RuleL { return @{ t = ("-" * $LINE) } }
function When-Of($job, $iso) { try { return ([datetime]::Parse($(if ($iso) { $iso } else { $job.created_at }))).ToLocalTime().ToString("dd/MM/yyyy HH:mm") } catch { return "" } }
function Order-Total($p) { if ($p.subtotal -ne $null -and [double]$p.subtotal -gt 0) { return [double]$p.subtotal }; $t = 0.0; foreach ($l in @($p.lines)) { $t += [double]$l.unit_price * [double]$l.qty }; return $t }

function Backup-Lines($p) { if ($p.backup -eq $true) { return @(@{ t = "*** BACKUP PRINT ***"; b = $true; c = $true; z = 1 }, @{ t = "main printer did not print this"; c = $true }, (RuleL)) } else { return @() } }
# Food checks (kitchen, pass): starters first, then anything else, then desserts, with a line between the groups so a starter and a dessert ordered together are easy to tell apart.
# Each result has .l (the line) and .gap ($true when a dashed line goes above it).
function Check-Lines($lines) {
  $rows = @(); $i = 0
  foreach ($l in @($lines)) { $s = "$($l.station)"; $r = 1; if ($s -eq "starters") { $r = 0 } elseif ($s -eq "desserts") { $r = 2 }; $rows += [pscustomobject]@{ r = $r; i = $i; l = $l; gap = $false }; $i++ }
  $rows = @($rows | Sort-Object r, i)
  for ($k = 1; $k -lt $rows.Count; $k++) { if ($rows[$k].r -ne $rows[$k - 1].r) { $rows[$k].gap = $true } }
  return $rows
}
function Guest-Lines($job) {
  $p = $job.payload; $o = @(Backup-Lines $p)
  if ($p.is_test -eq $true) { $o += @{ t = "*** TEST ***"; b = $true; c = $true; z = 2 }; $o += @{ t = "DO NOT MAKE - TEST ORDER"; b = $true; c = $true }; $o += (RuleL) }
  $o += @{ t = "Black Horse Beamish"; b = $true; c = $true; z = 1 }; $o += @{ t = "GUEST COPY"; b = $true; c = $true; z = 2 }; $o += @{ t = ("CARVERY - Table " + $p.room_number); b = $true; c = $true; z = 1 }
  $o += (RuleL)
  $o += @{ t = ("Order No. " + $p.order_no) }; $o += @{ t = (When-Of $job $null) }
  if ($p.guest_name) { foreach ($w in (Wrap ("" + $p.guest_name) $LINE)) { $o += @{ t = $w } } }
  $o += (RuleL)
  foreach ($l in @($p.lines)) { foreach ($r in (PRows ("" + $l.qty + " x " + $l.name) ([double]$l.unit_price * [double]$l.qty))) { $o += @{ t = $r } } }
  $total = Order-Total $p; $net = $total / (1 + $VAT_RATE)
  $o += (RuleL)
  foreach ($r in (PRows "Subtotal (net)" $net)) { $o += @{ t = $r } }
  foreach ($r in (PRows ("VAT @ " + [int]($VAT_RATE * 100) + "%") ($total - $net))) { $o += @{ t = $r } }
  $o += (RuleL)
  foreach ($r in (PRows "Total charged" $total)) { $o += @{ t = $r; b = $true } }
  $o += @{ t = "Payment: Paid online" }
  $o += (RuleL)
  $o += @{ t = "Black Horse Beamish Ltd"; c = $true }; $o += @{ t = ("VAT reg. " + $VAT_NO); c = $true }; $o += @{ t = "Red Row, Beamish, DH9 0RW"; c = $true }; $o += @{ t = "Thank you for dining with us"; c = $true }
  if ($p.is_test -eq $true) { $o += (RuleL); $o += @{ t = "*** TEST ***"; b = $true; c = $true; z = 2 }; $o += @{ t = "DO NOT MAKE - TEST ORDER"; b = $true; c = $true } }
  return $o
}

function Botanicals-Lines($job) {
  $p = $job.payload; $o = @(Backup-Lines $p)
  $refund = ($p.is_refund -eq $true); $sign = if ($refund) { -1 } else { 1 }
  if ($p.test -eq $true) { $o += @{ t = "*** TEST RECEIPT ***"; b = $true; c = $true }; $o += (RuleL) }
  $name = if ($p.business_name) { "$($p.business_name)" } else { "Black Horse Botanicals" }
  foreach ($w in (Wrap $name.ToUpper() $LINE)) { $o += @{ t = $w; b = $true; c = $true; z = 1 } }
  foreach ($a in @($p.address_lines | Select-Object -First 6)) { foreach ($w in (Wrap ("" + $a) $LINE)) { $o += @{ t = $w; c = $true } } }
  $o += (RuleL)
  $o += @{ t = ("Receipt No. " + $(if ($p.receipt_no) { "$($p.receipt_no)" } else { "-" })) }; $o += @{ t = (When-Of $job $p.ts) }
  if ($p.team_member) { $o += @{ t = ("Served by " + $p.team_member) } }
  if ($refund) { $o += @{ t = "REFUND"; b = $true } }
  $o += (RuleL)
  $n = 0
  foreach ($l in @($p.lines)) {
    $n++; $qty = [Math]::Abs([double]$l.qty); $each = [double]$l.unit_price
    $v = $sign * [Math]::Abs($(if ($l.line_total -ne $null) { [double]$l.line_total } else { $qty * $each }))
    foreach ($r in (PRows ("" + $qty + " x " + $l.name) $v ($LINE - 9))) { $o += @{ t = $r } }
  }
  if (-not $n) { $o += @{ t = "(no items)" } }
  $o += (RuleL)
  foreach ($r in (PRows $(if ($refund) { "Total refunded" } else { "Total" }) ($sign * [Math]::Abs([double]$p.total)))) { $o += @{ t = $r; b = $true } }
  if ($p.payment_method -eq "cash") {
    $o += @{ t = $(if ($refund) { "Refunded in cash" } else { "Paid in cash" }) }
    if (-not $refund -and $p.cash_given -ne $null) { foreach ($r in (PRows "Cash given" ([double]$p.cash_given))) { $o += @{ t = $r } }; foreach ($r in (PRows "Change" ([double]$p.change))) { $o += @{ t = $r } } }
  } else { $o += @{ t = $(if ($refund) { "Refunded to card" } else { "Paid by card" }) } }
  if ($p.footer) { $o += (RuleL); foreach ($w in (Wrap ("" + $p.footer) $LINE)) { $o += @{ t = $w; c = $true } } }
  return $o
}
function Receipt-Lines($job) { if ("$($job.payload.copy)".ToLower() -eq "guest") { return @(Guest-Lines $job) } else { return @(Botanicals-Lines $job) } }
$RECEIPTS = @("guest", "botanicals")

function Lines-To-EscPos($lines) {
  $ms = New-Object IO.MemoryStream
  $put = { param([byte[]]$b) $ms.Write($b, 0, $b.Length) }
  & $put ([byte[]](0x1b, 0x40)); & $put ([byte[]](0x1b, 0x52, 0x03))      # reset, then the UK character set so {P} prints as a pound sign
  foreach ($l in $lines) {
    $z = if ($l.z) { [int]$l.z } else { 0 }
    & $put ([byte[]](0x1b, 0x61, $(if ($l.c) { 1 } else { 0 })))
    & $put ([byte[]](0x1b, 0x45, $(if ($l.b -or $z -ge 1) { 1 } else { 0 })))
    & $put ([byte[]](0x1d, 0x21, $(if ($z -eq 2) { 0x11 } else { 0x00 })))
    $t = ((Clean ("" + $l.t)).Replace("{P}", "#")) + "`n"
    & $put ([Text.Encoding]::ASCII.GetBytes($t))
  }
  & $put ([byte[]](0x1b, 0x45, 0x00, 0x1d, 0x21, 0x00, 0x1b, 0x61, 0x00)); & $put ([byte[]](0x0a, 0x0a, 0x0a, 0x0a)); & $put ([byte[]](0x1d, 0x56, 0x42, 0x00))      # feed + partial cut
  return $ms.ToArray()
}

function Build-EscPos($job) {
  $p = $job.payload; $copy = "$($p.copy)".ToLower()
  if ($copy -in $RECEIPTS) { return (Lines-To-EscPos (Receipt-Lines $job)) }
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
  if ($p.backup -eq $true) { & $bold $true; & $size 0x01; & $text "*** BACKUP PRINT ***`n"; & $size 0x00; & $bold $false; & $text "main printer did not print this`n"; & $rule }
  $isTest = ($p.is_test -eq $true)
  if ($isTest) { & $banner }
  & $bold $true; & $size 0x11; & $text ((Head-Of $copy) + "`n"); & $text "CARVERY`n"; & $size 0x22; & $text ("Table " + $p.room_number + "`n"); & $size 0x00; & $bold $false
  & $rule; & $align 0
  $when = ""; try { $when = ([datetime]::Parse($job.created_at)).ToLocalTime().ToString("dd/MM/yyyy HH:mm") } catch {}
  & $text ("Order No. " + $p.order_no + "   " + $when + "`n")
  if ($p.guest_name) { & $big (Wrap ("" + $p.guest_name) $LINE) }
  & $rule
  & $bold $true; & $text ($(if ($copy -eq "bar") { "DRINKS" } else { "FOOD" }) + "`n"); & $bold $false
  $items = @(); foreach ($x in @(Check-Lines $p.lines)) { if ($x.gap) { $items += ("-" * $LINE) }; $items += (Wrap ("" + $x.l.qty + " x " + $x.l.name) $LINE) }
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

function Draw-Lines($g, [float]$w, $lines) {
  $script:y = 4.0
  $face = "Consolas"; if (-not ((New-Object Drawing.FontFamily("Consolas")).Name -eq "Consolas")) { $face = "Courier New" }
  $tf = [Drawing.StringFormat]::GenericTypographic
  $pt = 12.0; while ($pt -gt 6 -and $g.MeasureString(("0" * $LINE), (New-Object Drawing.Font($face, $pt, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Point)), 2000, $tf).Width -gt ($w - 8)) { $pt -= 0.5 }      # biggest type that fits 32 columns across
  foreach ($l in $lines) {
    $z = if ($l.z) { [int]$l.z } else { 0 }
    $style = if ($l.b -or $z -ge 1) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
    $font = New-Object Drawing.Font($face, $(if ($z -eq 2) { $pt * 2 } else { $pt }), $style, [Drawing.GraphicsUnit]::Point)
    $fmt = New-Object Drawing.StringFormat([Drawing.StringFormat]::GenericTypographic); if ($l.c) { $fmt.Alignment = [Drawing.StringAlignment]::Center }
    $t = (Clean ("" + $l.t)).Replace("{P}", [string][char]0xA3)
    $h = $g.MeasureString("Xg", $font, 2000, $fmt).Height
    $g.DrawString($t, $font, [Drawing.Brushes]::Black, (New-Object Drawing.RectangleF(0, $script:y, $w, ($h + 2))), $fmt)
    $script:y += $h; $font.Dispose()
  }
  $script:y += 40
}

function Draw-Check($g, [float]$w, $job) {
  $p = $job.payload
  $copy = "$($p.copy)".ToLower()
  if ($copy -in $RECEIPTS) { Draw-Lines $g $w (Receipt-Lines $job); return }
  $script:y = 4.0
  if ($p.backup -eq $true) { Put $g $w "*** BACKUP PRINT ***" 12 $true $true; Put $g $w "main printer did not print this" 9 $false $true; Rule $g $w }
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
  foreach ($x in @(Check-Lines $p.lines)) { if ($x.gap) { Rule $g $w }; Put $g $w ("" + $x.l.qty + " x " + $x.l.name) 16 $true $false }
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
    if ($pr -and ($pr.WorkOffline -or $pr.PrinterStatus -eq 7 -or @(4, 7, 8, 9) -contains [int]$pr.DetectedErrorState)) { return $true }      # offline, no paper, cover open, jammed
  } catch {}
  return $false
}

function Open-Com($sp) {
  for ($i = 0; $i -lt 8; $i++) { try { $sp.Open(); return } catch { Start-Sleep -Milliseconds 500 } }
  $sp.Open()      # one last time, and let it throw if it still cannot
}
# Asks a serial printer how it is, the standard receipt-printer way (real-time status, DLE EOT n). Returns @{ replied; why } - why is $null when all is well.
function Query-ComStatus {
  $baud = if ($cfg.baud) { [int]$cfg.baud } else { 9600 }
  $sp = New-Object IO.Ports.SerialPort("$($cfg.port)", $baud, [IO.Ports.Parity]::None, 8, [IO.Ports.StopBits]::One)
  $sp.ReadTimeout = 900; $sp.WriteTimeout = 3000; $sp.DtrEnable = $true; $sp.RtsEnable = $true
  try { Open-Com $sp } catch { return @{ replied = $false; why = "the COM port cannot be opened (the till's own software may have it)" } }
  $res = @{}
  try {
    foreach ($q in 1, 2, 4) {
      $sp.DiscardInBuffer()
      $sp.Write([byte[]](0x10, 0x04, $q), 0, 3)
      try { $res[$q] = $sp.ReadByte() } catch { return @{ replied = $false; why = "no reply from the printer (switched off or unplugged)" } }
    }
  } finally { if ($sp.IsOpen) { $sp.Close() }; $sp.Dispose() }
  $why = $null
  if ($res[1] -band 0x08) { $why = "the printer is offline" }
  elseif ($res[2] -band 0x04) { $why = "the printer cover is open" }
  elseif ($res[2] -band 0x40) { $why = "the printer has an error" }
  elseif ($res[4] -band 0x60) { $why = "the printer is out of paper" }
  return @{ replied = $true; why = $why; bytes = ("{0:X2} {1:X2} {2:X2}" -f $res[1], $res[2], $res[4]) }
}
$script:notReadyNote = ""
function Printer-Ready {
  $name = "$($cfg.printer)"
  if ($name -like "PREVIEW:*") { return $true }
  $why = $null
  if ($mode -eq "com") { if ($statusCheck) { $why = (Query-ComStatus).why } }
  elseif (Printer-Offline $name) { $why = "the printer '$name' is switched off, unplugged or has an error (paper out, cover open, jam)" }
  if ($why) {
    if ($script:notReadyNote -ne $why) { Log "printer not ready: $why. Not printing; the checks wait (a backup printer takes them after $backupDelay seconds)."; $script:notReadyNote = $why }
    return $false
  }
  if ($script:notReadyNote) { Log "printer ready again"; $script:notReadyNote = "" }
  return $true
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
      Open-Com $sp; $b = Build-EscPos $job; $sp.Write($b, 0, $b.Length); $sp.BaseStream.Flush()
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
function Is-ServiceTime {      # when new checks can arrive: a carvery Sunday, or the Botanicals shop's opening day
  $n = Get-Date
  if (($checks -contains "bar" -or $checks -contains "kitchen" -or $checks -contains "pass" -or $checks -contains "guest") -and $n.DayOfWeek -eq [DayOfWeek]::Sunday -and $n.Hour -ge 11 -and $n.Hour -lt 17) { return $true }
  if ($checks -contains "botanicals" -and $n.Hour -ge 8 -and $n.Hour -lt 19) { return $true }
  return $false
}
function Queue-Url($copy, $status) {
  if ($copy -eq "botanicals") { return "print_jobs?destination=eq.botanicals&status=eq.$status&order=created_at.asc&limit=50&select=*" }
  return "print_jobs?destination=eq.carvery&$copyFilter=eq.$copy&status=eq.$status&order=created_at.asc&limit=50&select=*"
}

function Work-Queue {
  foreach ($copy in $checks) {
    $extra = ""
    if ($role -eq "backup") {
      # A job the main printer left alone for too long is this printer's. One stuck "printing" (the main till stopped half way) is released first.
      $stuck = (Get-Date).ToUniversalTime().AddSeconds(-120).ToString("yyyy-MM-ddTHH:mm:ssZ")
      try { Rest (((Queue-Url $copy "printing") -replace "&order=.*$", "") + "&created_at=lt.$stuck") "PATCH" @{ status = "pending" } | Out-Null } catch {}
      $extra = "&created_at=lt." + (Get-Date).ToUniversalTime().AddSeconds(-$backupDelay).ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    $recent = "&created_at=gt." + (Get-Date).ToUniversalTime().AddHours(-6).ToString("yyyy-MM-ddTHH:mm:ssZ")      # nothing older than 6 hours: an old backlog must never flood the printer when a till comes back
    $jobs = Rows (Rest ((Queue-Url $copy "pending") + $extra + $recent))
    if ($jobs.Count -and -not (Printer-Ready)) { return }      # this printer cannot print just now: leave the checks for the other one
    foreach ($job in $jobs) {
      if ($copy -eq "botanicals") { $job.payload | Add-Member -NotePropertyName copy -NotePropertyValue "botanicals" -Force }
      if ($role -eq "backup") { $job.payload | Add-Member -NotePropertyName backup -NotePropertyValue $true -Force }
      $label = if ($copy -eq "botanicals") { "Botanicals receipt $($job.payload.receipt_no)" } else { "$copy check, order $($job.payload.order_no), table $($job.payload.room_number)" }
      try {
        $claimed = Rows (Rest "print_jobs?id=eq.$($job.id)&status=eq.pending" "PATCH" @{ status = "printing" } "return=representation")
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

if ($Status) {
  if ($mode -ne "com") { Log "status check only applies to a COM printer (this one is $mode)"; exit 0 }
  $r = Query-ComStatus
  if ($r.replied) { Log "printer answered (status bytes $($r.bytes)); $(if ($r.why) { $r.why } else { 'all is well' })"; exit 0 }
  Log "no answer: $($r.why)"; exit 2
}
if ($Test) {
  $bad = 0
  foreach ($copy in $checks) {
    $now = (Get-Date).ToUniversalTime().ToString("o")
    if ($copy -eq "guest") {
      $gl = @([pscustomobject]@{ qty = 2; name = "Sunday Carvery (Standard)"; unit_price = 16.95 }, [pscustomobject]@{ qty = 1; name = "Soup of the Day (V) (VGA)"; unit_price = 8.00 }, [pscustomobject]@{ qty = 2; name = "Pint of Lager"; unit_price = 6.50 })
      $job = [pscustomobject]@{ created_at = $now; payload = [pscustomobject]@{ copy = "guest"; order_no = 999; room_number = "12"; guest_name = "Test Guest"; is_test = $true; subtotal = 54.90; lines = $gl } }
    } elseif ($copy -eq "botanicals") {
      $bl = @([pscustomobject]@{ name = "Dried Flower Bouquet"; qty = 1; unit_price = 25.00; line_total = 25.00 }, [pscustomobject]@{ name = "Candle"; qty = 2; unit_price = 7.50; line_total = 15.00 })
      $job = [pscustomobject]@{ created_at = $now; payload = [pscustomobject]@{ copy = "botanicals"; test = $true; business_name = "Black Horse Botanicals"; address_lines = @("Red Row", "Beamish", "DH9 0RW"); receipt_no = "TEST1"; ts = $now; team_member = "Test"; lines = $bl; total = 40.00; payment_method = "card"; footer = "Thank you for shopping with us" } }
    } else {
      $lines = if ($copy -eq "bar") { @(@{ qty = 2; name = "Pint of Lager" }, @{ qty = 1; name = "Large Glass of Merlot" }) } else { @(@{ qty = 2; name = "Soup of the Day" }, @{ qty = 1; name = "Sticky Toffee Pudding" }) }
      $job = [pscustomobject]@{ created_at = $now; payload = [pscustomobject]@{ copy = $copy; order_no = 999; room_number = "12"; guest_name = "Test Guest"; is_test = $true; notes = "Test check from the installer"; allergy_notes = ""; lines = $lines } }
    }
    try { Print-Job $job; Log "test $copy sent ($mode, '$($cfg.printer)$($cfg.port)')" } catch { Log "test $copy FAILED: $($_.Exception.Message)"; $bad++ }
  }
  exit $bad
}

$updateUrl = "https://app.blackhorsebeamish.co.uk/till-print-3k9x7q/src/carvery-till.ps1"
$startupVbs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\BHB Carvery Printer.vbs"
$script:lastUpdateCheck = (Get-Date).AddMinutes(-25); $script:lastBeat = Get-Date; $script:lastReport = (Get-Date).AddMinutes(-5)
function Report-Status {
  # Tells the order system how this till's printer program is getting on (once a minute on a service day, every 5 minutes otherwise), so a printer that is off or failing can be seen from the portal.
  $every = if (Is-ServiceTime) { 1 } else { 5 }
  if (((Get-Date) - $script:lastReport).TotalMinutes -lt $every) { return }
  $script:lastReport = Get-Date
  try {
    $row = [ordered]@{
      id = "$env:COMPUTERNAME/$env:USERNAME"; host = "$env:COMPUTERNAME"; role = $role; version = $VERSION; checks = ($checks -join ","); mode = $mode
      port = $(if ($mode -eq "com") { "$($cfg.port)" } else { "$($cfg.printer)" })
      ready = (-not [bool]$script:notReadyNote); ready_note = "$script:notReadyNote"
      last_error = "$script:lastError"; last_error_at = $(if ($script:lastErrorAt) { $script:lastErrorAt.ToString("o") } else { $null })
      last_printed_at = $(if ($script:lastPrintedAt) { $script:lastPrintedAt.ToString("o") } else { $null })
      started_at = $script:startedAt.ToString("o"); updated_at = (Get-Date).ToUniversalTime().ToString("o")
    }
    Rest "till_printer_status?on_conflict=id" "POST" $row "resolution=merge-duplicates,return=minimal" | Out-Null
  } catch { }
}
function Check-Update {
  # Picks up a corrected program from the portal by itself, so the tills never need re-installing for a fix. Only a file that parses and carries this program's marker is used.
  $script:lastUpdateCheck = Get-Date
  try {
    $new = (Invoke-WebRequest -Uri ($updateUrl + "?t=" + [Guid]::NewGuid().ToString("N")) -UseBasicParsing -TimeoutSec 30).Content
    if ($new -isnot [string]) { $new = [Text.Encoding]::UTF8.GetString($new) }
    $old = Get-Content $PSCommandPath -Raw
    if (($new -replace "\r\n", "`n").Trim() -eq ($old -replace "\r\n", "`n").Trim()) { return }
    if ($new -notmatch "BHB-TILL-PRINT-PROGRAM") { Log "update ignored: not this program"; return }
    [void][scriptblock]::Create($new)
    [IO.File]::WriteAllText($PSCommandPath, ($new -replace "\r\n", "`n" -replace "`n", "`r`n"), (New-Object Text.UTF8Encoding($false)))
    Log "program updated from the portal; restarting"
    if (Test-Path $startupVbs) { Start-Process -FilePath "cmd.exe" -ArgumentList "/c ping -n 5 127.0.0.1 >nul & wscript.exe `"$startupVbs`"" -WindowStyle Hidden }
    exit 0
  } catch { Log "update check failed: $($_.Exception.Message)" }
}
Log "printer program started ($role, version $VERSION): $($checks -join ', '), mode $mode, '$($cfg.printer)$($cfg.port)'"
if ($role -ne "backup") { foreach ($copy in $checks) { try { Rest ((Queue-Url $copy "printing") -replace "&order=.*$", "") "PATCH" @{ status = "pending" } | Out-Null } catch { Log "start-up release failed: $($_.Exception.Message)" } } }      # (a backup never touches the main printer's jobs)
while ($true) {
  [void][BhbAwake]::SetThreadExecutionState(0x80000001)      # do not let this till go to sleep while the program is running
  try { Work-Queue } catch { Log "check failed: $($_.Exception.Message)" }
  if ($Once) { break }
  Report-Status
  if (((Get-Date) - $script:lastBeat).TotalMinutes -ge 10) { Log "still running (version $VERSION), $(if ($script:notReadyNote) { 'printer NOT ready: ' + $script:notReadyNote } else { 'printer ok' })"; $script:lastBeat = Get-Date }
  if (((Get-Date) - $script:lastUpdateCheck).TotalMinutes -ge 30) { Check-Update }
  Start-Sleep -Seconds $(if (Is-ServiceTime) { 5 } else { 60 })      # quiet when nothing can arrive (outside a carvery Sunday / shop hours), so it costs the order system next to nothing
}
