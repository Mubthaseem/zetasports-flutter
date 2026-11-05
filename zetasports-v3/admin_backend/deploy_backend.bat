@echo off
title Deploy ZetaSports Admin Backend API
echo ========================================================
echo   ZetaSports Admin - Backend Serverless API Deployment
echo   Target Site: zetaadminconsole.netlify.app
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Deploying Backend Functions to Netlify...
call npx -y netlify-cli deploy --prod --functions=netlify/functions --site=e9a5c499-c68b-4fe9-98e7-65e160bf01db

echo.
echo ========================================================
echo   Backend Deployment Complete!
echo ========================================================
pause
