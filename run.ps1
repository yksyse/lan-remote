# LAN Remote Server PowerShell Launcher
Set-Location -Path $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  LAN Remote Control Server - Starting..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

python -m pip install -r requirements.txt --quiet --disable-pip-version-check
python server.py
