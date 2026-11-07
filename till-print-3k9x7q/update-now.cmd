@echo off
title Update the carvery printer program
set DIR=%LOCALAPPDATA%\BHB Carvery Printer
if not exist "%DIR%\config.json" (
  echo The carvery printer is not installed on this till. Use the installer first.
  pause
  exit /b 1
)
echo Stopping the old program...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*carvery-till.ps1*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Downloading the latest program...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $u='https://app.blackhorsebeamish.co.uk/till-print-3k9x7q/src/carvery-till.ps1?t='+[Guid]::NewGuid().ToString('N'); $r=Invoke-WebRequest -Uri $u -UseBasicParsing; $t=$r.Content; if ($t -isnot [string]) { $t=[Text.Encoding]::UTF8.GetString($t) }; if ($t -notmatch 'BHB-TILL-PRINT-PROGRAM') { throw 'not the program' }; [IO.File]::WriteAllText($env:LOCALAPPDATA+'\BHB Carvery Printer\carvery-till.ps1', $t, (New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
  echo.
  echo Could not download the new program. Check this till is online, then run this again.
  pause
  exit /b 1
)
wscript.exe "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BHB Carvery Printer.vbs"
echo.
echo Updated and restarted. Your printer settings were kept.
echo To check: the log's "printer program started" line should now say "version 2026-11-07".
pause
