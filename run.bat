@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Deez USB Hub

set "APP_NAME=Deez USB Hub"
set "DEV_PORT=1420"
set "PID_FILE=.run\dev.pid"

echo.
echo === %APP_NAME% - one-click setup and run ===
echo Project: %CD%
echo.

REM --- Node / npm ---
echo [1/4] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 goto :missing_node
where npm >nul 2>&1
if errorlevel 1 goto :missing_node
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo       Found !NODE_VER!

REM --- Rust / cargo (Tauri needs both) ---
echo [2/4] Checking Rust...
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
  set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)
where rustc >nul 2>&1
if errorlevel 1 goto :missing_rust
where cargo >nul 2>&1
if errorlevel 1 goto :missing_rust
for /f "tokens=*" %%v in ('rustc --version 2^>nul') do set "RUST_VER=%%v"
echo       Found !RUST_VER!
echo.

REM --- Single instance: stop only our previous owned PID tree ---
if not exist ".run" mkdir ".run"
if exist "%PID_FILE%" (
  set /p OLD_PID=<"%PID_FILE%"
  if defined OLD_PID (
    tasklist /FI "PID eq !OLD_PID!" 2>nul | findstr /R /C:"!OLD_PID!" >nul 2>&1
    if not errorlevel 1 (
      echo Stopping previous instance ^(PID !OLD_PID!^)...
      taskkill /PID !OLD_PID! /T /F >nul 2>&1
      timeout /t 1 /nobreak >nul
    )
  )
  del /F /Q "%PID_FILE%" >nul 2>&1
)

REM --- Port must be free (strictPort: 1420) ---
call :port_free %DEV_PORT%
if errorlevel 1 (
  echo ERROR: Port %DEV_PORT% is already in use by another process.
  echo Stop that process, or free the port, then double-click run.bat again.
  echo.
  pause
  exit /b 1
)

REM --- Record this launcher PID (cmd hosting this script) ---
set "LAUNCHER_PID="
for /f %%i in ('powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"ProcessId=$PID\").ParentProcessId"') do set "LAUNCHER_PID=%%i"
if not defined LAUNCHER_PID (
  echo ERROR: could not determine launcher PID.
  pause
  exit /b 1
)
>"%PID_FILE%" echo !LAUNCHER_PID!

REM --- npm install ---
echo [3/4] Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed.
  del /F /Q "%PID_FILE%" >nul 2>&1
  pause
  exit /b 1
)
echo.

REM --- Tauri dev (opens the desktop window) ---
echo [4/4] Starting Tauri dev ^(Vite on http://localhost:%DEV_PORT%^)...
echo First Rust build can take several minutes. Close this window or press Ctrl+C to stop.
echo.

call npm run tauri dev
set "EXIT_CODE=!ERRORLEVEL!"

del /F /Q "%PID_FILE%" >nul 2>&1

if not "!EXIT_CODE!"=="0" (
  echo.
  echo ERROR: tauri dev exited with code !EXIT_CODE!.
  echo Need: Node 20+, Rust stable, WebView2, and a free port %DEV_PORT%.
  echo See README.md.
  echo.
  pause
  exit /b !EXIT_CODE!
)

exit /b 0

:missing_node
echo.
echo Node.js is required but was not found on PATH.
echo Install it from https://nodejs.org ^(LTS 20+^), then double-click run.bat again.
echo.
start "" "https://nodejs.org"
pause
exit /b 1

:missing_rust
echo.
echo Rust is required but was not found on PATH.
echo Install it from https://rustup.rs , open a new terminal, then double-click run.bat again.
echo On Windows you also need the MSVC Build Tools ^(rustup prompts for them^).
echo.
start "" "https://rustup.rs"
pause
exit /b 1

:port_free
REM exit 0 if free, 1 if something is LISTENING on the port
netstat -ano 2>nul | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
if errorlevel 1 exit /b 0
exit /b 1
