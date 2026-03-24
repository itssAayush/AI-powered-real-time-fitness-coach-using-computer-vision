# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_all


project_dir = Path(SPECPATH).resolve().parent
datas = []
binaries = []
hiddenimports = []

for package_name in ("mediapipe", "cv2", "pyttsx3"):
    pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(package_name)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hiddenimports


a = Analysis(
    ["main.py"],
    pathex=[str(project_dir)],
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
    name="FitnessCoach",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="FitnessCoach",
)

app = BUNDLE(
    coll,
    name="FitnessCoach.app",
    icon=None,
    bundle_identifier="com.itssaayush.fitnesscoach",
    info_plist={
        "CFBundleShortVersionString": "1.0.0",
        "NSCameraUsageDescription": "FitnessCoach uses the camera to detect body posture, count exercise reps, and provide real-time feedback.",
    },
)
