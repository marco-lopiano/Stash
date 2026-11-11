@echo off
title Launching Vite Project

echo Checking dependencies...
if not exist "node_modules\" (
    echo node_modules not found. Running npm install...
    call npm install
)

echo Starting Vite development server...
npm run dev

pause
