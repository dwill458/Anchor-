# Anchor
### Forge intention into focus.

Anchor is a live iOS and Android app that turns written intentions into structured visual anchors, guided focus sessions, and repeatable daily practice.

## Live Product

- Landing page: [anchorintentions.com](https://anchorintentions.com)
- iOS App Store: [Anchor: Focus and intention](https://apps.apple.com/us/app/anchor-focus-and-intention/id6767420385)
- Google Play: [Anchor: Focus & Intention](https://play.google.com/store/apps/details?id=com.anchorintentions.app)

## Overview

Anchor helps users turn a goal into something they can return to consistently:

- Write a clear intention in plain language
- Distill that intention into a structured visual anchor
- Optionally enhance the presentation with AI while preserving the underlying geometry
- Revisit the anchor through short daily focus sessions and rituals
- Track consistency through Thread Strength instead of fragile streak mechanics

The repository powers the live product and ongoing development across mobile, backend, release operations, and supporting product infrastructure.

## Core Experience

1. Onboarding and authentication
2. Intention entry and letter distillation
3. Structure Forge with multiple visual variants
4. Optional manual reinforcement
5. Structure lock and optional AI enhancement
6. Mantra generation and audio support
7. Daily priming, activation, and ritual flows
8. Sanctuary / vault, profile, settings, and subscription management

## Repository Layout

```text
Anchor/
|-- anchor/mobile/          # Live Expo / React Native application
|-- backend/                # API, auth, AI, subscriptions, content, and order services
|-- ai-service/             # Supplemental AI service experiments
|-- docs/                   # Runbooks, release notes, product docs, and QA material
|-- design/                 # Design assets and previews
`-- archive/legacy-frontend # Archived code retained for reference
```

## Tech Stack

### Mobile

- Expo 54
- React Native 0.81.5
- TypeScript
- Zustand
- React Navigation
- Firebase Auth
- Sentry
- RevenueCat

### Backend

- Node.js
- Express
- Prisma
- PostgreSQL
- Firebase Admin
- Google AI tooling
- Cloudflare R2
- Redis
- Zod

## Local Development

### Mobile

```bash
cd anchor/mobile
npm install
npx expo start --dev-client
```

Set `EXPO_PUBLIC_API_URL` in `anchor/mobile/.env` when testing against a non-default backend target.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

The backend runs on `http://localhost:3000` by default.

## Recommended Docs

- [Startup Guide](docs/runbooks/STARTUP_GUIDE.md)
- [Contributing](CONTRIBUTING.md)
- [Backend README](backend/README.md)
- [Mobile README](anchor/mobile/README.md)
- [Mobile Testing](anchor/mobile/TESTING.md)
- [Mobile Monitoring](anchor/mobile/MONITORING.md)

## License

Proprietary. All rights reserved.
