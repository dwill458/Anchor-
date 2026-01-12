# Anchor
### *Manifesting Intent through Intelligence*

Anchor is a mobile platform that transforms abstract goals into tangible, AI-generated visual sigils. By fusing ancient sigil magick methodology with modern generative AI, Anchor allows users to embed intentions into their daily subconscious through ritualistic charging and activation.

Built with React Native (Expo 52), TypeScript, and backed by Supabase + Prisma, Anchor combines chaos magick principles from Austin Osman Spare and Phil Cooper with Stable Diffusion XL for intelligent symbol generation.

---

## 🚀 Project Status: **Phase 2.6 Complete**

**Current Version**: `v1.0.0` (anchor-v2)
**Active Development Branch**: `claude/review-phase-2.6-plan-HwN6x`
**Last Updated**: January 2026

### What's Working Now

✅ **Complete MVP** - Full anchor creation, charging, and activation flows
✅ **AI Enhancement** - Stable Diffusion XL integration with intelligent symbol selection
✅ **Emotional Intensity** - Intent formatting helpers and enhanced charging rituals
✅ **Audio Mantras** - Google TTS integration with 3 voice presets
✅ **Manual Forge** - Interactive sigil drawing canvas (anchor-v2 only)
✅ **Backend API** - Complete REST API with authentication and anchor management

---

## 🎨 Core Features

### **1. Intelligent Intention Analysis**
- Real-time intent formatting feedback
- Detects weak language patterns (want/need, will/shall, maybe/might)
- Suggests optimal phrasing (present tense, declarative statements)
- Based on Phil Cooper's methodology from "Basic Sigil Magic"

### **2. Multi-Path Sigil Creation**

#### **Traditional Path** (Phase 1)
- Austin Osman Spare's letter distillation algorithm
- Removes vowels and duplicate consonants
- 3 artistic variants: Dense, Balanced, Minimal
- Deterministic pseudo-randomness (same input = same sigil)

#### **AI-Enhanced Path** (Phase 2)
- NLP-powered intention analysis with Compromise.js
- Intelligent symbol selection from 30+ mystical archetypes
- Stable Diffusion XL generates 4 unique artistic variations
- 5 aesthetic approaches: grimoire, minimal, cosmic, geometric, organic
- Cloudflare R2 storage for generated artwork

#### **Manual Forge Path** (Phase 2.6)
- Interactive drawing canvas with touch gestures
- Real-time sigil preview
- Premium feature (subscription gated)

### **3. Enhanced Charging Rituals** (Phase 2.6)

#### **Quick Charge** (30 seconds)
- 5 dynamic emotional intensity prompts
- Progressive haptic feedback (Medium → Heavy)
- Prompts at 25s, 20s, 15s, 10s, 5s
- Smooth fade in/out animations

#### **Deep Charge** (5 minutes, 5 phases)
- Breathe & Center (30s)
- Repeat Your Intention (60s)
- Visualize Success (90s)
- Connect to Symbol (30s)
- Hold Focus (90s)
- Each phase includes emotional guidance text

### **4. Mantra Generation & Audio**
- 4 mantra styles from distilled letters:
  - Syllabic (CLO-STH-D)
  - Rhythmic (CLO / STH / D)
  - Letter-by-letter (C-L-O-S-T-H-D)
  - Phonetic (klo-seth-duh)
- Google Cloud TTS with 3 neural voice presets
- Play/pause controls with visual feedback

### **5. Activation Tracking**
- Visual activation (view sigil)
- Mantra activation (repeat mantra)
- Deep activation (full ritual)
- Streak tracking and statistics

### **6. The Vault**
- Grid view of all active anchors
- Filter by category and charge status
- Detailed anchor view with history
- Archive/delete functionality

---

## 📁 Repository Structure

```
Anchor/
├── frontend/           # Original implementation (Phase 1 + 2.6 partial)
│   └── src/
│       ├── screens/    # All UI screens
│       ├── components/ # Reusable components (IntentFormatFeedback, etc.)
│       ├── navigation/ # React Navigation setup
│       ├── theme/      # Design system (colors, typography, spacing)
│       ├── services/   # API client, auth
│       ├── stores/     # Zustand state management
│       └── utils/      # Sigil generation, helpers
│
├── anchor-v2/          # Enhanced version (Phase 1 + 2.6 complete)
│   └── src/
│       ├── screens/    # All screens + ManualForgeScreen
│       └── ...         # Same structure as frontend/
│
└── backend/            # Node.js + Express API
    └── src/
        ├── api/routes/ # REST endpoints (/auth, /anchors, /ai)
        ├── services/   # AI, TTS, Storage services
        ├── data/       # Symbol database (30+ mystical symbols)
        └── prisma/     # Database schema & migrations
```

