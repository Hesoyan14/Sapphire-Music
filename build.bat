@echo off
setlocal

echo [1/3] Installing desktop build dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements-desktop.txt

echo [2/3] Cleaning previous build artifacts...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo [3/3] Building Sapphire desktop executable...
python -m PyInstaller --noconfirm --clean Sapphire.spec

echo.
echo Build finished.
echo Executable: dist\Sapphire\Sapphire.exe
endlocal
