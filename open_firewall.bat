@echo off
title Open Windows Firewall for LAN Remote
echo ==========================================================
echo   Opening Port 8080 in Windows Firewall for LAN Remote...
echo ==========================================================

netsh advfirewall firewall add rule name="LAN Remote Control (Port 8080)" dir=in action=allow protocol=TCP localport=8080

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Port 8080 is now open! You can access the server from your phone.
) else (
    echo [ERROR] Please right-click this file and select 'Run as Administrator'.
)
echo.
pause
