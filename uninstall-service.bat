@echo off
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:run
cd /d "%~dp0"
echo ========================================================
echo Uninstalling TheSSBuddy Windows Service...
echo ========================================================
node service/uninstall-service.js
echo ========================================================
echo Service uninstalled.
echo ========================================================
pause
