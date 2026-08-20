@echo off
echo ========================================================
echo Stopping TheSSBuddy Background Service...
echo ========================================================
taskkill /F /IM node.exe >nul 2>&1
echo.
echo TheSSBuddy background processes have been stopped.
echo ========================================================
pause
