---
description: Start the full development environment (Backend and Expo for iOS)
---

# Start Development Environment

Follow these steps to get the full Anchor environment running on Mac for iOS development:

## Prerequisites (one-time setup)
- Node.js installed via nvm (already done)
- CocoaPods installed (already done)
- `GoogleService-Info.plist` placed at `anchor/mobile/GoogleService-Info.plist`
- iOS native project generated via `expo prebuild` (see Setup section below)

## First-time iOS Setup
```bash
# Load Node
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"

# Generate native iOS project
cd anchor/mobile
npx expo prebuild --platform ios --no-install

# Install CocoaPods dependencies
cd ios
pod install

# Open in Xcode
open Anchor.xcworkspace
```

## Daily Development

1. **Start Backend Server**
   ```bash
   export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
   cd /Users/mahoganyndione/Documents/Anchor-/backend
   npm run dev
   ```

2. **Start Expo Metro Bundler**
   ```bash
   export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
   cd /Users/mahoganyndione/Documents/Anchor-/anchor/mobile
   npm start
   ```

3. **Run on iOS Simulator or Device**
   - Open `anchor/mobile/ios/Anchor.xcworkspace` in Xcode
   - Select your target device (simulator or physical iPhone)
   - Press ⌘R to build and run

// turbo-all
4. **Health Check**
   - Backend: http://localhost:8000/health
   - Expo: http://localhost:8081 (default)
