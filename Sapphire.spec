# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_all

datas = [("templates", "templates"), ("static", "static"), ("uploads", "uploads")]
binaries = []
hiddenimports = []

mutagen_datas, mutagen_binaries, mutagen_hidden = collect_all("mutagen")
webview_datas, webview_binaries, webview_hidden = collect_all("webview")

datas += mutagen_datas + webview_datas
binaries += mutagen_binaries + webview_binaries
hiddenimports += mutagen_hidden + webview_hidden


a = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Sapphire",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Sapphire",
)
