@echo off
title ZetaSports Admin Portal v2 Server
echo ===================================================
echo   Starting ZetaSports Admin Portal v2 (Local Server)
echo ===================================================
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org/ to run Admin Portal.
    pause
    exit /b 1
)

echo Starting local HTTP server on http://localhost:3000 ...
node admin_v2\serve.js
pause
