@echo off
title FULafia Appointment Portal Dev Server
echo ========================================================
echo STARTING FULAFIA APPOINTMENT PORTAL
echo ========================================================
echo.

:: Check if setup has been run
if not exist "node_modules\" (
    echo [ERROR] Root node_modules not found.
    echo Please run "setup.bat" first to install dependencies and seed the database.
    echo.
    pause
    exit /b 1
)

if not exist "backend\node_modules\" (
    echo [ERROR] Backend node_modules not found.
    echo Please run "setup.bat" first to install dependencies.
    echo.
    pause
    exit /b 1
)

if not exist "frontend\node_modules\" (
    echo [ERROR] Frontend node_modules not found.
    echo Please run "setup.bat" first to install dependencies.
    echo.
    pause
    exit /b 1
)

echo Starting development servers (Vite + Express)...
echo.
call npm run dev
