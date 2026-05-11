#!/bin/bash
# Anchor App - APK Build Script
# Run this on your local machine with Android SDK installed

set -e

echo "==================================="
echo "  Anchor App APK Build Script"
echo "==================================="

# Check prerequisites
echo ""
echo "[1/6] Checking prerequisites..."

# Check Java
if ! command -v java &> /dev/null; then
    echo "ERROR: Java not found. Install JDK 17+"
    echo "  macOS: brew install openjdk@17"
    echo "  Ubuntu: sudo apt install openjdk-17-jdk"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "  Java version: $JAVA_VERSION"

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    # Try common locations
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    else
        echo "ERROR: ANDROID_HOME not set"
        echo "  Install Android Studio or set ANDROID_HOME manually"
        exit 1
    fi
fi
echo "  Android SDK: $ANDROID_HOME"

# Check for platform-tools
if [ ! -d "$ANDROID_HOME/platform-tools" ]; then
    echo "ERROR: Android platform-tools not found"
    echo "  Run: sdkmanager 'platform-tools'"
    exit 1
fi

echo "  Prerequisites OK!"

# Install dependencies
echo ""
echo "[2/6] Installing dependencies..."
npm install

# Run prebuild
echo ""
echo "[3/6] Running Expo prebuild..."
npx expo prebuild --platform android --clean

# Build debug APK
echo ""
echo "[4/6] Building debug APK..."
cd android
./gradlew assembleDebug

# Find APK
echo ""
echo "[5/6] Locating APK..."
APK_PATH=$(find . -name "*.apk" -path "*/debug/*" | head -1)
if [ -z "$APK_PATH" ]; then
    echo "ERROR: APK not found"
    exit 1
fi

# Copy to project root
cp "$APK_PATH" ../anchor-debug.apk
cd ..

echo ""
echo "[6/6] Build complete!"
echo ""
echo "==================================="
echo "  APK Location: ./anchor-debug.apk"
echo "==================================="
echo ""
echo "To install on emulator:"
echo "  adb install anchor-debug.apk"
echo ""
echo "To install on connected device:"
echo "  adb -d install anchor-debug.apk"
echo ""