### **Version Differences**

| Feature | frontend/ | anchor-v2/ |
|---------|-----------|------------|
| **Base Features** | ✅ Phase 1 + 2 | ✅ Phase 1 + 2 |
| **Intent Formatting** | ✅ | ✅ |
| **Emotional Priming Screen** | ✅ 15s countdown | ❌ Not used |
| **Quick Charge Intensity** | ✅ 5 prompts | ✅ 5 prompts |
| **Deep Charge Cues** | ✅ 5 phases | ✅ 5 phases |
| **Manual Forge** | ❌ Not implemented | ✅ Interactive canvas |
| **React Native** | 0.75.1 | 0.76.9 |
| **Status** | Legacy | **Active** |

**Recommended Version**: Use `anchor-v2/` for latest features.

---

## 🗺️ Development Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| **Phase 0: Foundation** | 🟢 **Complete** | Architecture, design system, navigation, database schema |
| **Phase 1: Core MVP** | 🟢 **Complete** | Authentication, sigil creation, basic charging, vault |
| **Phase 2: AI Enhancement** | 🟢 **Complete** | Intention analysis, Stable Diffusion XL, 4 AI variations, mantra generation |
| **Phase 2.5: Audio** | 🟢 **Complete** | Google TTS integration, 3 voice presets, audio playback |
| **Phase 2.6: Emotional Intensity** | 🟢 **Complete** | Intent formatting, enhanced charging rituals, Manual Forge |
| **Phase 3: Burning Ritual** | 🟡 **In Progress** | Confirm burn screen, burning animation, archive functionality |
| **Phase 4: Advanced Features** | 🔴 **Planned** | Discover feed, daily streaks, vault search/filters |
| **Phase 5: Monetization** | 🔴 **Planned** | RevenueCat subscriptions, Printful merch, premium features |
| **Phase 6: Polish & Deploy** | 🔴 **Planned** | Performance optimization, App Store submission |

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React Native 0.76.9 (Expo 52)
- **Language**: TypeScript 5.x (strict mode)
- **State Management**: Zustand
- **Navigation**: React Navigation 7.x
- **Graphics**: react-native-svg, React Native Skia (planned)
- **Animations**: Reanimated 3.x
- **Audio**: expo-av
- **Haptics**: expo-haptics
- **UI**: Custom design system (Zen Architect theme)

### **Backend**
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma 6.x
- **Authentication**: Firebase Admin SDK
- **AI**: Stable Diffusion XL (Replicate API)
- **TTS**: Google Cloud Text-to-Speech
- **Storage**: Cloudflare R2
- **NLP**: Compromise.js

### **Design System: Zen Architect**
```typescript
Colors:
- Navy Background:  #0F1419 (primary)
- Charcoal Cards:   #1A1A1D (secondary)
- Gold Primary:     #D4AF37 (CTAs, highlights)
- Bone Text:        #F5F5DC (primary text)
- Warning Orange:   #FF8C00 (intensity, emotional cues)
- Success Green:    #4CAF50 (positive feedback)

Typography:
- Headings:   Cinzel-Regular (elegant serif)
- Body:       Inter-Regular (clean sans-serif)
- Mono:       RobotoMono-Regular (technical)

Spacing Scale:
xs: 4   sm: 8   md: 16   lg: 24
xl: 32  xxl: 48 xxxl: 64
```

---

## 🚦 Getting Started

### **Prerequisites**
- Node.js 18+
- npm or yarn
- PostgreSQL (or Supabase account)
- Expo CLI: `npm install -g expo-cli`

### **Optional API Keys** (for full functionality)
- Replicate API (Stable Diffusion): https://replicate.com
- Google Cloud (TTS): https://cloud.google.com/text-to-speech
- Cloudflare R2 (Image storage): https://developers.cloudflare.com/r2

### **Installation**

1. **Clone repository**
```bash
git clone https://github.com/dwill458/Anchor-.git
cd Anchor-
```

