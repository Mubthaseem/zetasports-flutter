@echo off
title Deploy ZetaSports Admin Frontend UI
echo ========================================================
echo   ZetaSports Admin - Decoupled Frontend UI Deployment
echo   (Static Web App - Zero Secrets - Pure Client)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking Netlify Login...
call npx -y netlify-cli status

echo.
echo [2/2] Deploying Frontend to Netlify...
call npx -y netlify-cli deploy --prod --dir=. --site=4906c546-d2e4-4906-a14b-38e5f7834d95

echo.
echo ========================================================
echo   Frontend Deployment Complete!
echo ========================================================
pause
