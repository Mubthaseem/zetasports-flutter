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
echo  [6] Update SEO Keywords, Titles & Announcement Banner (Live Cloud)
echo  [7] Launch AI Niche Blogger Post Generator (Gemini/Ollama)
echo  [8] Run All 5 Automated Test Suites (run_tests.bat)
echo  [9] Start Real-Time Live Matches & Scores Sync Daemon
echo  [10] Launch ZetaSports Admin Portal v3 (Port 2121)
echo  [11] Exit
echo.
echo ======================================================================
set /p choice="Enter choice [1-11]: "

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
    node scripts/update_seo_keywords.cjs --interactive
    pause
    goto end
)
if "%choice%"=="7" (
    echo.
    echo Launching Niche Blogger AI Agent...
    call run_niche_blogger.bat
    goto end
)
if "%choice%"=="8" (
    echo.
    echo Running all automated test suites...
    call run_tests.bat
    goto end
)
if "%choice%"=="9" (
    echo.
    echo Starting 24/7 Live Match & Scores Sync Daemon...
    call run_live_updater.bat
    goto end
)
if "%choice%"=="10" (
    echo.
    echo Launching ZetaSports Admin Portal v3 on Port 2121...
    call run_admin_v3.bat
    goto end
)
if "%choice%"=="11" (
    exit
)

:end
