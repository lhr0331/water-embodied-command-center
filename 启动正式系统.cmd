@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts\operator-launcher.mjs
if errorlevel 1 pause
