@echo off
:: ============================================================================
:: TheSSBuddy Portal - Windows Service Uninstaller
:: ============================================================================

title Uninstalling TheSSBuddy Windows Service...

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
set DAEMON_EXE=%~dp0service\daemon\thessbuddyportal.exe

echo.
echo ================================================================
echo   Uninstalling TheSSBuddy Windows Service...
echo ================================================================
echo.

"%DAEMON_EXE%" stop
"%DAEMON_EXE%" uninstall
sc.exe delete TheSSBuddyPortal >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo.
echo [SUCCESS] TheSSBuddy Windows Service removed successfully.
echo.
pause
