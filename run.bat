@echo off
title AutoApply AI Launcher
color 0A
cls
echo =======================================================
echo          🚀 AutoApply AI - Starting Server...
echo =======================================================
echo.

cd /d "%~dp0"

:: Check for virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating Python Virtual Environment...
    python -m venv .venv 2>nul || py -3 -m venv .venv
)

:: Install dependencies if missing
echo [2/3] Verifying dependencies from requirements.txt...
.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

:: Launch web browser after 2 seconds
echo [3/3] Launching web browser at http://127.0.0.1:3000 ...
timeout /t 2 /nobreak >nul
start http://127.0.0.1:3000

:: Run app server
.venv\Scripts\python.exe app.py
pause