2. **Backend setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npx prisma migrate dev
npm run dev
```

3. **Frontend setup** (use anchor-v2)
```bash
cd anchor-v2
npm install
cp .env.example .env
# Edit .env with API URL
npx expo start
```

4. **Run on device**
- Scan QR code with Expo Go (iOS/Android)
- Or press `i` for iOS Simulator, `a` for Android Emulator

See `STARTUP_GUIDE.md` for detailed instructions.

---

## 📊 Current Statistics

- **Backend API Endpoints**: 20+
- **Frontend Screens**: 23
- **Reusable Components**: 15+
- **Mystical Symbols Database**: 30+
- **Mantra Styles**: 4
- **Voice Presets**: 3
- **AI Variations per Anchor**: 4
- **Charging Modes**: 2 (Quick 30s, Deep 5min)
- **Activation Types**: 3 (Visual, Mantra, Deep)

---

## 🧪 Testing Status

### **Backend**
- ✅ Database schema validated
- ✅ API endpoints tested manually
- ⚠️ Unit tests needed

### **Frontend**
- ✅ Sigil distillation algorithm tested
- ✅ Navigation flows tested
- ✅ UI components validated
- ⚠️ E2E tests needed

### **Integration**
- ✅ Firebase authentication working
- ✅ Anchor CRUD operations working
- ✅ AI enhancement pipeline working
- ⚠️ TTS requires Google Cloud setup
- ⚠️ Stable Diffusion requires Replicate API key

---

## 📋 API Documentation

### **Authentication**
```
POST /api/auth/sync        # Create/update user after Firebase login
GET  /api/auth/me          # Get current user
PUT  /api/auth/profile     # Update user profile
```

### **Anchors**
```
POST   /api/anchors           # Create new anchor
GET    /api/anchors           # List user's anchors
GET    /api/anchors/:id       # Get anchor details
PUT    /api/anchors/:id       # Update anchor
DELETE /api/anchors/:id       # Archive anchor
POST   /api/anchors/:id/charge    # Log charge event
POST   /api/anchors/:id/activate  # Log activation event
```

### **AI Enhancement**
```
POST /api/ai/analyze           # Analyze intention, select symbols
POST /api/ai/enhance           # Generate 4 AI variations (40-80s)
POST /api/ai/mantra            # Generate mantras
POST /api/ai/mantra/audio      # Generate TTS audio
GET  /api/ai/voices            # List voice presets
GET  /api/ai/estimate          # Get time/cost estimate
```

---

## 🎯 Philosophy & Methodology

Anchor is built on three pillars:

### **1. Chaos Magick Principles** (Austin Osman Spare)
- Letter distillation to remove conscious meaning
- Overlapping, rotating, flipping letters into abstract glyphs
- "Technology of forgetting" - sigils work by bypassing conscious mind
- Charging through emotional intensity and repetition

### **2. Color Magick** (Phil Cooper)
- Present tense, declarative intention phrasing
- Emotional intensity during charging is critical
- Destruction/release after manifestation (burning ritual)
- Visual symbols as anchors for subconscious programming

### **3. Modern UX Design**
- Minimal cognitive load (distraction-free sanctuary)
- Haptic feedback for physical ritual reinforcement
- Smooth animations (60fps) for immersive experience
- Progressive disclosure (don't overwhelm new users)

---

## 🔮 Known Issues

1. **Expo fetch error on startup**: Run `npx expo start --offline` to bypass
2. **Firebase/Google Sign-In**: Requires native credentials configuration
3. **TTS Audio**: Requires Google Cloud project setup
4. **Stable Diffusion**: Requires Replicate API token ($0.01/image)
5. **Frontend/Anchor-v2 Divergence**: Two versions have different feature sets

---

## 🤝 Contributing

See `CONTRIBUTING.md` for development guidelines.

**Code Standards**:
- TypeScript strict mode
- Explicit return types
- JSDoc comments for all functions
- Comprehensive error handling
- Follow design system (no arbitrary values)
- Quality over speed

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🙏 Credits & Inspiration

- **Austin Osman Spare** - Sigil magick methodology
- **Phil Cooper** - "Basic Sigil Magic" book
- **Stable Diffusion XL** - AI art generation
- **Google Cloud TTS** - Neural voice synthesis
- **Replicate** - AI infrastructure
- **Supabase** - Backend-as-a-Service
- **Expo** - React Native development platform

---

## 📞 Contact

**Developer**: dwill458
**Repository**: https://github.com/dwill458/Anchor-
**Issues**: https://github.com/dwill458/Anchor-/issues

---

*Anchor is not just an app; it is a discipline.*
