---
description: Start the full development environment (Backend, Emulator, and Expo)
---

# Start Development Environment

Follow these steps to get the full Anchor environment running:

1. **Start Backend Server**
   ```bash
   cd backend
   # In a new terminal
   npm run dev
   ```

2. **Start Android Emulator**
   ```bash
   # Find your emulator path (usually C:\Users\dwill\AppData\Local\Android\Sdk\emulator\emulator.exe)
   # List AVDs if needed: emulator -list-avds
   emulator -avd Medium_Phone_API_36.1
   ```

3. **Start Expo Metro Bundler**
   ```bash
   cd anchor/mobile
   # In a new terminal
   npm start
   ```

// turbo-all
4. **Health Check**
   - Backend: http://localhost:8000/health
   - Expo: http://localhost:8081 (default)
