# VS Code Handoff

Snapshot taken on 2026-05-19 for moving this workspace into VS Code without losing development flow.

## What To Open

Open the repo root: `Anchor/`

That keeps these active areas available in one workspace:

- `anchor/mobile/` - current Expo / React Native app
- `backend/` - current Node / Express / Prisma API
- `docs/` - runbooks, audits, and historical handoff notes
- `scripts/` - shared helpers, including ADB reverse monitoring
- `supabase/` - migrations and edge functions

Do not treat these as primary app entrypoints unless you are intentionally digging through history:

- `archive/legacy-frontend/`
- `anchor-v2/`

The checked-in docs consistently point to `anchor/mobile/` as the active mobile app.

## Current IDE-Specific State

- There is no committed `.vscode/` workspace config yet.
- `.claude/`, `.agent/`, and `.agents/` contain assistant/workflow metadata, not required runtime config.
- `.agent/workflows/start-dev.md` is partly stale: it still references backend health on `localhost:8000`.
- Active docs and backend startup expect the API on `http://localhost:3000`.

## Recommended VS Code Extensions

Required for this repo:

- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `expo.expo-vscode`
- `msjsdiag.vscode-react-native`
- `prisma.prisma`
- `orta.vscode-jest`
- `mobile-dev.maestro-vscode`
- `mikestead.dotenv`
- `eamodio.gitlens`

One-line install:

```powershell
code --install-extension dbaeumer.vscode-eslint --install-extension esbenp.prettier-vscode --install-extension expo.expo-vscode --install-extension msjsdiag.vscode-react-native --install-extension prisma.prisma --install-extension orta.vscode-jest --install-extension mobile-dev.maestro-vscode --install-extension mikestead.dotenv --install-extension eamodio.gitlens
```

## Recommended Settings

Use workspace or user settings close to this:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[prisma]": {
    "editor.defaultFormatter": "prisma.prisma"
  },
  "jest.rootPath": "anchor/mobile",
  "search.exclude": {
    "**/node_modules": true,
    "**/.git": true,
    "**/.git-rewrite": true,
    "**/.pr-worktree": true,
    "**/.jest-cache": true,
    "**/coverage": true,
    "**/dist": true,
    "**/android/app/build": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/**": true,
    "**/.git-rewrite/**": true,
    "**/.pr-worktree/**": true,
    "**/.jest-cache/**": true,
    "**/coverage/**": true,
    "**/dist/**": true,
    "**/android/app/build/**": true
  }
}
```

Notes:

- `anchor/mobile/` has a lot of generated logs, screenshots, and test artifacts. Excludes matter here.
- Backend has committed ESLint and Prettier config.
- Mobile relies on TypeScript path alias `@/* -> src/*`.
- Backend relies on `@/services/*`, `@/utils/*`, `@/types/*`, `@/api/*`, `@/models/*`.

## Daily Terminal Layout

Use three VS Code terminals:

1. Backend

```powershell
cd backend
npm install
npm run dev
```

2. Mobile Metro

```powershell
cd anchor/mobile
npm install
npx expo start --dev-client
```

3. Android USB reverse monitor when using a physical device

```powershell
cd anchor/mobile
npm run adb-reverse
```

`npm run adb-reverse` resolves ADB and keeps reverse forwarding active for `8081` and `8000` when devices reconnect. The app docs now expect backend traffic on `3000`, so use direct `adb reverse` manually if you also need `3000` forwarded.

## Test And Validation Commands

Mobile:

```powershell
cd anchor/mobile
npm test
npm run test:watch
npm run test:coverage
```

Backend:

```powershell
cd backend
npm test
npm run lint
npm run type-check
```

Maestro:

- Flows live in `anchor/mobile/.maestro/`
- Current checked-in flow: `anchor/mobile/.maestro/smoke.yaml`

## Secrets And Local Files

Do not lose these local setup assumptions:

- `backend/.env` exists locally and is required for real backend work
- `backend/.env.example` is the template
- `anchor/mobile/.env` exists locally for app runtime config
- `anchor/mobile/google-services.json` exists locally and is runtime-critical
- `anchor/mobile/google-services.json.example` is the template source

Do not copy secret values into editor settings or debug configs.

## Windows-Specific Caveats

- The repo path is deep enough that local Android Gradle builds can hit Windows path-length issues.
- The startup guide explicitly says to avoid `npx expo run:android` on Windows for normal dev-client setup.
- Preferred Windows path is:
  - build Android dev client with EAS when native rebuilds are needed
  - run Metro locally with `npx expo start --dev-client`
  - use `adb reverse` for device connectivity

## Current Local State At Handoff

Working tree was not clean during this scan:

- `anchor/mobile/android/app/src/main/AndroidManifest.xml`
- `anchor/mobile/android/app/src/main/res/values/strings.xml`
- `anchor/mobile/.jest-cache/haste-map-...`
- `anchor/mobile/.jest-cache/perf-cache-...`

Interpretation:

- the Android manifest and strings changes may be real in-progress work
- the `.jest-cache` files are generated noise and should not drive decisions

## Recommended First 10 Minutes In VS Code

1. Open repo root `Anchor/`.
2. Install the extensions above.
3. Apply the settings block above.
4. Start `backend` and `anchor/mobile` in separate terminals.
5. Confirm backend on `http://localhost:3000`.
6. Confirm Metro on `http://localhost:8081`.
7. If using Android USB, start `npm run adb-reverse` or run manual `adb reverse`.
8. Focus the Explorer on `anchor/mobile/`, `backend/`, and `docs/`.
9. Ignore `archive/legacy-frontend/` unless doing archaeology.
10. Treat `.claude/`, `.agent/`, and `.agents/` as assistant metadata, not app code.

## Bottom Line

VS Code can replace the current setup cleanly. The main things to preserve are:

- root-level workspace open
- `anchor/mobile` plus `backend` as the two active projects
- search and watcher excludes to cut repo noise
- Windows-safe Expo workflow
- awareness that some old agent docs still mention port `8000` while current backend runs on `3000`
