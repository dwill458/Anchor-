# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anchor** is a React Native/Expo mobile app that transforms user intentions into sigils, rituals, and daily practice through AI-enhanced creation flows. The repo is a monorepo with three active components:

- `/anchor/mobile/` — React Native/Expo app (primary active codebase)
- `/backend/` — Node.js/Express API server
- `/ai-service/` — Python service for structure-preserving AI enhancement
- `/archive/legacy-frontend/` — **Deprecated. Do not use or modify.**

Target release: June 1, 2026 (v1.0.2).

---

## Commands

### Mobile (`anchor/mobile/`)

```bash
npm install
npx expo start --dev-client   # dev server
npm run android               # run on Android emulator
npm run ios                   # run on iOS simulator
npm test                      # Jest tests
npm run test:coverage         # tests with coverage report
npx tsc --noEmit              # type-check only
```

### Backend (`backend/`)

```bash
npm install
cp .env.example .env          # first-time setup
npm run prisma:migrate        # apply DB migrations
npm run dev                   # dev server (ts-node watch)
npm test                      # Jest tests
npm run lint                  # ESLint
npm run type-check            # tsc --noEmit
```

### Running a single test

```bash
# Mobile or Backend
npx jest path/to/file.test.ts
npx jest --testNamePattern="test name"
```

Coverage thresholds are enforced at 70% statements/lines, 60% branches.

---

## Architecture

### Mobile App

**Entry**: `App.tsx` → `RootNavigator`

Navigation is split into auth-gated flows:
- **Onboarding** — initial setup
- **Paywall** — RevenueCat subscription gate
- **Main tabs** — Home, Vault, Practice, Profile

State is managed via **Zustand** stores in `src/stores/`. Each store owns a domain slice (auth, anchors, practice, etc.). There is no Redux.

Key directories under `src/`:
- `screens/` — screen components, one file per screen
- `components/` — shared UI (many use React Native Skia for canvas drawing)
- `services/` — API client, Firebase, RevenueCat, analytics
- `hooks/` — custom hooks wrapping stores and services
- `utils/` — pure helpers

The API client in `services/` targets `EXPO_PUBLIC_API_URL` (set in `.env` for device testing).

Auth is Firebase. The mobile app syncs the Firebase token to the backend via `POST /api/auth/sync`.

### Backend

**Entry**: `src/index.ts` → Express app with Sentry, rate limiting, and global error handler.

Routes under `src/api/routes/`:
- `auth` — sync, me, profile, settings, export, delete
- `anchors` — CRUD, charge, activate, burn
- `ai` — enhance, enhance-controlnet, mantra, mantra/audio, voices, estimate, health
- `practice` — stabilize
- `orders`, `content` (flagging)

Services under `src/services/`:
- `AIEnhancer` — orchestrates AI enhancement; primary provider is **Google Vertex AI / Gemini**, fallback is **Replicate**
- `GoogleVertexAI`, `GoogleImagenV3` — image generation
- `MantraGenerator` — text generation
- `StorageService` — Cloudflare R2 for media assets
- `TTSService` — Google Cloud Text-to-Speech

**Database**: PostgreSQL via Prisma. Schema is in `prisma/schema.prisma`. Run `npm run prisma:migrate` after schema changes. Key models: `User`, `Anchor`, `Activation`, `Charge`, `Order`, `BurnedAnchor`, `FlaggedContent`, `SyncQueue`.

**Redis** is used for caching and rate limiting.

### AI Service (`ai-service/`)

Python service that wraps ControlNet-style image enhancement to preserve sigil structure while applying AI styling. Called by the backend `ai/enhance-controlnet` route.

---

## Key Configuration

- **Mobile env**: `anchor/mobile/.env` (copy from `.env.example`). `EXPO_PUBLIC_API_URL` must point to your running backend when testing on a device.
- **Backend env**: `backend/.env`. Requires Google Vertex AI credentials, Cloudflare R2 keys, Firebase Admin SDK, Redis URL, PostgreSQL URL.
- **Feature flags**: `ENABLE_MERCH=false` disables merch by default. `MOCK_AUTH` must be off in production.
- **Sentry**: Configured in both mobile and backend with PII scrubbing enabled.

---

## CI/CD

GitHub Actions (`.github/workflows/`):
- `ci.yml` — runs on push/PR to `main`: backend type-check → lint → test; mobile type-check → test
- `eas-build.yml` — triggers EAS builds; preview builds on `main`, production builds on semver tags; auto-submits production builds to App Store / Play Store

TypeScript strict mode is enforced across both mobile and backend.

---

## Development Notes

- Refer to `/docs/runbooks/STARTUP_GUIDE.md` for first-time environment setup.
- All sigil/ritual creation flows live in `anchor/mobile/src/screens/` — the core product loop is: onboarding → anchor creation → AI enhancement → ritual → vault → practice.
- Skia is used for canvas-based sigil rendering; changes to drawing logic require testing on a real device or simulator, not just in the test suite.
- Google Vertex AI is the primary AI provider. If quota is hit, the backend falls back to Replicate automatically.
