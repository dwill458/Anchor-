# Contributing to Anchor

## ⚠️ IMPORTANT: Project Directory

**All code changes must be made in the `/anchor/mobile/` directory.**

This repository contains multiple directories, but **only `/anchor/mobile/` (Anchor v2) is the active, production codebase**:

```
Anchor/
├── anchor/
│   └── mobile/         ← ✅ ACTIVE PROJECT v2 - Make all changes here
├── archive/
│   └── legacy-frontend/← ❌ ARCHIVED - Do not use
├── backend/            ← Backend API (separate deployment)
└── ...
```

## Why?

- `/anchor/mobile/` is the production-ready React Native project (Expo 52) that runs on devices.
- `/archive/legacy-frontend/` was an earlier version and is no longer maintained.
- Changes to `/archive/legacy-frontend/` will NOT appear in the app.

## Development Workflow

1. **Clone the repository**
   ```bash
   git clone https://github.com/dwill458/Anchor-.git
   cd Anchor-
   ```

2. **Navigate to the active project**
   ```bash
   cd anchor/mobile
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npx expo start --clear
   ```

5. **Make your changes** in `anchor/mobile/src/`

6. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin your-branch-name
   ```

## Directory Structure (anchor/mobile)

```
anchor/mobile/src/
├── components/         # Reusable UI components
├── screens/
│   ├── create/         # Anchor creation flow
│   ├── rituals/        # Charging and activation screens
│   └── vault/          # Anchor storage and management
├── theme/              # Colors, typography, spacing
├── utils/              # Helper functions
└── navigation/         # React Navigation setup
```

## Code Style

- Follow existing patterns in the codebase
- Use the design system from `@/theme` (colors, spacing, typography)
- No arbitrary values - use the spacing scale (xs, sm, md, lg, xl, xxl, xxxl)

## Questions?

Open an issue or contact the maintainer.
