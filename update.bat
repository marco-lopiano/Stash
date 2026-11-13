@echo off
setlocal
cd /d "%~dp0"

set "REMOTE_URL=https://github.com/marco-lopiano/Stash.git"

where git >nul 2>&1 || (
    echo git is not installed.
    goto :fail
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Not a git repository. Initializing...
    git init || goto :fail
)

REM Set origin if no remote is configured
set "REMOTE="
for /f "delims=" %%r in ('git remote') do if not defined REMOTE set "REMOTE=%%r"
if not defined REMOTE (
    echo No remote set. Adding origin -^> %REMOTE_URL%
    git remote add origin "%REMOTE_URL%" || goto :fail
    set "REMOTE=origin"
)
git remote | findstr /x "origin" >nul && set "REMOTE=origin"

set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
if not defined BRANCH set "BRANCH=main"
if "%BRANCH%"=="HEAD" set "BRANCH=main"

echo Pulling %REMOTE%/%BRANCH%...
git pull "%REMOTE%" "%BRANCH%" || goto :fail

REM Track the remote branch so plain 'git pull' works afterwards
git branch --set-upstream-to="%REMOTE%/%BRANCH%" "%BRANCH%" >nul 2>&1

echo Up to date.
pause
exit /b 0

:fail
echo.
echo Something failed. See the messages above.
pause
exit /b 1
