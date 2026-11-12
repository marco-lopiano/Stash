@echo off
cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install || goto :fail
)

REM
set NEEDS_BUILD=0
if not exist "dist\index.html" set NEEDS_BUILD=1
if "%NEEDS_BUILD%"=="1" goto :build

powershell -NoProfile -Command "$b=(Get-Item 'dist\index.html').LastWriteTime; $n=Get-ChildItem src,public,index.html,package.json,package-lock.json,vite.config.* -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt $b } | Select-Object -First 1; if ($n) { exit 1 } else { exit 0 }"
if errorlevel 1 set NEEDS_BUILD=1

:build
if "%NEEDS_BUILD%"=="1" (
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