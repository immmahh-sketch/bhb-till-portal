@echo off
title Black Horse Beamish - carvery check printer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo The install stopped with a problem. Please tell Paul what is on the screen above.
  pause
)
