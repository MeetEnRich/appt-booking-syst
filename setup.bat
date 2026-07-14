@echo off
title FULafia Appointment Portal Setup
echo ========================================================
echo FULAFIA APPOINTMENT PORTAL - INITIAL PROJECT SETUP
echo ========================================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js (LTS version recommended) from https://nodejs.org/
    echo and run this setup script again.
    echo.
    pause
    exit /b 1
)

echo [1/3] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install root dependencies.
    pause
    exit /b 1
)

echo.
echo [2/3] Installing frontend and backend dependencies...
call npm run install:all
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install package dependencies.
    pause
    exit /b 1
)

echo.
echo [3/3] Seeding the SQLite database...
call npm run seed
if %errorlevel% neq 0 (
    echo [ERROR] Database seeding failed.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo SETUP COMPLETED SUCCESSFULLY!
echo ========================================================
echo You can now start the application by running "start.bat"
echo.
pause
