# No-admin alternative to install-service.ps1. Registers start-bridge.ps1 as
# a Task Scheduler task that runs (hidden) whenever this user logs on, and
# starts it immediately. Standard users can do this for their own account.
#
# Run from a normal (non-admin) PowerShell:
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\install-task-noadmin.ps1
#
# Safe to re-run. Check status with:  Get-ScheduledTask BHB-Printer-Bridge
# Stop it with:  Stop-ScheduledTask BHB-Printer-Bridge   (kills the node
# processes too - see the end of this script)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = "BHB-Printer-Bridge"
$user = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$here\start-bridge.ps1`"" `
  -WorkingDirectory $here
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Black Horse Beamish kitchen + bar printer bridge (no-admin supervisor)" | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 5

Write-Host "`nTask '$taskName' registered and started for $user." -ForegroundColor Green
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Node processes running:"
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, CommandLine | Format-Table -AutoSize
Write-Host "Logs are in: $here\logs\"
