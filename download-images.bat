@echo off
cd /d "%~dp0"
echo Downloading EVDANCE and Golden Maple product images...
echo Working directory: %cd%
echo.
node scripts\download-partner-images.mjs
echo.
echo Exit code: %errorlevel%
echo Done. Press any key to close this window.
pause
