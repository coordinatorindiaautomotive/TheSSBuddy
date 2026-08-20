@echo off
cd /d "%~dp0"
echo ========================================================
echo Starting TheSSBuddy in Background...
echo ========================================================
wscript.exe "%~dp0service\start-hidden.vbs"
timeout /t 2 /nobreak >nul
echo.
echo Started in background!
echo Frontend: http://localhost:3001
echo Backend API: http://localhost:3000/api
echo ========================================================
timeout /t 3 /nobreak >nul
