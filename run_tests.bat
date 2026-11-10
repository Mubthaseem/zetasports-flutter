@echo off
title ZetaSports Automated Test Runner
cls
echo ======================================================================
echo              ZETASPORTS AUTOMATED TEST SUITE RUNNER
echo ======================================================================
echo.

echo [1/5] Running Functional Navigation Tests...
node project/tests/functional/test_user_flows.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [2/5] Running Integration API Tests...
node project/tests/integration/test_supabase_api.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [3/5] Running Security and Sanitization Tests...
node project/tests/security/test_security_sanitization.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [4/5] Running Logic and Edge Case Tests...
node project/tests/logic/test_logic_edge_cases.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [5/5] Running Responsive Viewport Tests...
node project/tests/responsive/test_responsive_viewports.cjs
if %errorlevel% neq 0 goto fail

echo.
echo ======================================================================
echo  [SUCCESS] ALL 5 AUTOMATED TEST SUITES PASSED!
echo ======================================================================
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] One or more tests failed! Check output above.
pause
exit /b 1
