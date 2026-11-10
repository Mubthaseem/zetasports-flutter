@echo off
title ZetaSports Automated Test Runner
cls
echo ======================================================================
echo              ZETASPORTS AUTOMATED TEST SUITE RUNNER
echo ======================================================================
echo.

echo [1/7] Running Functional Navigation Tests...
node project/tests/functional/test_user_flows.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [2/7] Running Supabase Integration API Tests...
node project/tests/integration/test_supabase_api.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [3/7] Running Backend Data and Security Integration Tests...
node project/tests/integration/test_backend_data_integration.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [4/7] Running Security and Sanitization Tests...
node project/tests/security/test_security_sanitization.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [5/7] Running Logic and Edge Case Tests...
node project/tests/logic/test_logic_edge_cases.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [6/7] Running Date Boundaries and Leap Year Tests...
node project/tests/logic/test_date_boundaries.cjs
if %errorlevel% neq 0 goto fail

echo.
echo [7/7] Running Responsive Viewport Tests...
node project/tests/responsive/test_responsive_viewports.cjs
if %errorlevel% neq 0 goto fail

echo.
echo ======================================================================
echo  [SUCCESS] ALL 7 AUTOMATED TEST SUITES PASSED!
echo ======================================================================
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] One or more tests failed! Check output above.
pause
exit /b 1
