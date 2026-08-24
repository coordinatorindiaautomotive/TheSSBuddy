@echo off
:: ============================================================================
:: TheSSBuddy Portal - 1-Click Completely Hidden Background Runner
:: ============================================================================

cd /d "%~dp0"
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

wscript.exe "%~dp0service\start-hidden.vbs"

echo.
echo ================================================================
echo TheSSBuddy Background Service Launched!
echo.
echo - Portal URL:  http://localhost:3001
echo - Backend API: http://localhost:3000/api
echo.
echo This window will close in 3 seconds. The portal is running in background.
echo ================================================================
timeout /t 3 /nobreak >nul
