#!/bin/zsh
set -eu
cd "${0:A:h}"
APP="$PWD/build/Liveline.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
xcrun swiftc Sources/main.swift -o "$APP/Contents/MacOS/Liveline" -framework Cocoa -framework WebKit -framework Security -O
cp Resources/* "$APP/Contents/Resources/"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>Liveline</string><key>CFBundleDisplayName</key><string>Liveline</string><key>CFBundleIdentifier</key><string>app.liveline.desktop</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleExecutable</key><string>Liveline</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleIconFile</key><string>AppIcon</string><key>NSHighResolutionCapable</key><true/><key>LSMinimumSystemVersion</key><string>13.0</string></dict></plist>
PLIST
codesign --force --sign - "$APP"
if [[ "${1:-}" == "--install" ]]; then
  DEST="$HOME/Applications/Liveline.app"
  mkdir -p "$HOME/Applications"
  ditto "$APP" "$DEST"
  open "$DEST"
fi
