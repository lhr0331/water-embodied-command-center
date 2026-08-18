@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm install
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
node scripts\operator-launcher.mjs
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo 首次部署未完成，请记录上方错误信息后联系系统管理员。
pause
