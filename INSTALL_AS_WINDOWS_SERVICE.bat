@echo off
:: ============================================================================
:: TheSSBuddy Portal - Windows Service Installer  (Requires Admin)
:: ============================================================================

title TheSSBuddy - Installing Windows Service...

:: ── 1. Require Administrator ───────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Requesting Administrator access to install Windows Service...
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:: ── 2. Move to project root ────────────────────────────────────────────────
cd /d "%~dp0"
set ROOT_DIR=%~dp0
set DAEMON_EXE=%ROOT_DIR%service\daemon\thessbuddyportal.exe

echo.
echo ================================================================
echo   TheSSBuddy B2B Portal - Windows Service Installation
echo ================================================================
echo.

:: ── 3. Stop any running node processes ────────────────────────────────────
echo [1/7] Stopping existing node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: ── 4. Stop service if running ────────────────────────────────────────────
echo [2/7] Stopping existing service (if running)...
sc stop TheSSBuddyPortal >nul 2>&1
timeout /t 3 /nobreak >nul

:: ── 5. Uninstall old service if it exists ─────────────────────────────────
echo [3/7] Removing old service registration (if any)...
sc query TheSSBuddyPortal >nul 2>&1
if %errorLevel% equ 0 (
    echo       Found existing service - uninstalling...
    "%DAEMON_EXE%" uninstall
    timeout /t 5 /nobreak >nul
    sc delete TheSSBuddyPortal >nul 2>&1
    timeout /t 3 /nobreak >nul
    echo       Old service removed.
) else (
    echo       No existing service found, proceeding fresh.
)

:: ── 6. Build backend ───────────────────────────────────────────────────────
echo [4/7] Building NestJS backend...
call npm run build
if %errorLevel% neq 0 (
    echo.
    echo  ERROR: Backend build failed! Check output above.
    pause
    exit /b 1
)

:: ── 7. Build frontend ──────────────────────────────────────────────────────
echo [5/7] Building Next.js frontend...
call npm run build --prefix frontend
if %errorLevel% neq 0 (
    echo.
    echo  ERROR: Frontend build failed! Check output above.
    pause
    exit /b 1
)

:: ── 8. Install Windows Service ────────────────────────────────────────────
echo [6/7] Installing Windows Service (TheSSBuddyPortal)...
"%DAEMON_EXE%" install
if %errorLevel% neq 0 (
    echo.
    echo  ERROR: Service installation failed!
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul

:: ── 9. Set to Automatic startup and start ─────────────────────────────────
echo [7/7] Configuring automatic startup and starting service...
sc config TheSSBuddyPortal start= auto >nul 2>&1
"%DAEMON_EXE%" start
timeout /t 3 /nobreak >nul

:: ── Done ───────────────────────────────────────────────────────────────────
echo.
echo ================================================================
echo  SUCCESS - TheSSBuddy Windows Service is INSTALLED and RUNNING
echo ================================================================
echo.
echo  Service Name : TheSSBuddyPortal  (visible in services.msc)
echo  Startup Type : Automatic (starts when Windows boots)
echo  Frontend URL : http://localhost:3001
echo  Backend API  : http://localhost:3000/api
echo  Swagger Docs : http://localhost:3000/api/docs
echo.
echo  You can safely close this window. The service runs 24/7.
echo ================================================================
echo.
pause