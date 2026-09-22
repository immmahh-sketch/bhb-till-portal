# Supervisor for the printer bridge, for PCs where we don't have admin rights
# (so can't use install-service.ps1 / NSSM). Keeps kitchen-printer.js and
# bar-printer.js running, restarting either one if it ever exits, and writes
# their output to logs\. Registered as an at-logon scheduled task by
# install-task-noadmin.ps1 - it runs hidden and keeps going while the screen
# is locked (but not if the user signs out).

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $here "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "C:\Program Files\nodejs\node.exe" }

$scripts = @{
  "kitchen" = "kitchen-printer.js"
  "bar"     = "bar-printer.js"
}
$procs = @{}

function Start-Bridge($name) {
  $out = Join-Path $logDir "$name.out.log"
  $err = Join-Path $logDir "$name.err.log"
  # Keep logs from growing forever - start fresh once they pass 5 MB.
  foreach ($f in @($out, $err)) {
    if ((Test-Path $f) -and ((Get-Item $f).Length -gt 5MB)) { Remove-Item $f -Force }
  }
  $p = Start-Process -FilePath $node -ArgumentList $scripts[$name] -WorkingDirectory $here `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  $procs[$name] = $p
  Add-Content (Join-Path $logDir "supervisor.log") "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] started $name (pid $($p.Id))"
}

# Don't double up if a previous copy of this supervisor is still running.
$me = $PID
$others = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -like "*start-bridge.ps1*" }
if ($others) {
  Add-Content (Join-Path $logDir "supervisor.log") "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] another supervisor already running (pid $($others[0].ProcessId)), exiting"
  exit 0
}

foreach ($name in $scripts.Keys) { Start-Bridge $name }

while ($true) {
  Start-Sleep -Seconds 10
  foreach ($name in @($scripts.Keys)) {
    if ($procs[$name].HasExited) {
      Add-Content (Join-Path $logDir "supervisor.log") "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $name exited (code $($procs[$name].ExitCode)), restarting in 5s"
      Start-Sleep -Seconds 5
      Start-Bridge $name
    }
  }
}
