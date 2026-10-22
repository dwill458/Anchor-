# Anchor 2.0 isolation architecture

Anchor 2.0 is a parallel product layer. Anchor 1.5 remains the shipping application until a separately approved cutover.

## Directory and dependency boundary

The mobile V2 namespace is under `anchor/mobile/src`:

- `components/v2/{primitives,anchor,thread,navigation}`
- `theme/v2` (tokens only; it does not alter `theme/colors.ts` or legacy typography)
- `screens/v2/{home,practice,progress,anchors,creation,chart,vision,onboarding,auth,paywall,settings,release}`
- `navigation/v2` (`AnchorV2Navigator`, routes, and types)
- `stores/v2`, `hooks/v2`, and `constants/v2`

Production code may consume existing stable shared utilities. It must not import any V2 UI namespace. The `npm run test:v2-boundary` check scans protected production component, screen, theme, and navigation trees for V2 imports. V2 code may reuse stable lower-level APIs, authentication, audio, SVG/Skia, and Course/Waypoint services without copying them.

## Development entry

`EXPO_PUBLIC_ANCHOR_V2_ENABLED=false` is the default. `App.tsx` selects `AnchorV2Navigator` only when both `__DEV__` and that flag are true. Release builds always select `RootNavigator`, even if the environment variable is accidentally true.

To enter V2 locally, set `EXPO_PUBLIC_ANCHOR_V2_ENABLED=true` in the local mobile environment and restart Expo. To return to production, set it to `false` (or remove it) and restart. The current shell is deliberately only `V2DevelopmentHome`; it is not a migrated Home screen. V2 typography uses Bricolage Grotesque and Figtree alongside legacy Cinzel/Inter.

## Protected legacy files

The protected production paths inspected before this work were:

- `anchor/mobile/App.tsx`
- `src/navigation/{RootNavigator,MainTabNavigator,VaultStackNavigator,PracticeStackNavigator,ChartStackNavigator}.tsx`
- `src/theme/*`
- `src/screens/vault/VaultScreen.tsx` and `src/screens/practice/PracticeScreen.tsx`
- `src/stores/*`
- `src/services/RevenueCatService.ts`

Only `App.tsx` has a minimal V2 entry selector. None of the production navigators, screens, theme files, stores, or billing service were changed for V2 UI work.

## Backend versioning and safety gates

New contracts are mounted under `/api/v2`: `/api/v2/billing/trial/activate` and `/api/v2/thread/completions/:sessionId`. Existing routes retain their legacy contract.

`ALLOW_LEGACY_DESTRUCTIVE_RELEASE` defaults to false because absence is not equal to explicit approval. `POST /api/anchors/:id/burn` rejects before its transaction with `DESTRUCTIVE_RELEASE_DISABLED`. Workstream J must replace it with an idempotent, non-destructive release lifecycle; no such lifecycle is introduced here.

## Trial lifecycle

`users.trialStartedAt` is nullable with no default. Existing populated values are not updated. The semantic states are `NOT_STARTED`, `ACTIVE`, and `EXPIRED`; `null` is never treated as expired. The V2 activation route authenticates the caller, ignores a supplied timestamp, conditionally sets the timestamp exactly once, and returns the current server trial state plus server-resolved entitlement information. Store entitlements remain RevenueCat-authoritative.

## Thread authority migration

`ThreadStrengthService` uses canonical persisted practice sessions as facts and records V2 movements in `thread_v2_movements`, keyed uniquely by session ID. It recomposes movements in completion order inside a serializable transaction so retry and offline replay cannot double-award. `THREAD_V2_SHADOW=true` writes the isolated ledger without altering the legacy response; `THREAD_V2_AUTHORITY=true` additionally returns the V2 movement from the legacy practice endpoint and enables the V2 endpoint. Both are false by default.

The V2 service reproduces the current mobile default policy (balanced sensitivity, no rest days, build-on-rest) and existing gains (Focus 25, Deep Prime/Visualize 40, Release 25). Per-user Thread preferences are still mobile-only and are the remaining blocker to an exact per-user server cutover. No new progression mathematics was introduced.

## What is authoritative today

- Production navigation, UI, legacy Thread display, Course/Waypoint, RevenueCat purchase verification, Firebase auth, audio, and creation engines remain production-authoritative.
- V2 trial state is server-authoritative.
- V2 Thread movement is server-authoritative only when its authority flag is explicitly enabled; otherwise it is a shadow ledger.
- No screen, paywall, release UI, onboarding, or production navigation has been cut over.

## Migration safety

`20260907000000_anchor_v2_safety_foundation` only relaxes `trialStartedAt` constraints and creates new Thread V2 tables/indexes/foreign keys. It does not reset data, rewrite migration history, drop columns, or null existing trial timestamps.
