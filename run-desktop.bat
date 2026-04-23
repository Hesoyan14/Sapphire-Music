@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "VENV_DIR=.venv312"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "PIP_MARKER=%VENV_DIR%\.deps_installed"

echo [Sapphire] Preparing desktop environment...

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python launcher ^(py^) not found.
  echo Install Python 3.12 from https://www.python.org/downloads/
  echo and enable "Add python.exe to PATH".
  pause
  exit /b 1
)

py -3.12 -c "import sys; print(sys.version)" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3.12 is not installed.
  echo Install Python 3.12 and run this file again.
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

if not exist "%PIP_MARKER%" (
  echo [2/4] Upgrading pip...
  "%VENV_PY%" -m pip install --upgrade pip
  if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip.
    pause
    exit /b 1
  )

  echo [3/4] Installing desktop dependencies...
  "%VENV_PY%" -m pip install -r requirements-desktop.txt
  if errorlevel 1 (
    echo [ERROR] Failed to install desktop dependencies.
    pause
    exit /b 1
  )

  type nul > "%PIP_MARKER%"
) else (
  echo [2/4] Dependencies already installed.
)

echo [4/4] Starting desktop app...
"%VENV_PY%" desktop.py
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
  echo.
  echo [ERROR] desktop.py exited with code %APP_EXIT%.
  pause
)

endlocal & exit /b %APP_EXIT%
