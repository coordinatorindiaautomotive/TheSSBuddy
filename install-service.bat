@echo off
:: Check for Admin Permissions
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    echo ========================================================
    echo Requesting Administrator Privileges...
    echo ========================================================
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:run
cd /d "%~dp0"
echo ========================================================
echo Installing TheSSBuddy Portal as a Windows Service...
echo ========================================================
echo.
echo 1. Building Production Backend...
call npm run build
echo.
echo 2. Building Production Frontend...
call npm run build --prefix frontend
echo.
echo 3. Registering Windows Service (Automatic Startup)...
node service/install-service.js
echo.
echo ========================================================
echo Done! The service is registered and running.
echo Frontend: http://localhost:3001
echo Backend API: http://localhost:3000/api
echo ========================================================
pause
