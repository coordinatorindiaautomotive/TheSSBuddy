@echo off
:: Ensure running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================================
    echo Requesting Administrator Privileges...
    echo ========================================================
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo ========================================================
echo Configuring TheSSBuddy as an Automatic Windows Service...
echo ========================================================
echo.

echo 1. Stopping any old processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo 2. Building Production Backend...
call npm run build

echo.
echo 3. Building Production Frontend...
call npm run build --prefix frontend

echo.
echo 4. Registering Windows Startup Background Task...
schtasks /create /tn "TheSSBuddyPortalService" /tr "wscript.exe \"%~dp0service\start-hidden.vbs\"" /sc ONLOGON /rl HIGHEST /f

echo.
echo 5. Starting TheSSBuddy Background Service right now...
wscript.exe "%~dp0service\start-hidden.vbs"

timeout /t 3 /nobreak >nul
echo.
echo ========================================================
echo ✅ SUCCESS! TheSSBuddy is now configured as a Windows Service.
echo.
echo - It is running in the background right now.
echo - It will automatically start whenever Windows starts.
echo.
echo Frontend URL: http://localhost:3001
echo Backend API:  http://localhost:3000/api
echo Logs Path:   %~dp0logs\service.log
echo ========================================================
echo.
pause
