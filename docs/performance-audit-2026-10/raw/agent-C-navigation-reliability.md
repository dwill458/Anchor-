# Agent C: Navigation and Reliability audit (read-only)

Repo: `E:\Projects\Anchor` (mobile in `anchor/mobile/src`, backend in `backend/src`), branch `feat/celebration-layer` with uncommitted changes. Audit date 2026-10-12.

Method: static reading only. Nothing was run on a device or emulator; no jest/tsc was run for this report. Every item is evidence type **code suspected** unless marked **verified-by-grep** (a fact about the source that was confirmed by search, such as a URL mismatch against the server's mounted route). Nothing below is a measurement. "Confidence" is the likelihood the failure sequence is real as described.

Line numbers refer to the files as they are in the working tree today. `App.tsx` means `anchor/mobile/App.tsx`; every other path is relative to `anchor/mobile/src`.

Not re-reported because the dev notes mark them fixed or known: first-anchor account gate layers, creation draft re-entry guard, Release 1.1 sync tombstones, V2 navigation perf pass traps, anchor transition blank-frame fix, `runOnJS` gotcha, 401-has-no-sign-out watchlist (referenced once as C-22 because it compounds other items).

Note on stale memory: `project_v2_creation_persistence_and_gate.md` says `navigation/v2/createAnchorGate.ts` returns `allowed|paywall|unknown`. That file does not exist in the tree. The live gate is `hooks/v2/paywall/useV2AnchorCreationGate.ts`, which counts local active anchors only and has no "unknown while hydrating" state. Server enforcement is unchanged.

---

## 1. Screen and interaction inventory

### 1.1 Which navigator runs

`App.tsx:1065` renders `AnchorV2Navigator` when `isAnchorV2Enabled(...)` is true (opt-in; dev builds and staging previews), otherwise legacy `RootNavigator`. Per `App.tsx:110-117` and the dev notes, production builds are still the legacy navigator. Both trees are inventoried because both are reachable by shipped binaries. There is no `linking` prop on `NavigationContainer`; deep links are hand-parsed (see 1.6). One root `ErrorBoundary` wraps everything (`App.tsx:1011`), and `V2DialogHost` is rendered once at the root (`App.tsx:1079`) with `Alert.alert` globally replaced by `V2DialogManager.installAlertBridge()` (`App.tsx:54`), in BOTH navigator modes.

### 1.2 Anchor 2.0: `AnchorV2Navigator` (single native-stack, `navigation/v2/AnchorV2Navigator.tsx`)

The stack is re-created (full remount, state lost) whenever its `key` changes (line 557): `${initialRouteName}:${...user id | 'guest-home' | 'onboarding-save' | 'guest'}`. `initialRouteName` is `V2DevelopmentHome` when `hasSession && hasCompletedOnboarding` (or dev bypass), else `V2FirstRun` (lines 551-553).

| Route | Component / file | Entry paths | Transition / options |
|---|---|---|---|
| `V2FirstRun` | `screens/v2/onboarding/V2FirstRunFlow.tsx` (steps: `V2OnboardingJourney` -> `IntentionInputScreen` -> creation flow -> `V2SealedSaveScreen`) | initial route when not onboarded; `V2Auth` onSuccess without completed onboarding; reset after sign-out | default `v2StackScreenOptions` |
| `V2DevelopmentHome` | `screens/v2/home/V2DevelopmentHome.tsx`, hosts nested `V2DailyShellNavigator` (`V2Home` = `V2HomeScreen`, `V2AnchorLibrary`, `V2AnchorDetails`) in `screens/v2/home/dailyShell.tsx` | initial route; `reset` after onboarding/auth; practice/release/creation hand-offs `popToTop`/`navigate`; notification dispatch | root of stack; `releaseHomeScreenOptions` (iOS fade only for release return) |
| `V2AnchorLibrary` / `V2AnchorDetails` (also registered in root stack) | `screens/v2/anchors/*` | Home, release "view history" `replace` | Details: paper bg, `animation: 'none'` (hero flight owns motion) |
| `FirstAnchorCreation` | `screens/create/IntentionInputScreen.tsx` | Home Create CTA (gate), onboarding step, paywall `create_anchor` resume, Evolve `push` | `fade_from_bottom` |
| `AnchorCreationFlow` | `screens/create/flow/AnchorCreationFlowScreen.tsx` | from `IntentionInputScreen` after 150 ms measure fallback | `fade`, `gestureEnabled:false`; hardware back swallowed during `sealing`/`formBackLocked` |
| `V2Creation` | `screens/v2/creation/V2CreationScreen` (state-machine creation, `creationStore`) | dev toolbar, `releaseNavigation.onCreateSuccessor` fallback. Effectively dev-only in practice | `gestureEnabled:false` |
| `Paywall` and `V2Paywall` (two names, same `V2PaywallRouteScreen`) | `screens/v2/paywall/V2PaywallScreen.tsx` (two-step; `V2TrialEndedPanel` for TRIAL_ENDED) | creation gates (`Paywall`, legacy params), Home/Practice/Vision/Chart gates (`V2Paywall`, `context` + `resumeIntent`), Evolve | transparent bg, default push |
| `V2Practice` | `screens/v2/practice/V2PracticeScreen.tsx` -> `V2PracticeSessionScreen`, `focus/V2FocusActiveScreen`, `deepFocus/*`, `visualize/V2CinematicSessionScreen`, in-screen "prepare" step | Home Today card, Details, Practice hub, paywall resume, notification `daily_reminder` | `animation:'none'` when `anchorTransition`/`visionEntry` |
| `V2Vision`, `V2VisionNoteComposer` | `screens/v2/vision/*` | Home, Practice (create/open vision), Chart, paywall `vision_premium_action`, notification | `visionPreviewScreenOptions` |
| `V2Chart`, `V2ChartAdjust`, `V2ChartJourney`, `V2ChartWaypoint` | `screens/v2/chart/*` | Home, Release continue, Vision, Progress, notification `chart`, paywall `open_chart` | cream bg; Waypoint `animation:'none'`, `gestureEnabled:false` |
| `V2Progress` | `screens/v2/progress/V2ProgressScreen.tsx` | Home/Details (hero flight), release "view progress" `replace` | graphite bg; `fade` when `anchorTransition` |
| `V2Release` | `screens/v2/release/V2ReleaseScreen.tsx` | Home/Details/Practice setup (`onReleaseRequested`), Evolve return via `navigate(...merge)` | `animation:'none'` when `anchorTransition`; `beforeRemove` + hardware back blocked while `locked` |
| `V2WeeklyInsight` | `screens/v2/weeklyInsight/*` | Home, Progress | default |
| `V2NotificationInvitation`, `V2ReminderTime` | `screens/v2/notifications/*` | `handOffPracticeToInvitation` after first saved practice that returns Home | fade/none, `gestureEnabled:false` |
| `V2Settings` | legacy `screens/settings/SettingsScreen.tsx` (+ `AccountDataSubscreen`, `NotificationSettingsScreen`) | Home profile | transparent bg |
| `V2Auth`, `Login` | `screens/v2/auth/V2AuthScreen.tsx`, `screens/auth/LoginScreen.tsx` (wrapped) | Onboarding "Sign in", creation `onSignIn` | transparent bg |
| `V2SystemGallery` | `screens/v2/system` | no in-app entry found (dev only) | default |
| `V2EvolvingAnchor` | `screens/v2/system` | `__DEV__` only (line 670 conditional) | default |
| `V2PracticePrepare` | typed in `navigation/v2/types.ts:51` and `routes.ts:17` but NOT registered as a `Stack.Screen`. Prepare is an in-screen step. A `navigate` to it would error | none | n/a |

Overlays and sheets (all RN `<Modal>` have `onRequestClose`, checked): `V2SheetModal` (`components/v2/primitives`), `CreationSheet`, `V2PlanPickerSheet`, `V2ThreadEventCelebration`, `V2ThreadEventDetailSheet`, `WeeklyHistoryDrawer`, `VisionTwoUpStage` preview modal, `V2DialogHost` (alert/confirm/action sheet, single slot), Home `V2ThreadEventModal`, anchor transition overlay (`ProgressiveFocusTransition` provider), `SplashController` over the whole app, dev-only `ChartLabDevHost`, `VisionVisualQADevHost`, `CreationFlowQADevHost`, `V2DevFloatingToolbar` (returns null outside `__DEV__`).

### 1.3 Legacy: `RootNavigator` (`navigation/RootNavigator.tsx`)

`Onboarding` (OnboardingNavigator: `LogoBreath`, `Welcome`, `Login`, `SignUp`) when `!hasCompletedOnboarding`; else `Main` (MainTabNavigator), `Settings` (ProfileStackNavigator, modal slide_from_bottom: `Settings`, `Profile`, `SessionDefaults`, `Login`), `Paywall` (`screens/paywall/PaywallScreen.tsx`, fullScreenModal).

`MainTabNavigator` (custom tab bar, three independent stack navigators):
- Vault stack (`VaultStackNavigator.tsx`): `Vault`, `SaveProgress`, `AuthGate`, `Login`, `SignUp`, `AnchorDetail`, `VisualizePreparation/Session/Completion`, `FirstAnchorCreation`, `CreateAnchor`, `AnchorCreationFlow`, `LetterDistillation`, `SigilSelection`, `DistillationAnimation`, `StructureForge`, `ManualReinforcement`, `LockStructure`, `EnhancementChoice`, `StyleSelection`, `ManualForge`, `AIGenerating`, `AIVariationPicker`, `EnhancedVersionPicker`, `AnchorReveal`, `PrimeYourAnchor`, `WallpaperPrompt`, `ChargeSetup`, `Ritual`, `SealAnchor`, `ChargeComplete`, `FirstPrimeComplete`, `TrialSignUp`, `ActivationRitual`, `ConfirmBurn`, `BurningRitual`.
- Practice stack (`PracticeStackNavigator.tsx`, own container): `PracticeHome`, `ThreadStrengthDetail`, `Evolve`, `ChargeSetup`, `BreathingAnimation`, `Ritual`, `SealAnchor`, `ChargeComplete`, `FirstPrimeComplete`, `ActivationRitual`, `ManualReinforcement`, `VisualizePreparation/Session/Completion`, `ConfirmBurn`, `BurningRitual`.
- Chart stack (`ChartStackNavigator.tsx`): `ChartHome`, `CourseSetup`, `CourseEditor`, `AIPlanReview`, `WaypointDetail`, `CourseLog`, `ReflectionComposer`, `CourseDetails`, `CourseCompletion`, `CompletedJourney`.
- `AuthNavigator` (`Login`, `SignUp`, `Onboarding`) is declared but not mounted by either root.

Entry/resume mechanics: `ResumeTargetHandler` (consumes `navigationResumeStore` chart deep link or resume target on tab mount), `usePracticeEntry`/`practiceEntry.ts`, `firstAnchorGate.ts` (`navigateToVaultDestination`), `rootNavigationState.ts` builders (`buildMainRootNavigationState`, `buildExpiredTrialPaywallNavigationState`).

### 1.4 Handoff modules (state machines)

| Module | Slot / store | Guards | Notes |
|---|---|---|---|
| `navigation/v2/creationHandoff.ts` (`prepareHomeArrival`, `handOffToHome`) | `homeArrivalStore` | none (no `inFlight`, no per-anchor latch); caller drops the promise (`void handOffToHome`) | arrival expiry timer (5 s) set only after the pop, see C-21 |
| `practiceHandoff.ts` (`handOffPracticeToHome`) | `homeArrivalStore` | module `inFlight` + `handedOff` set by sessionId | fallback always navigates |
| `releaseHandoff.ts` (`handOffReleaseToHome`, `handOffEvolvedToHome`) | `homeArrivalStore` | `inFlight` + `handedOff`, but fallback branch returns before the guard (C-21) | |
| `invitationHandoff.ts` | `reminderInvitationStore` (+ `practiceDeparture` slot, 3 s max age) | `inFlight` + `handedOff` | `staged` is not cleared on the outer catch path |
| `evolveReturn.ts` + `stores/v2/evolveSessionStore.ts` | session-only `pending`/`successor` | `evolveStartingRef` in `V2ReleaseScreen` | attach happens before `navigate({merge:true})`; link written only by `useV2Release` after server-confirmed release |
| `releaseNavigation.ts` | n/a | `leavingRef` in `V2ReleaseScreen.handleAction` | all continuations use `replace` so a released anchor is not re-enterable |

### 1.5 Resume and lifecycle handlers

`App.tsx`: notification response queue (889-971), RevenueCat customer-info listener (674-686), push-token sync (688-754), `NotificationCoordinator.initialize()` (756-759, AppState reconcile), AppState breadcrumb + `computeStreak` (975-985), Prime-on-Launch initial state (204-249, 420-444). `V2HomeScreen`: AppState-active refresh (194-206) and focus refresh. Practice: `V2FocusActiveScreen`, `useDeepFocusSession` pause on background. Release: hold ends on background, AppState reconcile for `confirming`. Vision: foreground-only polling with catch-up. `MainTabNavigator` (legacy only): flush practice and scene queues on mount/foreground.

### 1.6 Deep links

No `linking` config. `scheme: "anchor"`. Chart links: `chartDeepLinks.ts` parse + `claimInitialDeepLink` (one claim per launch), consumed by `RootNavigator.UnauthenticatedChartDeepLinkHandler` (legacy only) and `widgets/WidgetDeepLinkHandler.tsx`. In V2 mode the chart-link handler in `RootNavigator` is not mounted; notification taps use `CommonActions.navigate` (App.tsx 782-878). Dev-only URL hosts: `ChartLabDevHost`, `VisionVisualQADevHost`, `CreationFlowQADevHost`.

---

## 2. Findings

Severity key: P0 crash/corruption/blocking, P1 major broken interaction, P2 noticeable inconsistency, P3 minor.

### C-01  Cold start wipes a guest's Anchor and replays onboarding
- **Screen/System:** App startup auth listener, `authStore.signOut`, V2 "Continue without account" path
- **Proposed severity:** P0 (guest data loss)
- **Evidence type:** code suspected (call chain read end to end; not run)
- **Symptoms:** A user who picked "keep on this device" at the sealed save screen closes and reopens the app. Their only Anchor is gone, onboarding starts again, and `isGuest` is still true. The same code path also deletes the onboarding draft and any `pendingFirstAnchorDraft` of any signed-out user on every cold start, defeating the designed pre-account resume (`resumesBeforeAccount` in `stores/v2/firstRunStore.ts`).
- **Reproduction:** (1) Fresh install, finish onboarding, tap "Continue without account" -> `V2FirstRunFlow.onContinueWithout` sets `isGuest=true`, `onContinue` calls `completeOnboarding()` (`V2FirstRunFlow.tsx:107-121`). (2) Force-stop and relaunch. (3) `AuthService.onAuthStateChanged` fires once with `null` (no Firebase session). `App.tsx:475-481` takes the `!firebaseUser` branch and calls `store.signOut()` (also `App.tsx:622` after `initialAuthResolved`).
- **Likely root cause (confidence high):** `authStore.signOut()` (`stores/authStore.ts:1005-1090`) with no `userId` skips the awaited snapshot step and synchronously runs `useAnchorStore.getState().clearAnchors()`, `useSessionStore.reset()`, sets `hasCompletedOnboarding:false`, clears pending first-anchor state, resets `useFirstRunStore`, and removes `ANCHOR_VAULT_STORAGE_KEY`, `ANCHOR_SESSION_STORAGE_KEY` and `anchor:v2:first-run` from storage. It does not reset `isGuest`. `onRehydrateStorage` (`authStore.ts:1102-1121`) was changed to keep guests, but the App-level listener undoes it moments later. The listener has no `isGuest`/`hasCompletedOnboarding` guard.
- **Relevant files:lines:** `App.tsx:467-481, 602-624`; `stores/authStore.ts:1005-1090, 1102-1121`; `screens/v2/onboarding/V2FirstRunFlow.tsx:44-58, 107-121`; `stores/v2/firstRunStore.ts:60, 148-157`.
- **Recommended solution:** In the `!firebaseUser` branch (and the `App.tsx:603-623` effect), call the destructive `signOut()` only when the persisted store actually holds an account (`user?.id` or `isAuthenticated`). For a signed-out user (guest or mid-onboarding) only `setLoading(false)`. Keep the existing dev-master branch. Add a unit test that seeds `{isGuest:true, hasCompletedOnboarding:true, anchors:[a]}`, fires the listener with `null`, and asserts nothing is cleared.
- **Visual preservation:** none affected; no UI change.
- **Risk:** Low to medium. A stale persisted `user` with no Firebase session must still be cleared; the `user?.id` condition keeps that case.
- **Verification:** jest test above; device: guest finish, kill, relaunch, expect Home with the Anchor; mid-onboarding kill, relaunch, expect resume ("Restoring your progress...").

### C-02  Startup can hang indefinitely on a stalled `/api/auth/sync` (no timeout, no fail-open)
- **Screen/System:** Splash / `useAppStartup` / `AuthService.syncCurrentUser`
- **Proposed severity:** P1 (blocking in poor networks)
- **Evidence type:** code suspected; RN Android timeout default **verified-by-grep** (`node_modules/react-native/ReactAndroid/.../OkHttpClientProvider.kt:52-53`: `connectTimeout(0)`, `readTimeout(0)`)
- **Symptoms:** On a signed-in launch with a captive or stalled connection (TCP open, no response, or cold backend), the splash never completes.
- **Reproduction:** Signed-in user, device on a network that accepts the connection but never answers (or point `API_URL` at a blackhole). Launch. `onAuthStateChanged` -> `AuthService.syncCurrentUser` -> `syncUserWithBackend` `fetch` with no `AbortController` (`services/AuthService.native.ts:223`). `useAppStartup` requires `authRestorationSettled` for BOTH normal readiness and fail-open (`hooks/useAppStartup.ts:44-47, 64-76`: `safeToFailOpen = authRestorationSettled && primeOnLaunchResolved`), so the 4 s `SPLASH_FAIL_OPEN_TIMEOUT_MS` cannot fire while auth is pending. The offline fallback in `App.tsx:556-568` only runs after the fetch rejects.
- **Likely root cause (confidence medium-high):** the only network call on the critical path has no timeout and the fail-open gate depends on that same call. iOS eventually fails at about 60 s (NSURLSession default); Android has no timeout at all.
- **Relevant files:lines:** `services/AuthService.native.ts:223-246`; `hooks/useAppStartup.ts:44-47, 64-76`; `App.tsx:467-575`; `components/splash/splashAnimation.constants.ts:8`.
- **Recommended solution:** Add an `AbortController` timeout (8-10 s) to `syncUserWithBackend` (and `getIdToken` callers on the startup path) that rejects with a message matching `isNetworkError`, so the existing cached-user offline path (`App.tsx:558-568`) runs. Additionally let `useAppStartup` fail open on `timedOut` when a persisted `user` exists, independent of `authRestorationSettled`.
- **Visual preservation:** unchanged; only the wait changes.
- **Risk:** Low. A slow-but-working network now lands in offline mode and reconciles later (hydration already runs in the background).
- **Verification:** jest on `useAppStartup` with `authRestorationSettled=false` and a persisted user; device with throttled/blackholed API on Android.

### C-03  Guests cannot record a practice session
- **Screen/System:** `V2PracticeSessionScreen` Focus/Deep Focus completion, `PracticeCompletionService`
- **Proposed severity:** P1
- **Evidence type:** code suspected
- **Symptoms:** A guest completes a Focus or Deep Focus session. The complete screen shows "not saved" (`sessionSaved={!focusPersistenceFailed}`), no history, no streak or thread movement. In the non-focus fallback (`completeLegacy`) the complete action silently does nothing.
- **Reproduction:** Continue as guest (once C-01 is fixed they can reach Home), start Focus, finish. `accountId` is `useAuthStore(s=>s.user?.id ?? null)` (`V2PracticeSessionScreen.tsx:59`); `resolvedAccountId = accountId ?? anchor?.userId ?? 'local-user'` (`:168`); `completePracticeSession` throws `Practice completion account does not match the active account.` because `useAuthStore.getState().user?.id` is undefined (`services/PracticeCompletionService.ts:136-150`); the `catch` at `:203-205` sets `focusPersistenceFailed`. `completeLegacy` returns at `:422` when `!accountId`.
- **Likely root cause (confidence high):** the sealed-save guest path introduced a signed-out-but-onboarded state; practice persistence still requires an account id.
- **Relevant files:lines:** `screens/v2/practice/V2PracticeSessionScreen.tsx:59, 164-205, 420-449`; `services/PracticeCompletionService.ts:136-150, 241-250`.
- **Recommended solution:** Define a local-only guest account id (for example `guest-local`) accepted by `completePracticeSession`/`queueCanonicalCompletion`, written to `practiceHistory` with `syncState:'pending'` but excluded from `flush` until a real account exists; on account creation re-key the queue to the new account (mirrors `finalizePendingFirstAnchorDraft`). Make `completeLegacy` surface an error instead of returning silently.
- **Visual preservation:** none.
- **Risk:** Medium; touches the practice write queue keying.
- **Verification:** jest on `PracticeCompletionService` with no user; device guest session then sign-up, history uploaded once.

### C-04  Settings "Export My Data" calls a URL that does not exist
- **Screen/System:** Settings > Account & data; Profile > Data & privacy
- **Proposed severity:** P1 (data-portability control always fails)
- **Evidence type:** **verified-by-grep** (client path vs server mount)
- **Symptoms:** Tapping Export always ends in the "Export Failed" alert.
- **Reproduction:** `AccountDataSubscreen.tsx:96` and `screens/profile/DataPrivacyScreen.tsx:95` call `apiClient.get('/auth/me/export')`. `apiClient` has no `/api` prefix (hydration uses `'/api/auth/me/export'`, `AuthHydrationService.ts`), and the server mounts the router only at `app.use('/api/auth', authRoutes)` (`backend/src/index.ts:328`, route at `backend/src/api/routes/auth.ts:627`). Result: 404 -> ApiClient maps to `Resource not found.` -> alert.
- **Likely root cause (confidence high):** missing `/api` prefix.
- **Relevant files:lines:** `screens/settings/AccountDataSubscreen.tsx:96`; `screens/profile/DataPrivacyScreen.tsx:95`.
- **Recommended solution:** Use `'/api/auth/me/export'`. Secondary: sharing the whole export as one `Share.share({message})` string can be very large (anchor SVG and image data); prefer writing a file and sharing its URI.
- **Visual preservation:** none.
- **Risk:** Low.
- **Verification:** jest with a mocked client asserting the URL; device export on an account with an image anchor.

### C-05  Release "confirming" state can lock the screen for up to 120 s with no exit
- **Screen/System:** `V2ReleaseScreen` / `useV2Release` / `releaseApiAdapter`
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** After the hold completes and the dissolution ends, if the network is slow or hung, the screen shows the chamber "confirming" status. Hardware back, edge swipe and `beforeRemove` are blocked and there is no button until the request ends.
- **Reproduction:** Throttle the API so `POST /api/v2/anchors/:id/release` hangs. `stage` is `confirming` for `submissionState` `submitting`/`pending` after `dissolutionDone` (`hooks/v2/release/useV2Release.ts:229-236`). `locked = dissolving || confirming` (`screens/v2/release/V2ReleaseScreen.tsx:127`) drives `onSessionActiveChange`, so `AnchorV2Navigator.tsx:351-377` installs `beforeRemove.preventDefault`, a hardware-back `return true`, and `gestureEnabled:false`. The request uses the shared `apiClient` with `timeout: 120000` (`services/ApiClient.ts:25`). A retry button appears only after the failure result (`retryable`), i.e. after the timeout.
- **Likely root cause (confidence medium-high):** a locked state whose only exit is the end of an unbounded-feeling request. The server and key are idempotent, so a short timeout and re-submit is safe.
- **Relevant files:lines:** `hooks/v2/release/useV2Release.ts:131-157, 229-236`; `screens/v2/release/V2ReleaseScreen.tsx:127-128`; `navigation/v2/AnchorV2Navigator.tsx:351-377`; `services/ApiClient.ts:25`; `adapters/v2/release/releaseApiAdapter.ts:33-52`.
- **Recommended solution:** Pass a 15 s `timeout` for the release POST (adapter `post` config), let the existing `pending`+`retryable` result drive the existing retry UI, and auto-reconcile on `AppState` active (already present). Add a "Continue, we will finish confirming" exit after N seconds that keeps the idempotent retry running in the background.
- **Visual preservation:** the ceremony and `V2ReleaseChamberStatus` are untouched; only the timing of the existing retry affordance changes.
- **Risk:** Medium (release is terminal; rely on the server idempotency key, which exists).
- **Verification:** jest on adapter with a delayed mock; device with throttled API.

### C-06  Any HTTP 409 on Release is treated as "already released"
- **Screen/System:** `releaseApiAdapter.classifyFailure`
- **Proposed severity:** P3 (low probability, wrong outcome)
- **Evidence type:** code suspected
- **Symptoms:** A genuine `ANCHOR_RELEASE_CONFLICT` (server returns 409 when the claim update lost a race and the anchor is NOT released, `backend/src/services/v2/AnchorReleaseService.ts:45-47`) is shown to the user as a completed release, and `releaseAnchor(anchorId)` flips the local record to released.
- **Likely root cause (confidence medium):** `error.status === 409 || ALREADY_RELEASED_CODES` (`adapters/v2/release/releaseApiAdapter.ts:74-77`) treats the status alone as success.
- **Recommended solution:** Treat 409 as released only for the codes in `ALREADY_RELEASED_CODES`; map `ANCHOR_RELEASE_CONFLICT` to `pending`+`retryable`.
- **Visual preservation:** none. **Risk:** Low.
- **Verification:** adapter unit test with a 409 + `ANCHOR_RELEASE_CONFLICT`.

### C-07  Anchor create/seal can freeze for minutes; creation back is locked meanwhile
- **Screen/System:** `useSaveAnchor`, `AnchorCreationFlowScreen` seal
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** On a slow or dead connection after the user seals, the medallion sits still (hairline after 1.5 s) with back locked. Worst case is about 2 x 120 s plus 500 ms.
- **Reproduction:** Throttle `POST /api/anchors`. `useSaveAnchor` posts through `apiClient` (120 s timeout), and on a plain "Network error" retries once after 500 ms (`hooks/useSaveAnchor.ts:~296-326`). `sealing = choose.phase !== 'choosing'` keeps `goBack` and hardware back disabled (`AnchorCreationFlowScreen.tsx:1096-1110`).
- **Likely root cause (confidence medium):** default client timeout (see C-22) plus a retry that doubles it.
- **Relevant files:lines:** `hooks/useSaveAnchor.ts:233-356`; `screens/create/flow/AnchorCreationFlowScreen.tsx:806-840, 1096-1110`; `services/ApiClient.ts:25`.
- **Recommended solution:** 20-30 s timeout on the create POST (the idempotency key already exists for a safe re-send), keep the key stable across the in-flow retry (today a new key is generated per `saveAnchor` call, line 240, but is reused for the retry), and offer the existing "try again" path rather than a silent wait.
- **Visual preservation:** seal animation unchanged. **Risk:** Medium.
- **Verification:** throttled-network device run; jest with fake timers on `useSaveAnchor`.

### C-08  A failed server save still "succeeds" locally: phantom, never-uploaded Anchor
- **Screen/System:** `useSaveAnchor` fallback, V2 creation
- **Proposed severity:** P1
- **Evidence type:** code suspected
- **Symptoms:** For a signed-in user, if `POST /api/anchors` fails for any reason except the two limit codes (5xx, 401, timeout after the single retry), the flow continues as saved: a local Anchor with id `anchor-<key>` is added, `incrementAnchorCount()` runs, and Home plays the arrival. Nothing is queued for upload. Later Vision/Chart/Release/practice calls on that id will 404, and `AuthHydrationService` keeps non-backend-id anchors forever (`preservedLocalAnchors`).
- **Reproduction:** Signed in, API returning 503 on `/api/anchors`, create an Anchor through the V2 flow (`isV2` branch uses `useSaveAnchor`, `AnchorCreationFlowScreen.tsx:678-715`).
- **Likely root cause (confidence high):** `catch (err)` ends with "Continue with local fallback" (`hooks/useSaveAnchor.ts:353`). The V2-specific persistence module (`services/v2/creationPersistence.ts`) was written to avoid exactly this ("a failed V2 save must leave no phantom Anchor") but the live creation flow does not use it. `AnchorSyncService` (the only retry queue) is legacy Supabase and is gated off by `isConfigured()`.
- **Relevant files:lines:** `hooks/useSaveAnchor.ts:240-356, 360-385`; `screens/create/flow/AnchorCreationFlowScreen.tsx:678-715`; `stores/anchorStore.ts:165-192`; `services/AuthHydrationService.ts:696-707, 931-945`; `services/v2/creationPersistence.ts` header.
- **Recommended solution:** For authenticated saves, treat a non-limit failure as `{status:'failed'}` that resets the seal and shows the retry affordance with the same idempotency key (the server dedupes), instead of adding a local Anchor. Keep the local-first path only for the guest-first-anchor branch.
- **Visual preservation:** reuse the existing seal reset used for the gate outcomes (`chooseRef.current?.reset()`); no new visuals required beyond an error line.
- **Risk:** Medium (changes creation failure semantics).
- **Verification:** jest on `useSaveAnchor` with a rejected POST asserting no `addAnchor`; device with API disabled.

### C-09  Pending first-anchor finalization POST has no idempotency key
- **Screen/System:** `authStore.finalizePendingFirstAnchorDraft` (guest -> account)
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** If the create response is lost after the server committed (timeout, kill between response and `persistPendingDraftProgress`), the next attempt POSTs again. A Pro/trial user gets a duplicate Anchor; a free user gets `CREATE_ANCHOR_FREE_LOCKED` (the server's lifetime rule) and the screen shows the "already used its free Anchor" paywall copy although their Anchor exists.
- **Relevant files:lines:** `stores/authStore.ts:289-304 (buildAnchorCreatePayload has no idempotencyKey), 753-756, 920-935`; compare `services/v2/creationPersistence.ts` which sends `idempotencyKey`.
- **Likely root cause (confidence high):** payload omits the key although the server supports `Anchor.idempotencyKey @unique`.
- **Recommended solution:** Add a stable key derived from `pendingFirstAnchorDraft.tempAnchorId` to `buildAnchorCreatePayload`. Also guard `isFinalizingPendingFirstAnchor` with a try/finally reset (it is reset on all current paths, but a thrown error inside the `set` blocks would leave it true).
- **Visual preservation:** none. **Risk:** Low.
- **Verification:** jest asserting the key in the POST body; replay test returning an existing Anchor.

### C-10  Offline/reconnect: no connectivity listener; V2 never drains its write queues
- **Screen/System:** `PracticeCompletionService`, `VisualizationSceneService`, push/notification sync
- **Proposed severity:** P2
- **Evidence type:** **verified-by-grep** (no NetInfo in `package.json` or source; `.flush(` call sites) plus code suspected for the concurrency note
- **Symptoms:** A session completed offline stays in `anchor:practice-write-queue:<account>` with `syncState:'failed'`. In V2 mode the queue is only retried when another session completes; the server's thread strength, streak and progress lag until then.
- **Likely root cause (confidence high):** `PracticeCompletionService.flush` and `VisualizationSceneService.flushPending` are called only from `MainTabNavigator.flushPracticeWrites` (legacy, mount + foreground, `navigation/MainTabNavigator.tsx:228-236`), `BurningRitualScreen`, and right after a completion (`V2PracticeSessionScreen.tsx:200, 446`). `AnchorV2Navigator` has no equivalent.
- **Related (confidence medium, P3):** `flush` is read-modify-write on SecureStore with no mutex (`PracticeCompletionService.ts:312-360`): a slow flush A that read `[S1]` can write `[]` after completion B queued `[S1,S2]`, and if B's POST of S2 failed, S2 is dropped. This is the same class as the known `enqueueRetry` race in the dev notes.
- **Recommended solution:** Mount a small `useQueueDrain` effect inside `AnchorV2Navigator` (or App) that flushes on launch-after-auth, on `AppState` active, and on a connectivity signal (`@react-native-community/netinfo` or a failed-request-then-success heuristic). Serialize `flush` with a module promise chain like `NotificationCoordinator.runExclusively`.
- **Visual preservation:** none. **Risk:** Low-medium.
- **Verification:** jest with fake timers: queue one failed record, trigger AppState active, expect one POST; concurrency test with two interleaved flushes.

### C-11  Paywall: store success can dead-end; dismiss is not disabled while a purchase runs
- **Screen/System:** `useV2Paywall`, `V2PaywallScreen`, `V2PaywallRouteScreen`
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** (a) After a successful store transaction where `status.hasActiveEntitlement` is false (RevenueCat propagation delay, Android pending purchase) the user sees "...still being confirmed. Your receipt is safe." and stays on the paywall. The global `addCustomerInfoUpdateListener` (`App.tsx:683`) will unlock the store moments later but nothing in the paywall observes `isActiveSubscriber` (grep of `components/v2/paywall` and `screens/v2/paywall` finds no consumer), so the user must tap Restore or leave. (b) The step-1 "Maybe later"/X (`V2PaywallScreen.tsx:458, 571`) is not disabled while `controller.busy`. If it is used while a purchase or `activateV2Trial` call is outstanding, `onEntitled` later runs `handleEntitled` on a removed route: `navigation.goBack()` becomes a no-op but the `navigate(resume...)` still fires, opening practice/creation the user already left.
- **Relevant files:lines:** `hooks/v2/paywall/useV2Paywall.ts:134-173, 175-205`; `navigation/v2/AnchorV2Navigator.tsx:58-102`; `screens/v2/paywall/V2PaywallScreen.tsx:458, 571`; `services/RevenueCatService.ts` (`purchasePackageByIdentifier`).
- **Likely root cause (confidence medium):** no reaction to entitlement change after an "unconfirmed" outcome; dismissal not gated on `busy`.
- **Recommended solution:** In `useV2Paywall`, when the outcome is "still being confirmed", subscribe once to `useSubscriptionStore.hasActiveEntitlement` (with a 30-60 s cap) and call `finishEntitled` when it flips. Disable dismiss while `busy`, or make `handleEntitled` check `navigation.isFocused()` before resuming.
- **Visual preservation:** none (disabled state already exists for the CTA). **Risk:** Low.
- **Verification:** jest simulating `purchasePackageByIdentifier` returning `hasActiveEntitlement:false` then a store flip.

### C-12  A cold-start notification tap can be stranded
- **Screen/System:** `App.tsx` notification response queue
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** App launched from a notification lands on the default screen instead of the target.
- **Reproduction (needs auth to settle before the navigator mounts):** response queued while `navRef.isReady()` is false and a 200 ms retry loop starts (`App.tsx:906-940`). When `initialAuthResolved` flips, the effect (deps at `:971`) cleans up, which stops the loop. The re-run calls `drainPendingNotification()`, which does nothing if the container is still not ready and does not restart the loop (only `processOrQueueNotificationResponse` starts it). The re-run then re-reads `getLastNotificationResponseAsync()`, whose id is already in `processedResponseIdsRef` (`:924`) so it returns. The pending ref is never drained. The loop also stops at about 6 s (`:914`).
- **Likely root cause (confidence medium-low on frequency, high on mechanism).**
- **Relevant files:lines:** `App.tsx:882-971`.
- **Recommended solution:** Have `drainPendingNotification` call `startDrainRetryLoop()` when a pending response exists and the container is not ready; raise the retry cap to the startup fail-open horizon; do not add the id to `processedResponseIdsRef` until it is dispatched.
- **Visual preservation:** none. **Risk:** Low.
- **Verification:** jest with fake timers and a mocked `navRef`.

### C-13  Error boundary: whole-app reset, legacy styling, no per-screen containment
- **Screen/System:** `components/ErrorBoundary.tsx`, `App.tsx:1011`
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** A render error in any screen replaces the entire app (including `NavigationContainer`) with the dark legacy "Something Went Wrong" card with an emoji. "Try Again" bumps `childKey` (`ErrorBoundary.tsx:48-55, 110`), remounting the whole tree: navigation state and in-flight creation/seal state are lost and the same persisted data can immediately re-trigger the same error (a loop with no escape such as "reset local data"). The boundary only exists once `appIsReady`; errors during the splash tree are uncontained. Async/event-handler errors never reach it.
- **Recommended solution:** Add route-level boundaries around volatile screens (Creation flow, Home, Practice session, Release) whose fallback restores the V2 cream style and offers "Back to Home" via `navigation.reset`, keeping the root boundary as last resort. Offer a safe-mode action after N consecutive resets that clears only the volatile caches (not the vault).
- **Visual preservation:** the fallback is a new surface in V2 colours; existing screens are unchanged.
- **Risk:** Low. **Verification:** jest rendering a throwing child; manual throw in `__DEV__`.

### C-14  Home refreshes three endpoints on every foreground, even when Home is covered
- **Screen/System:** `V2HomeScreen`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** Each `AppState` `active` event (including iOS inactive-to-active from the notification shade, permission sheets, share sheets) calls `refreshHomeContext()` (`screens/v2/home/V2HomeScreen.tsx:194-206`), which fires Today, Vision and Chart reads, with no recency throttle (the focus path has `REFOCUS_REFRESH_MS`, the AppState path does not) and no check that Home is focused. While the user is inside a Practice session this competes for the JS thread and the API rate limit (the dev notes record a reload-to-429 on Home).
- **Recommended solution:** Reuse the focus path's recency check and skip when `navigation.isFocused()` is false (mark stale and refresh on next focus).
- **Visual preservation:** none. **Risk:** Low.
- **Verification:** jest on the listener with fake `Date.now`; count requests on a device run.

### C-15  Hydration overwrite window: server list can replace newer local state
- **Screen/System:** `AuthHydrationService.hydrateAuthenticatedData`
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** An Anchor created or released while hydration is in flight can vanish or revert for a while. Hydration runs in the background after the shell is shown (`App.tsx:539-549`), and again after every interactive sign-in (see C-17).
- **Reproduction:** Slow `/api/auth/me/export` or profile call. The anchors request resolves early and the early commit builds `nextAnchors = [...fastAnchors, ...preservedLocalAnchors]` where `preservedLocalAnchors` keeps only non-backend ids (`AuthHydrationService.ts:696-708`). The final commit at `:931-984` replaces again from `remoteAnchors` captured before the user acted. A create that already has a backend id, or a release applied locally, is not in `remoteAnchors` and is dropped or reverted until the next sync.
- **Likely root cause (confidence medium):** no per-anchor `updatedAt`/revision comparison and no "locally mutated since request start" guard.
- **Recommended solution:** Snapshot a mutation counter (or `updatedAt` per id) at request start; on commit, keep local anchors whose `updatedAt` is newer or that appeared after the snapshot.
- **Visual preservation:** none. **Risk:** Medium (core store merge).
- **Verification:** jest simulating release during a pending hydration.

### C-16  Navigator remounts mid-flow when the key changes
- **Screen/System:** `AnchorV2Navigator` key (`:557`), onboarding save step
- **Proposed severity:** P3 (possible blank frame; not measured)
- **Evidence type:** code suspected
- **Symptoms:** For a signed-out user, setting `firstRunStep` to `'auth'` (done in `AnchorCreationFlowScreen` `onSaved`, line ~700, immediately before `navigation.popToTop()`) flips the key from `V2FirstRun:guest` to `V2FirstRun:onboarding-save`, which unmounts and recreates the entire stack including the creation flow whose coin hand-off the sealed-save screen is designed to continue. Likewise `completeOnboarding()` plus `navigation.reset` at "Continue to Home" changes the key twice.
- **Recommended solution:** Derive the key only from identity (`user?.id` / guest) and let `V2FirstRunFlow` react to step changes internally (it already switches on `draft.currentStep`); keep `initialRouteName` logic.
- **Visual preservation:** this is the point: removing the remount protects the seal-to-coin continuity.
- **Risk:** Medium (the key encodes several intentional resets). **Verification:** device frame capture of the seal -> save transition.

### C-17  Duplicate auth sync and hydration on every interactive sign-in
- **Screen/System:** App-level `onAuthStateChanged` plus `PostAuthFlowService.run`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** Signing in or up triggers `/api/auth/sync` and `hydrateAuthenticatedData` twice: once from the always-on listener (`App.tsx:467-549`) and once from `PostAuthFlowService.run` (`services/PostAuthFlowService.ts:30-100`). `setSession` from the listener (`authStore.ts:463-489`) overwrites `hasCompletedOnboarding` from the server value and can interleave with the explicit flow's patched value.
- **Recommended solution:** Mark an "interactive auth in progress" flag in the store that the listener respects, or have the listener skip when `useAuthStore.user?.id` already equals the Firebase uid and a sync completed in the last few seconds.
- **Visual preservation:** none. **Risk:** Medium. **Verification:** count `/api/auth/sync` calls in a jest integration test.

### C-18  Evolve: successor link is local only; attach/release ordering is sound but fragile
- **Screen/System:** Evolve (Release screen + creation return)
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** `evolvedFrom` is recorded only on the local successor (`stores/anchorStore.ts:46, 123-128`; carried forward on server merges). It does not survive reinstall, sign-out, or a second device; the Home "evolved from" line then disappears.
- **Also checked (clean):** the old Anchor is only released when the hold completes (`useV2Release.ts:197-209`), the link is written only after server confirmation, the session store clears on blur-return-without-successor and on unmount (`V2ReleaseScreen.tsx:178-195`), and a double tap on "Evolve it" is latched by `evolveStartingRef`.
- **Recommended solution (optional):** persist the link server-side (`classifierMeta.evolvedFrom`) on release confirmation.
- **Visual preservation:** none. **Risk:** Low.

### C-19  Dialog bridge: single slot, lost callbacks, cancel handler dropped for 3+ buttons
- **Screen/System:** `components/v2/feedback/V2DialogManager.ts`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** `currentState` holds one dialog (`:40`); a second `Alert.alert` while one is open replaces it without invoking the first's `onCancel`/`onPress`, so any action tied to the first (for example "Go back" in the creation account gate) is silently lost. For 3+ button alerts the `cancel` button's `onPress` is never called (action-sheet branch maps only non-cancel buttons). The bridge is installed even in the legacy navigator.
- **Recommended solution:** Queue dialogs FIFO (or resolve the replaced dialog's cancel callback before showing the next), and wire the cancel button of the action sheet.
- **Visual preservation:** none. **Risk:** Low.

### C-20  Stale response overwrite in polling and chart refresh
- **Screen/System:** `useV2VisionGeneration` / `useV2VisionSceneGeneration` / `useAnchorChart.refresh`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** Overlapping polls (2-2.5 s interval with a 120 s timeout) are unordered, so an older response can overwrite a newer job state for one tick (self-heals on the next poll). `useAnchorChart.refresh` calls `setData(value)` with the server snapshot even if a mutation published a newer chart while the read was in flight (`hooks/v2/chart/useAnchorChart.ts:201-236` vs `publishChart`); the UI shows the older chart until the next refresh.
- **Recommended solution:** Tag each request with an increasing id and ignore results older than the last applied one; for the chart compare `version` before `setData`.
- **Visual preservation:** none. **Risk:** Low.

### C-21  Navigation-lock/guard gaps in hand-off modules
- **Screen/System:** `releaseHandoff.ts`, `creationHandoff.ts`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms/mechanism:** (a) `handOffReleaseToHome` and `handOffEvolvedToHome` run `fallback()` and return `'started'` BEFORE the `inFlight`/`handedOff` check (`releaseHandoff.ts:85-92, 167-172`); a double tap on Return Home when `canPop` is false (or Home lists zero Anchors) runs `replace('V2DevelopmentHome')` twice. The caller's `leavingRef` latch in `V2ReleaseScreen` covers the tap path, so reachability is low. (b) `handOffToHome` has no in-flight guard and callers drop the promise (`void handOffToHome(...)`, `AnchorV2Navigator.tsx:~318`, `AnchorCreationFlowScreen.tsx:~706`), so a rejection from `whenHomeReady`/`prefetchChosenImage` is an unhandled rejection and the seal screen never leaves. (c) The 5 s staged-arrival expiry in `handOffToHome` is armed only after the pop, so an arrival staged by `prepareHomeArrival` on save and never handed off (screen unmounted first) stays staged until the next stage replaces it.
- **Recommended solution:** Move the guard above the fallback branches; add `.catch(() => navigation.reset(...Home))` to the callers; arm the expiry inside `prepareHomeArrival`.
- **Visual preservation:** none. **Risk:** Low.

### C-22  Systemic: every request defaults to a 120 s timeout; 401 has no recovery
- **Screen/System:** `services/ApiClient.ts`
- **Proposed severity:** P2 (amplifies C-05, C-07, C-02-adjacent)
- **Evidence type:** **verified-by-grep** for the constant; consequences code suspected
- **Details:** `timeout: 120000` at `ApiClient.ts:25` applies to creation save, release, auth reads, anchors list, practice sessions, and so on; only `/api/ai/enhance` overrides it (180 s). A 401 without an `error.message` body throws a plain `Error('Session expired. Please sign in again.')` (`:236-239`) with no refresh/sign-out path (known watchlist item), so creation maps it to the `auth` failure only because of a regex on the message (`creationPersistence.classifySaveFailure`). Timeouts and offline both surface as `'Network error. Please check your connection.'`, so callers cannot tell "slow" from "offline".
- **Recommended solution:** Default 20-30 s, explicit longer values on generation/export; distinguish `ECONNABORTED` from offline in the error; on 401 force one `getIdToken(true)` retry then route to sign-in.
- **Visual preservation:** none. **Risk:** Medium (affects all callers; roll out per endpoint).
- **Verification:** axios mock adapter tests per code.

### C-23  Store rehydration is not gated by startup readiness for signed-out launches
- **Screen/System:** `App.tsx` startup, `authStore` persist
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** `useAppStartup` waits for fonts, `loadSettingsSnapshot`, the auth latch and the prime-on-launch read, but not for `useAuthStore.persist.hasHydrated()` (only used in `__DEV__` logging, `App.tsx:330-354`). For a signed-out launch the auth latch resolves in milliseconds (`onAuthStateChanged(null)`), so the first navigator render can use default auth state (`hasCompletedOnboarding:false`, `isGuest:false`), then flip `key`/`initialRouteName` when hydration lands, producing a first-run flash before Home for a returning guest. The `V2FirstRunFlow` loading state is plain text (`'Restoring your progress...'`, line 91).
- **Recommended solution:** Add `authStore` (and `firstRunStore`) `hasHydrated` to the `useAppStartup` dependencies; replace the text loading state with the cream paper background.
- **Visual preservation:** keeps the splash until stores are ready. **Risk:** Low.

### C-24  Seal/save promise chains have no `.catch`
- **Screen/System:** `AnchorCreationFlowScreen.onHoldComplete` / `onSealAnimationDone`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** `void pendingSave.then(...)` (`:798`) and `void pending.then(...)` (`:819`) have no rejection handler. If `saveAnchor` ever throws (all current throw sites are inside try/catch or guarded, so reachability is low) the medallion stays held, `sealing` stays true and both back paths are swallowed: a permanent lock.
- **Recommended solution:** `.catch(() => { savePromiseRef.current = null; flushDeferred(); chooseRef.current?.reset(); })`.
- **Visual preservation:** none. **Risk:** None.

### C-25  Creation-gate paywall navigations use legacy params in V2
- **Screen/System:** `IntentionInputScreen`, `useSaveAnchor`, creation flow -> `Paywall`
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Symptoms:** These call `navigation.navigate('Paywall', { source, preferredPlanId })` but `V2PaywallRouteScreen` reads `params.context` and `resumeIntent` (`AnchorV2Navigator.tsx:58-101`), so the V2 paywall shows `GENERAL_UPGRADE` copy instead of `SECOND_ANCHOR` and has no resume. The user returns to the creation screen after purchase and must tap again.
- **Recommended solution:** Map `source` to a `context` and pass `resumeIntent:{type:'create_anchor'}` in a thin adapter inside `V2PaywallRouteScreen` (legacy params fallback).
- **Visual preservation:** none. **Risk:** Low.

### C-26  Startup concurrency and observability cost (not measured)
- **Screen/System:** `App.tsx` mount effects
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Notes:** On every mount in release builds the app starts, inside the splash window: `loadSettingsSnapshot`, `resolvePrimeOnLaunchInitialState` (reads and parses the whole encrypted anchor vault when the Prime-on-Launch flag is set, even though V2 ignores the resulting `Main` state), `AuthService.initialize`, `NotificationCoordinator.initialize` with `reconcile({verifyNative:true})` (AsyncStorage + native scheduled-notification listing + rescheduling), `Sentry.init` with tracing/profiling integrations in a post-first-render effect (`App.tsx:629-637`), `PerformanceMonitoring.initialize({enabled:true})`, PostHog init after settings hydrate, widget sync, and a signed-out `signOut()` that issues several SecureStore/AsyncStorage removals (C-01). `PerformanceMonitoring.startTrace` allocates a trace per HTTP request (`ApiClient.ts:49-56`) and per screen change. The global error and promise-rejection handlers are installed only if Sentry is enabled (`ErrorTrackingService.ts:263-297`) and only after first render.
- **Recommended solution:** Defer notification reconcile and PostHog init to after first Home frame; skip Prime-on-Launch resolution when `anchorV2Enabled`; measure with the existing `HomeStartupProfiler` before changing anything.
- **Visual preservation:** none. **Risk:** Low. **Verification:** startup profiler marks before/after on a physical device.

### C-27  Dead/misleading route metadata
- **Screen/System:** `navigation/v2/types.ts:51`, `routes.ts:17`
- **Proposed severity:** P3
- **Notes:** `V2PracticePrepare` is typed and listed in `ANCHOR_V2_ROUTES` but never registered; `navigate('V2PracticePrepare')` would raise a navigation error. `Paywall` and `V2Paywall` are two registrations of one screen. `V2SystemGallery` ships in release builds with no entry. Remove or register to avoid future dead navigations.

---

## 3. Checked and found clean

- **Double-tap navigation / duplicate screens:** the app is on React Navigation 6 (`package.json`: native 6.1.9, native-stack 6.9.17). `navigate` to an existing route name updates or pops to it rather than pushing, so the many `navigate('V2Practice'|'V2Vision'|'V2Chart'|...)` calls cannot stack duplicates. The only `push` is Evolve's `FirstAnchorCreation`, which is latched by `evolveStartingRef` and reset on focus. `IntentionInputScreen.startingRef` resets on focus (`:157-164`), so "Continue does nothing after backing out" does not occur. The anchor hero provider uses `busyRef` plus a watchdog (`ProgressiveFocusTransition.tsx:297-345, 425-440`) and timers are cleared on unmount.
- **Hand-off single-flight:** `practiceHandoff`, `invitationHandoff`, `releaseHandoff` (non-fallback paths) latch by `inFlight` plus session/anchor key; `V2ReleaseScreen.handleAction` uses a synchronous `leavingRef`; practice `invitationStartedRef` prevents a second Continue.
- **Release idempotency:** stable per-attempt key in `useV2Release`, `submitLockRef`, server transaction is Serializable and replay-safe (`AnchorReleaseService.release`), hold ends on background, `confirming` reconciles on foreground, stale-revision hold rejection exists.
- **Vision generation:** `pendingKey`/`starting`/`retrying` guards, premium pre-check, foreground-only polling with catch-up on resume, job resumes by `GET` on mount so navigating away mid-generation is safe.
- **Creation generation:** `AnchorGenerationService` has a 180 s abort and aborts on unmount/back; back is locked only for the first seconds of generation; `AppState` pauses form sounds.
- **Chart mutations:** per-action locks, scope-checked setters, version-conflict triggers refresh.
- **Notification time/invitation screens:** enroll is single-flight, exits unlock after 10 s, late success is never recorded after leaving, timers cleared on unmount.
- **Practice sessions:** Focus/Deep Focus pause on any non-active `AppState`, resume requires explicit action; hardware back is intercepted.
- **Modals:** every RN `<Modal>` in `components/v2` has `onRequestClose`.
- **Push-token registration:** cancelled flag, no permission prompt at cold start.
- **Paywall double-submit:** `runExclusive` serialises start/purchase/restore.
- **RevenueCat identity:** `logIn` is idempotent per user id; listener unsubscribes correctly. (No `Purchases.logOut` on sign-out; the next `logIn` switches identity, so left as an observation.)
- **First-anchor gate, creation draft re-entry, release 1.1 tombstones:** not re-audited (covered by notes).

## 4. Suggested order of work

1. C-01 (P0), then C-02, C-03, C-04 (small and independent).
2. C-08 and C-09 together (creation/guest-account persistence semantics).
3. C-22 (timeouts) then C-05, C-07.
4. C-10, C-11, C-15.
5. Remaining P2/P3 items.
