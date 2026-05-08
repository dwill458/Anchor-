# Anchor
### Manifesting Intent through Intelligence

> **Status:** near-production codebase in active testing, with a target release of **June 1, 2026**
>
> **New here?** Start with [docs/runbooks/STARTUP_GUIDE.md](docs/runbooks/STARTUP_GUIDE.md)
>
> **Active mobile app:** `anchor/mobile/`
>
> **Backend API:** `backend/`
>
> **Legacy frontend:** `archive/legacy-frontend/` (deprecated)

Anchor is a mobile app for turning user intentions into sigils, rituals, and daily practice. The current codebase is built around a deterministic creation flow, optional manual reinforcement, optional AI enhancement, and a vault-centered experience for charging, activating, and revisiting anchors.

The repository is actively being tested and hardened for release. The code is functionally complete enough for production use, but the team is still validating edge cases, improving coverage, and finishing launch prep for June 1, 2026.

## What Anchor Does

- Collects and refines intentions before sigil creation
- Distills letters into deterministic structure variants
- Supports manual reinforcement of the base structure
- Locks the structure before enhancement
- Adds optional AI styling while preserving geometry
- Generates mantras and mantra audio
- Tracks charging, activation, and burning rituals
- Provides a vault, practice flow, profile/settings, onboarding, and paywall/trial flow
- Includes merch/order and content-reporting support in the backend

## Current App Flow

1. Onboarding and authentication
2. Intention entry and letter distillation
3. Structure Forge with `dense`, `balanced`, and `minimal` variants
4. Optional manual reinforcement
5. Structure lock
6. Optional style selection and AI enhancement
7. Mantra generation and reveal
8. Charging, activation, and burn flows
9. Vault, practice, profile, and settings

## Repository Layout

```text
Anchor/
├── anchor/mobile/          # Current Expo / React Native app
├── backend/                # Express + Prisma API server
├── ai-service/             # Experimental Python AI service support
├── docs/                   # Startup, product, and runbook docs
├── design/                 # Design previews and assets
├── archive/legacy-frontend # Archived frontend, do not use
└── assorted logs/artifacts  # Screenshots, test output, scratch files
```

### Active Areas

| Path | Purpose |
| --- | --- |
| `anchor/mobile/` | Current mobile app and all active UI development |
| `backend/` | Auth, anchors, practice, AI, content, and order APIs |
| `ai-service/` | Supplemental Python service for structure-preserving enhancement work |
| `archive/legacy-frontend/` | Archived code only, kept for reference |

## Tech Stack

### Mobile

- Expo 54
- React Native 0.81.5
- TypeScript in strict mode
- Zustand state management
- React Navigation
- Reanimated, Skia, SVG, haptics, and audio support
- Firebase Auth integration
- Sentry and RevenueCat support

### Backend

- Node.js 20+
- Express.js
- Prisma ORM with PostgreSQL
- Firebase Admin authentication
- Google AI / GenAI tooling
- Replicate fallback for image generation
- Google Cloud Text-to-Speech
- Cloudflare R2 storage
- Redis support
- Zod validation and structured error handling

## Core Features

### Creation Flow

- Intention input and refinement
- Letter distillation
- Deterministic structure generation
- Manual reinforcement
- Structure lock and enhancement choice
- AI style selection and structure-preserving enhancement
- Mantra generation and audio export

### Ritual Flow

- Charge setup
- Ritual execution
- Activation tracking
- Burning / archive flow

### Daily Use

- Sanctuary / vault browsing
- Practice flow with daily sessions
- Profile and settings management
- Trial and paywall handling
- Optional merch and export flows

## API Surface

### Auth

- `POST /api/auth/sync`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `PUT /api/auth/settings`
- `PUT /api/auth/notification-state`
- `GET /api/auth/me/export`
- `DELETE /api/auth/me`

### Anchors

- `POST /api/anchors`
- `GET /api/anchors`
- `GET /api/anchors/:id`
- `PUT /api/anchors/:id`
- `DELETE /api/anchors/:id`
- `POST /api/anchors/:id/charge`
- `POST /api/anchors/:id/activate`
- `POST /api/anchors/:id/burn`

### AI

- `POST /api/ai/enhance`
- `POST /api/ai/enhance-controlnet`
- `POST /api/ai/mantra`
- `POST /api/ai/mantra/audio`
- `GET /api/ai/voices`
- `GET /api/ai/estimate`
- `GET /api/ai/health`

### Practice, Orders, Content

- `POST /api/practice/stabilize`
- `POST /api/orders`
- `GET /api/orders`
- `POST /api/content/flag`

## Local Setup

### Mobile App

```bash
cd anchor/mobile
npm install
npx expo start --dev-client
```

If you are testing on a physical device, set `EXPO_PUBLIC_API_URL` in `anchor/mobile/.env` to point at your backend.

### Backend API

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

The backend runs on `http://localhost:3000` by default.

### Release Notes

- The app is in active testing and release hardening
- The current target release date is **June 1, 2026**
- Core product flows are implemented; remaining work is mostly verification, polish, and launch prep

## Testing

- Mobile: `cd anchor/mobile && npm test`
- Backend: `cd backend && npm test`
- Coverage, end-to-end checks, and device validation are still being expanded for release readiness

## Recommended Docs

- [Startup Guide](docs/runbooks/STARTUP_GUIDE.md)
- [Contributing](CONTRIBUTING.md)
- [Backend README](backend/README.md)
- [Mobile Testing](anchor/mobile/TESTING.md)
- [Mobile Monitoring](anchor/mobile/MONITORING.md)

## License

Proprietary. All rights reserved.
