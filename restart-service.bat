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
echo Restarting TheSSBuddy Windows Service...
echo ========================================================
net stop thessbuddyportal.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

net start thessbuddyportal.exe >nul 2>&1
if %errorLevel% neq 0 (
    wscript.exe "%~dp0service\start-hidden.vbs"
)

echo ========================================================
echo ✅ Service Restarted Successfully!
echo Frontend: http://localhost:3001
echo Backend API: http://localhost:3000/api
echo ========================================================
timeout /t 4 /nobreak >nul
exit /b
