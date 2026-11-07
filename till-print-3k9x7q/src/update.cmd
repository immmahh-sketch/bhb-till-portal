@echo off
title Update the carvery printer program
set DIR=%LOCALAPPDATA%\BHB Carvery Printer
if not exist "%DIR%\config.json" (
  echo The carvery printer is not installed on this till. Run install.cmd instead.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*carvery-till.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
copy /y "%~dp0carvery-till.ps1" "%DIR%\carvery-till.ps1" >nul
wscript.exe "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BHB Carvery Printer.vbs"
echo.
echo Updated and restarted. Your printer settings were kept.
echo From now on this till updates itself.
pause
