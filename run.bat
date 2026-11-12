@echo off
cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install || goto :fail
)

if not exist "dist\index.html" (
    echo Building...
    call npm run build || goto :fail
)

start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0tray.ps1"
exit /b 0

:fail
echo.
echo Something failed. See the messages above.
pause
exit /b 1