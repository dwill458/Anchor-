# 🚀 Anchor App - Quick Start Guide

## Prerequisites

- Node.js 20+
- npm (not yarn or pnpm)
- For mobile testing: Expo Go app on your phone
- For Android: Android Studio with emulator
- For iOS: Xcode with iOS Simulator (Mac only)

---

## 📱 Running the Frontend

### Option 1: Expo Go on Your Phone (Easiest)

1. **Install Expo Go**:
   - iOS: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. **Start the development server**:
   ```bash
   cd apps/mobile
   npm start
   ```

   Or if network issues occur:
   ```bash
   npx expo start --offline --tunnel
   ```

3. **Scan the QR code** with Expo Go app

### Option 2: Android Emulator

```bash
cd apps/mobile
npm run android
```

### Option 3: iOS Simulator (Mac only)

```bash
cd apps/mobile
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

2. Create `apps/mobile/.env`:
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

### "Cannot connect to Metro"
```bash
cd apps/mobile
npx expo start --clear
```

### "Module not found"
```bash
cd apps/mobile
rm -rf node_modules
npm install
```

### "Port already in use"
```bash
npx expo start --port 8082
```

### "Network request failed"
- Make sure backend is running
- Check `EXPO_PUBLIC_API_URL` in apps/mobile/.env
- Try restarting both apps/mobile and backend

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

1. Start apps/mobile: `cd apps/mobile && npm start`
2. Open Expo Go on phone → Scan QR code
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
