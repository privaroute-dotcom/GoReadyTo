@echo off
cd /d "%~dp0"
echo Installing WorkProof packages (first run only)...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed. Check that Node.js 22+ is installed and try again.
  pause
  exit /b 1
)
echo.
echo Starting WorkProof...
call npm run dev
pause
