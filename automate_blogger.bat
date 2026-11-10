@echo off
title ZetaSports & KeralaHub Blogger Automation Hub
cls
echo ======================================================================
echo           ZETASPORTS & KERALAHUB BLOGGER AUTOMATION HUB
echo ======================================================================
echo.
echo  [1] Publish KeralaHub Theme (https://www.keralahub.online)
echo  [2] Publish ZetaSports Theme (http://www.zetasports.site)
echo  [3] Publish BOTH Themes to Blogger (All Sites)
echo  [4] First-Time Setup: Log in to Google Account (Visible Browser)
echo  [5] Dry-Run Validation (Test Without Saving)
echo  [6] Launch AI Niche Blogger Post Generator (Gemini/Ollama)
echo  [7] Exit
echo.
echo ======================================================================
set /p choice="Enter choice [1-7]: "

if "%choice%"=="1" (
    echo.
    echo Pushing theme to KeralaHub...
    node scripts/blogger_auto_publisher.cjs --target=keralahub
    pause
    goto end
)
if "%choice%"=="2" (
    echo.
    echo Pushing theme to ZetaSports...
    node scripts/blogger_auto_publisher.cjs --target=zetasports
    pause
    goto end
)
if "%choice%"=="3" (
    echo.
    echo Pushing theme to ALL Blogger sites...
    node scripts/blogger_auto_publisher.cjs --all
    pause
    goto end
)
if "%choice%"=="4" (
    echo.
    echo Opening Chrome for Google Authentication...
    node scripts/blogger_auto_publisher.cjs --all --visible
    pause
    goto end
)
if "%choice%"=="5" (
    echo.
    echo Running dry-run validation...
    node scripts/blogger_auto_publisher.cjs --dry-run
    pause
    goto end
)
if "%choice%"=="6" (
    echo.
    echo Launching Niche Blogger AI Agent...
    call run_niche_blogger.bat
    goto end
)
if "%choice%"=="7" (
    exit
)

:end
