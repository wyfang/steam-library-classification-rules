@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0remove-legacy-steam-collections.ps1" -SteamPath "C:\Steam"
set "cleanup_exit_code=%ERRORLEVEL%"
echo.
if not "%cleanup_exit_code%"=="0" echo Cleanup failed. Read the message above before closing this window.
pause
exit /b %cleanup_exit_code%
