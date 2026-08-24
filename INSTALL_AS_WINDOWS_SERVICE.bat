@echo off
:: ============================================================================
:: TheSSBuddy Portal - Windows Service Auto-Installer (Requires Admin Elevation)
:: ============================================================================

title Installing TheSSBuddy Windows Service...

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ================================================================
    echo Requesting Administrator permissions to install Windows Service...
    echo ================================================================
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:: 2. Set Directory
cd /d "%~dp0"
set ROOT_DIR=%~dp0
set DAEMON_EXE=%ROOT_DIR%service\daemon\thessbuddyportal.exe

echo.
echo ================================================================
echo   TheSSBuddy B2B Portal - Windows Service Installation
echo ================================================================
echo.
echo 1. Stopping any existing node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Building Production Packages...
call npm run build
call npm run build --prefix frontend

echo 3. Installing Windows Service (TheSSBuddyPortal)...
"%DAEMON_EXE%" install

echo 4. Configuring Service to Automatic Startup...
sc.exe config TheSSBuddyPortal start= auto

echo 5. Starting TheSSBuddy Windows Service...
"%DAEMON_EXE%" start

echo.
echo ================================================================
echo [SUCCESS] TheSSBuddy Windows Service is INSTALLED & RUNNING!
echo ================================================================
echo.
echo - Service Name: TheSSBuddyPortal (Visible in services.msc)
echo - Startup Type: Automatic (Starts automatically when Windows boots)
echo - Portal URL:   http://localhost:3001
echo - Backend API:  http://localhost:3000/api
echo.
echo You can now safely close this window. The service will run 24/7.
echo ================================================================
echo.
pause
