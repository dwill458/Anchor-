# 🚀 Anchor App - Quick Start Guide

## Prerequisites

- Node.js 20+
- npm (not yarn or pnpm)
- For Android: Android Studio with emulator or a USB-connected device
- For iOS: Xcode with iOS Simulator (Mac only)
- Expo development build installed on the device (`expo-dev-client`)

---

## 📱 Running the Frontend

### Option 1: Android Dev Client (USB)

> **Windows users:** `npx expo run:android` (local Gradle build) will fail with a "Filename longer than 260 characters" error due to Windows MAX_PATH limits — the project path is too deep. Use EAS Build below instead.

#### Step 1 — Build the dev client APK (one-time, or when native deps change)

```bash
cd anchor/mobile
eas build --profile development --platform android
```

This builds on Expo's Linux servers. When done, open the link it prints on your Android phone and install the APK.

#### Step 2 — Start Metro

```bash
cd anchor/mobile
npx expo start --dev-client
```

#### Step 3 — Set up USB tunnel (Windows)

adb is at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`. Run after plugging in:

```bash
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

#### Step 4 — Connect the app

Open the Anchor dev build on your phone. If Metro doesn't appear under "Development servers", tap **Enter URL manually** → `http://localhost:8081`.

#### When do you need to rebuild the APK via EAS?

- You added/removed a native package (`expo install`, `npm install` for anything with native code)
- You changed `app.json` (icons, permissions, scheme)
- The dev client crashes immediately on launch with "Unable to load script" even when Metro is running

### Option 2: Android Emulator

```bash
cd anchor/mobile
npm run android
```

### Option 3: iOS Simulator (Mac only)

```bash
cd anchor/mobile
npm run ios
```

---

## 🔧 Running the Backend

The backend API is required for AI features to work:

```bash
cd backend
npm install
npm run dev
```

The API will run on `http://localhost:3000`

---

## 🌐 Connecting Frontend to Backend

If testing on a **physical device** (not emulator):

1. Find your computer's IP address:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet "

   # Windows
   ipconfig
   ```

2. Create `anchor/mobile/.env`:
   ```bash
   EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000
   ```

   Replace `YOUR_COMPUTER_IP` with your actual IP (e.g., `192.168.1.5`)

---

## 🔑 Optional: Enable AI Features

### Stable Diffusion (Required for AI Enhancement)

Create `backend/.env`:
```bash
REPLICATE_API_TOKEN=r8_your_token_here
```

Get a token from: https://replicate.com/account/api-tokens

### Cloudflare R2 (Required for Image Storage)

Add to `backend/.env`:
```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=anchor-assets
CLOUDFLARE_R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
```

### Google TTS (Optional for Audio Playback)

Add to `backend/.env`:
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_PRIVATE_KEY=your-private-key
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account-email
```

---

## 🐛 Troubleshooting

### "Cannot connect to Metro" / "Unable to load script"

First, verify Metro is actually running:
```bash
curl http://localhost:8081/status   # should return: packager-status:running
```

Then re-run `adb reverse` (Windows path):
```bash
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

If Metro is up and adb reverse is set but the dev launcher still shows the error screen, the **native APK is stale** — rebuild via EAS:
```bash
cd anchor/mobile
eas build --profile development --platform android
```

After installing the new APK, open it, tap **Enter URL manually** → `http://localhost:8081`.

### "Filename longer than 260 characters" (Windows Gradle build)

Do NOT use `npx expo run:android` or `npm run android` on Windows — the project path is too deep for Windows MAX_PATH. Always use `eas build` for native builds.

### "Module not found"
```bash
cd anchor/mobile
Remove-Item -Recurse -Force node_modules
npm install
```

### "Port already in use"
```bash
npx expo start --port 8082
```

### "Network request failed"
- Make sure backend is running
- Check `EXPO_PUBLIC_API_URL` in anchor/mobile/.env
- Try restarting both `anchor/mobile` and `backend`

### "Expo fetch failed"
```bash
npx expo start --offline
```

---

## ✅ Testing Without Backend/APIs

The app gracefully handles missing services:

- ❌ No backend → Shows "Connection error" on API calls
- ❌ No Replicate → Can't generate AI variations (can use traditional sigils)
- ❌ No R2 → Images won't be stored (still work in-memory)
- ❌ No TTS → Audio buttons show "Not Available"

All these features are **optional** for testing the UI/UX!

---

## 📦 What's Implemented

✅ **Phase 1**: Authentication, traditional sigils, charging, activation
✅ **Phase 2**: AI enhancement, symbol selection, Stable Diffusion
✅ **Phase 2.5**: Audio playback with Google TTS

🔜 **Phase 3**: Manual Forge, burning ritual, discover feed
🔜 **Phase 4**: RevenueCat subscriptions, Printful merch

---

## 🎯 Quick Test Flow

1. Start mobile app: `cd anchor/mobile && npx expo start --dev-client --clear`
2. Open the installed Anchor development build
3. Create account (fake email works fine)
4. Create your first anchor:
   - Enter intention: "Close the deal"
   - Select sigil style
   - Choose "Keep Traditional" (works without backend)
   - Generate mantra
   - Charge anchor
   - Activate!

---

**Questions?** Check the PR description or handoff document for full details!
