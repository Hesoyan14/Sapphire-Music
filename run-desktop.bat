@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "VENV_DIR=.venv312"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "CLOUD_URL=https://sapphire-music.onrender.com"

echo [Sapphire] Preparing desktop environment...
call :ensure_python_312
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "%VENV_PY%" (
  echo [1/4] Creating virtual environment ^(%VENV_DIR%^)...
  py -3.12 -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
  )
)

echo [2/4] Verifying dependencies...
"%VENV_PY%" -c "import requests, flask, flask_sqlalchemy, mutagen, psycopg2, boto3, webview, waitress" >nul 2>nul
if errorlevel 1 (
  echo [3/4] Installing desktop dependencies...
  "%VENV_PY%" -m pip install --upgrade pip
  if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip.
    pause
    exit /b 1
  )
  "%VENV_PY%" -m pip install -r requirements-desktop.txt
  if errorlevel 1 (
    echo [ERROR] Failed to install desktop dependencies.
    pause
    exit /b 1
  )
) else (
  echo [3/4] Dependencies are ready.
)

echo [4/4] Starting cloud desktop app...
echo [INFO] Opening %CLOUD_URL%
"%VENV_PY%" -c "import webview; webview.create_window('Sapphire', r'%CLOUD_URL%', width=1280, height=800); webview.start()"
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
  echo.
  echo [ERROR] Cloud desktop launcher exited with code %APP_EXIT%.
  pause
)

endlocal & exit /b %APP_EXIT%

:ensure_python_312
where py >nul 2>nul
if errorlevel 1 goto :install_python_312

py -3.12 -c "import sys; print(sys.version)" >nul 2>nul
if not errorlevel 1 exit /b 0

:install_python_312
echo [INFO] Python 3.12 not found. Trying automatic install via winget...
where winget >nul 2>nul
if errorlevel 1 (
  echo [ERROR] winget is not available on this system.
  echo Install Python 3.12 manually:
  echo https://www.python.org/downloads/release/python-31210/
  echo During install, enable "Add python.exe to PATH".
  exit /b 1
)

winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent
if errorlevel 1 (
  echo [ERROR] Automatic Python install failed.
  echo Install Python 3.12 manually:
  echo https://www.python.org/downloads/release/python-31210/
  echo During install, enable "Add python.exe to PATH".
  exit /b 1
)

REM Refresh current shell PATH from machine and user scopes.
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul ^| findstr /i "Path"') do set "MACHINE_PATH=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr /i "Path"') do set "USER_PATH=%%B"
if defined MACHINE_PATH set "PATH=%MACHINE_PATH%"
if defined USER_PATH set "PATH=%PATH%;%USER_PATH%"

py -3.12 -c "import sys; print(sys.version)" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3.12 was installed, but py -3.12 is still unavailable.
  echo Close this window and run run-desktop.bat again.
  exit /b 1
)
exit /b 0
