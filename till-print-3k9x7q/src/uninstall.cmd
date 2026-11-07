@echo off
title Remove the carvery check printer
echo Removing the carvery check printer from this till...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*carvery-till.ps1*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BHB Carvery Printer.vbs" 2>nul
rmdir /s /q "%LOCALAPPDATA%\BHB Carvery Printer" 2>nul
echo Done. This till will no longer print carvery checks.
pause
