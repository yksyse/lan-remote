@echo off
title LAN Remote Control Server
cd /d "%~dp0"

echo ===================================================
echo   LAN Remote Control Server - Starting...
echo ===================================================

python -m pip install -r requirements.txt --quiet --disable-pip-version-check
python server.py

pause
