# 🎯 Start Here - Anchor Project Guide

## What is Anchor?

Anchor is a production-ready mobile platform that transforms abstract goals into tangible, AI-generated visual sigils. Built with React Native (Expo 52) and backed by Supabase + Prisma, it fuses ancient sigil magick methodology from Austin Osman Spare and Phil Cooper with modern Stable Diffusion XL for intelligent symbol generation. Users embed intentions into their daily subconscious through ritualistic charging and activation.

---

## 🗂️ Repository Structure

### ✅ Current & Active

| Directory | Purpose | Status |
|-----------|---------|--------|
| **`/apps/mobile/`** | **Current mobile app** (React Native + Expo 52) | 🟢 **Production-ready** |
| **`/backend/`** | **API server** (Node.js + Express + Prisma) | 🟢 **Active** |

### 🧟 Legacy Code

| Directory | Purpose | Status |
|-----------|---------|--------|
| **`/legacy/frontend/`** | Original frontend implementation | ⚠️ **Deprecated - Do not use** |

See `/legacy/frontend/README.md` for details on why this code is archived.

### 📚 Documentation

| Directory | Contents |
|-----------|----------|
| **`/docs/prs/`** | Pull request documentation (13 files) |
| **`/docs/product/`** | Product handoff documents & flows (PDFs) |
| **`/docs/sessions/`** | Development session summaries |
| **`/docs/runbooks/`** | Setup and operational guides |

### 🎨 Design Assets

| Directory | Contents |
|-----------|----------|
| **`/design/previews/`** | Interactive HTML previews of UI components |

---

## 🚀 Quick Start

### Run the Mobile App

```bash
cd apps/mobile
npm install
cp .env.example .env  # Configure your environment
npx expo start
```

See **`/docs/runbooks/STARTUP_GUIDE.md`** for detailed setup instructions.

### Run the Backend API

```bash
cd backend
npm install
cp .env.example .env  # Add your credentials
npx prisma migrate dev
npm run dev
```

---

## 📖 Key Documentation

### Essential Reading

1. **[Main README](/README.md)** - Complete project overview, tech stack, roadmap
2. **[Product Handoff](/docs/product/Anchor_App_Comprehensive_Handoff_Document.pdf)** - Original product specification
3. **[Startup Guide](/docs/runbooks/STARTUP_GUIDE.md)** - Detailed setup instructions
4. **[Mobile App Details](/apps/mobile/README.md)** - Current mobile app specifics

### For Developers

- **[Testing Guide](/apps/mobile/TESTING.md)** - How to write and run tests (48 tests, 35% coverage)
- **[Monitoring Guide](/apps/mobile/MONITORING.md)** - Analytics, error tracking, performance monitoring
- **[Contributing Guidelines](/CONTRIBUTING.md)** - Code standards and development workflow

### For Product & Design

- **[Product Flow](/docs/product/Anchor_App_Flow_Rebranded.pdf)** - Visual flow diagram
- **[UI Previews](/design/previews/)** - Interactive component previews
- **[PR Descriptions](/docs/prs/)** - Feature implementation details

---

## 🏗️ Architecture Overview

```
Anchor/
├── apps/
│   └── mobile/          ← React Native app (Expo 52, TypeScript)
│
├── backend/             ← Node.js API (Express, Prisma, PostgreSQL)
│
├── legacy/
│   └── frontend/        ← Deprecated original implementation
│
├── docs/
│   ├── prs/             ← PR documentation
│   ├── product/         ← Product specs & flows
│   ├── sessions/        ← Development sessions
│   └── runbooks/        ← Operational guides
│
└── design/
    └── previews/        ← UI component previews
```

---

## 🎯 Current Status

**Version**: v1.0.0 (Production-ready)
**Last Audit**: January 2026 (Phase 2.7 - Mid-Month Audit)
**Code Health**: 9.0/10 (up from 5.5/10)
**Test Coverage**: 35% (48 passing tests, target: 70%)

### What's Working

- ✅ Complete MVP - Full anchor creation, charging, and activation flows
- ✅ AI Enhancement - Stable Diffusion XL integration with intelligent symbol selection
- ✅ Audio Mantras - Google TTS integration with 3 voice presets
- ✅ Manual Forge - Interactive sigil drawing canvas
- ✅ Production Monitoring - Analytics, error tracking, performance monitoring
- ✅ Accessibility - Full screen reader support (WCAG 2.1 Level A)
- ✅ Type Safety - Zero 'any' types, comprehensive interfaces

### Next Steps

See the [Development Roadmap](/README.md#-development-roadmap) in the main README for:
- Phase 3: Burning Ritual (in progress)
- Phase 4: Advanced Features (planned)
- Phase 5: Monetization (planned)
- Phase 6: Polish & Deploy (planned)

---

## ❓ Common Questions

### Which version should I use?

**Use `/apps/mobile/`** - This is the current, production-ready version with all features and improvements.

**Never use `/legacy/frontend/`** - This is archived legacy code. All valid code has been migrated.

### How do I run the app?

See `/docs/runbooks/STARTUP_GUIDE.md` for complete setup instructions.

### Where are the product specs?

- Main README: `/README.md`
- Product Handoff: `/docs/product/Anchor_App_Comprehensive_Handoff_Document.pdf`
- Feature PRs: `/docs/prs/` (13 detailed PR documents)

### How do I contribute?

See `/CONTRIBUTING.md` for code standards and development workflow.

### Where are the tests?

- Test files: `/apps/mobile/src/__tests__/` and component `__tests__/` folders
- Testing guide: `/apps/mobile/TESTING.md`
- Run tests: `cd apps/mobile && npm test`

---

## 📞 Need Help?

1. Check `/README.md` for comprehensive documentation
2. Read `/CONTRIBUTING.md` for development guidelines
3. Review `/docs/runbooks/STARTUP_GUIDE.md` for setup help
4. Check `/apps/mobile/TESTING.md` or `/apps/mobile/MONITORING.md` for specific guides

---

**Welcome to Anchor - where intention meets intelligence.** 🎯✨
