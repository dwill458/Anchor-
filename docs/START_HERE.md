# 🎯 Start Here - Anchor Project Guide

## What is Anchor?

Anchor is a near-production mobile platform that transforms abstract goals into tangible, AI-generated visual sigils. Built with React Native and backed by Prisma, it fuses sigil methodology with structure-preserving AI enhancement so users can embed intentions into a daily ritual flow.

---

## 🗂️ Repository Structure

### ✅ Current & Active

| Directory | Purpose | Status |
|-----------|---------|--------|
| **`/anchor/mobile/`** | **Current mobile app** (React Native + Expo) | 🟢 **Active & testing** |
| **`/backend/`** | **API server** (Node.js + Express + Prisma) | 🟢 **Active** |

### 🧟 Legacy Code

| Directory | Purpose | Status |
|-----------|---------|--------|
| **`/archive/legacy-frontend/`** | Original frontend implementation | ⚠️ **Deprecated - Do not use** |

See `/archive/legacy-frontend/README.md` for details on why this code is archived.

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
cd anchor/mobile
npm install
cp .env.example .env  # Configure your environment
npx expo start --dev-client
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

1. **[Main README](/README.md)** - Complete project overview, tech stack, and release status
2. **[Product Handoff](/docs/product/Anchor_App_Comprehensive_Handoff_Document.pdf)** - Original product specification
3. **[Startup Guide](/docs/runbooks/STARTUP_GUIDE.md)** - Detailed setup instructions
4. **[Mobile App Details](/docs/runbooks/STARTUP_GUIDE.md)** - Current mobile app setup and launch specifics

### For Developers

- **[Testing Guide](/anchor/mobile/TESTING.md)** - How to write and run tests
- **[Monitoring Guide](/anchor/mobile/MONITORING.md)** - Analytics, error tracking, performance monitoring
- **[Contributing Guidelines](/CONTRIBUTING.md)** - Code standards and development workflow

### For Product & Design

- **[Product Flow](/docs/product/Anchor_App_Flow_Rebranded.pdf)** - Visual flow diagram
- **[UI Previews](/design/previews/)** - Interactive component previews
- **[PR Descriptions](/docs/prs/)** - Feature implementation details

---

## 🏗️ Architecture Overview

```
Anchor/
├── anchor/
│   └── mobile/          ← React Native app (Expo, TypeScript)
│
├── backend/             ← Node.js API (Express, Prisma, PostgreSQL)
│
├── archive/
│   └── legacy-frontend/ ← Deprecated original implementation
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

**Version**: v2.0.0-stable
**Current Status**: Active testing / release hardening
**Launch Target**: June 1, 2026

### What's Working

- ✅ Complete MVP - Full anchor creation, charging, and activation flows
- ✅ AI Enhancement - Structure-preserving enhancement with style selection and validation
- ✅ Audio Mantras - Google TTS integration with 3 voice presets
- ✅ Manual Forge - Interactive sigil drawing canvas
- ✅ Production Monitoring - Analytics, error tracking, performance monitoring
- ✅ Accessibility - Full screen reader support (WCAG 2.1 Level A)
- ✅ Type Safety - Zero 'any' types, comprehensive interfaces

### Next Steps

See the main README release notes and the startup guide for the current launch checklist.

---

## ❓ Common Questions

### Which version should I use?

**Use `/anchor/mobile/`** - This is the current active mobile app.

**Never use `/archive/legacy-frontend/`** - This is archived legacy code. All valid code has been migrated.

### How do I run the app?

See `/docs/runbooks/STARTUP_GUIDE.md` for complete setup instructions.

### Where are the product specs?

- Main README: `/README.md`
- Product Handoff: `/docs/product/Anchor_App_Comprehensive_Handoff_Document.pdf`
- Feature PRs: `/docs/prs/` (13 detailed PR documents)

### How do I contribute?

See `/CONTRIBUTING.md` for code standards and development workflow.

### Where are the tests?

- Test files: `/anchor/mobile/src/__tests__/` and component `__tests__/` folders
- Testing guide: `/anchor/mobile/TESTING.md`
- Run tests: `cd anchor/mobile && npm test`

---

## 📞 Need Help?

1. Check `/README.md` for comprehensive documentation
2. Read `/CONTRIBUTING.md` for development guidelines
3. Review `/docs/runbooks/STARTUP_GUIDE.md` for setup help
4. Check `/anchor/mobile/TESTING.md` or `/anchor/mobile/MONITORING.md` for specific guides

---

**Welcome to Anchor - where intention meets intelligence.** 🎯✨
