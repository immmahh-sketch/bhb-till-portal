# Registers kitchen-printer.js and bar-printer.js as real Windows services
# using NSSM, so they auto-start on boot (no one needs to be logged in) and
# auto-restart if they ever crash.
#
# Run this AS ADMINISTRATOR, from the folder you copied printer-bridge into
# on the always-on PC (e.g. C:\printer-bridge). Right-click PowerShell ->
# "Run as administrator", cd to that folder, then:
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\install-service.ps1
#
# Safe to re-run - it removes and recreates the two services each time,
# e.g. after pulling updated code.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Require-Cmd($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host "'$name' was not found. $hint" -ForegroundColor Red
    exit 1
  }
}

Require-Cmd "node" "Install Node.js LTS from https://nodejs.org first, then re-run this script."
Require-Cmd "nssm" "Install NSSM first: 'winget install -e --id NSSM.NSSM', then close and reopen this terminal, then re-run this script."

$nodePath = (Get-Command node).Source

function Install-BridgeService($serviceName, $scriptFile) {
  Write-Host "`n--- $serviceName ---"
  nssm stop $serviceName 2>$null | Out-Null
  nssm remove $serviceName confirm 2>$null | Out-Null

  nssm install $serviceName $nodePath "`"$here\$scriptFile`""
  nssm set $serviceName AppDirectory $here
  nssm set $serviceName Start SERVICE_AUTO_START
  nssm set $serviceName AppExit Default Restart
  nssm set $serviceName AppRestartDelay 5000
  nssm set $serviceName AppStdout "$here\logs\$serviceName.out.log"
  nssm set $serviceName AppStderr "$here\logs\$serviceName.err.log"
  nssm set $serviceName AppRotateFiles 1
  nssm set $serviceName AppRotateBytes 5242880

  nssm start $serviceName
  Write-Host "$serviceName installed and started." -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path "$here\logs" | Out-Null

Install-BridgeService "BHB-Kitchen-Printer" "kitchen-printer.js"
Install-BridgeService "BHB-Bar-Printer" "bar-printer.js"

Write-Host "`nDone. Check status any time with:  Get-Service BHB-*"
Write-Host "Logs are in: $here\logs\"
Write-Host "To stop/start one manually:  nssm stop BHB-Kitchen-Printer  /  nssm start BHB-Kitchen-Printer"
