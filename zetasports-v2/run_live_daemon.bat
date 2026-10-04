@echo off
title ZetaSports v2 Live Score Sync Daemon (10s Poller)
color 0b
echo ===================================================
echo   ZetaSports v2 - 10-Second Live Score Sync Daemon
echo ===================================================
echo.
echo Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not found in PATH!
  echo Please install Node.js from https://nodejs.org
  pause
  exit /b 1
)

echo Launching high-frequency live match synchronizer...
echo Mode: 10s during live matches / 60s idle
echo Press Ctrl+C to stop.
echo.
node "%~dp0scripts\live_score_daemon.mjs"
pause
