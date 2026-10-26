# Anchor Guidance Coordinator — Architecture Plan

**Status:** proposed, awaiting authorisation. No production code has been changed.
**Builds on:** Phase 1 (`ANCHOR_GUIDANCE_PHASE1_CLEANUP_PLAN.md`). Registry, copy and decisions are in `ANCHOR_MICRO_TEACHING_AUDIT_AND_BLUEPRINT.md` (v2).
**Internal name:** Anchor Guidance System. The coordinator is the module that decides; "guidance" is a teaching item.

---

## 1. Goals and non-goals

**Goals**

1. **One decision point.** At most one recorded teaching is visible app-wide.
2. **Celebrations always win.** Guidance never interrupts or delays a celebration (D-10).
3. **Nothing goes stale.** Guidance waits only *within* a context and is never replayed later in an unrelated one (D-11).
4. **Honest records** of displayed, dismissed, acknowledged, action performed and obsolete (D-12).
5. **Real actions.** Highlighted targets run their real action, and success is confirmed before it is recorded (D-13).
6. **Discovery wins.** Independent discovery retires the matching teaching, even if it was never shown (D-14).
7. **Reuse existing 2.0 infrastructure** (D-15).

**Non-goals:** no server tables, no remote config, no business-logic changes, no new event bus beyond a typed in-process emitter, and no change to onboarding.

---

## 2. Modules

```
constants/v2/guidanceRegistry.ts      typed definitions (data only) — §5
constants/v2/teachingCopy.ts           copy (existing file, extended)
stores/v2/guidanceRecords.ts           per-account persisted records (extends teachingSeen pattern) — §6
stores/v2/guidanceCoordinator.ts       Zustand, NOT persisted: active surface, hosts, budgets — §4
hooks/v2/guidance/useGuidanceHost.ts   screen adapter (replaces useTeachingQueue's decision part)
hooks/v2/guidance/useGuidanceAction.ts wraps real target handlers to report confirmed actions — §7
hooks/v2/guidance/discoverySignals.ts  emitters called from existing seams — §8
hooks/v2/guidance/surfaceLocks.ts      reads celebration / modal / keyboard state — §4.3
components/v2/guidance/*               ContextBubble, SceneLine, Whisper (existing), InlineIntro
```

**Kept as is:**

- `encryptedPersistStorage`.
- `useTeachingFocus`, which supplies `isFocused` and `transitioning`.
- `measureTeachingTarget` and `scrollToTarget`.
- Each screen's idle gate (`homeIsIdle`, the Practice and Progress `blocked` expressions, `visionTeachingBlocked`, the Chart show conditions).
- `ChartOneMoveTeaching`'s sheet-visibility logic, as G6's target provider.
- `ThreadStrengthExplainerSheet`, the completion-scene choreography, and the milestone store and presenter.

**Retired after migration:**

- `useTeachingQueue` (decision logic), `teachingSession`, `SpotlightCoach`'s full scrim.
- `chartTaughtState` (folded into the records).
- The `replayAppTeaching` and `chartReplayOneMoveTeaching` DeviceEventEmitter strings.
- The legacy `teachingStore` flags for Thread education.

---

## 3. Outcome and record model

```ts
type GuidanceOutcome = 'dismissed' | 'acknowledged' | 'action_performed' | 'obsolete';
type ObsoleteReason = 'learned_by_use' | 'preexisting_history' | 'version_retired' | 'not_applicable';

interface GuidanceRecord {
  id: string;                  // registry id, e.g. 'today.recommended'
  version: number;             // registry version when the record was written
  displayCount: number;        // times it reached "displayed" (dwell met)
  firstDisplayedAt?: string;
  lastDisplayedAt?: string;
  presentAttempts: number;     // presentations started (dwell met or not), for maxAttempts
  interruptCount: number;      // system interruptions after display (not user outcomes)
  outcome?: GuidanceOutcome;
  outcomeAt?: string;
  outcomeDetail?: string;      // e.g. 'target:circle', 'link:explainer', 'via:scrim'
  obsoleteReason?: ObsoleteReason;
  variant?: string;            // e.g. G2 'A' | 'B'
}
```

**Definitions** (these are what analytics and tests assert):

- **displayed** — the surface was rendered, the app was active, nothing outranking it covered it, and it stayed visible for **≥ 1000 ms** (`DISPLAY_DWELL_MS`). Mounting alone doesn't count. The coordinator starts a dwell timer when the surface reports `onVisible` (after measurement and entry animation). It cancels the timer on cover, background or unmount. Only a completed dwell increments `displayCount`.
- **dismissed** — the user closed it without acknowledging: ×, scrim tap, Android back, or swiping the host sheet away while visible.
- **acknowledged** — the user pressed the surface's primary button ("Got it").
- **action_performed** — the user used the highlighted target or the teaching's link, **and the real action reported success** (§7).
- **obsolete** — the teaching no longer applies: learned independently (`learnedWhen`), pre-existing history at first boot, retired by a version bump, or permanently ineligible.
- **interrupted / preempted** — system events (blur, background, celebration start, target lost, sheet hidden). These are **not outcomes**. The record stays unsettled; only `presentAttempts` and `interruptCount` change.

**Settled** (never shown again, unless Replay):

```
settled(rec, def) = rec.outcome !== undefined
                 || (def.completion === 'on_display' && rec.displayCount > 0)
                 || rec.presentAttempts >= def.maxAttempts      // becomes obsolete('not_applicable')
```

**State machine (per teaching, per account):**

```
            learnedWhen / history / retire
  ┌──────────────────────────────────────────────► OBSOLETE (settled)
  │
UNSEEN ──present──► PRESENTING ──dwell 1s──► DISPLAYED ──► × / scrim / back ──► DISMISSED (settled)
  ▲                     │                       │  ├─────► Got it ─────────────► ACKNOWLEDGED (settled)
  │                     │ cover/blur/bg <1s     │  ├─────► target ✓ / link ✓ ──► ACTION_PERFORMED (settled)
  └──────(unsettled)────┘                       │  └─────► cover/blur/bg ───────► UNSETTLED (interruptCount++)
                                                │
                       completion:'on_display' ─┴───────────────────────────────► settled at dwell (G2, G4)
```

---

## 4. Coordinator

### 4.1 State (memory only)

```ts
interface CoordinatorState {
  accountKey: string;                    // accountId or 'guest'
  hosts: Map<HostKey, HostRegistration>; // focused, mounted hosts (usually one)
  active: { token: string; id: string; hostKey: HostKey; startedAt: number; dwellMet: boolean } | null;
  sessionId: string;                     // new on cold start or after ≥30 min in background
  sessionBubbles: number;                // unsolicited Context Bubbles shown this foreground session
  visitShown: Set<HostKey>;              // hosts that already showed a recorded teaching this visit
}

interface HostRegistration {
  hostKey: HostKey;   // `${screen}:${routeKey}` — routeKey from React Navigation, unique per visit
  screen: GuidanceScreen;
  context: { anchorId?: string; courseId?: string; sceneInstanceId?: string };
  ready: boolean;     // host's existing idle gate && focused && !transitioning
  signals: () => GuidanceSignals;          // live read of existing stores (§5.2)
  targets: Record<string, TargetProvider>; // measured rects (§7)
  present: (p: Presentation) => void;      // host renders the surface
  hide: (token: string) => void;
}
```

### 4.2 Decision: no message queue

The coordinator keeps **no list of pending messages**. On each *evaluation tick* it computes, from live state, the single best candidate **for the currently ready host**.

A tick runs on host `ready` turning true, on the end of a surface lock, on a discovery signal, and on app foreground. When the host changes, the candidate simply disappears. That is how "wait" never becomes "stale".

```ts
function evaluate() {
  const host = readyFocusedHost();                 // at most one
  if (!host || state.active) return;
  if (outrankedNow()) return;                      // §4.3 — celebration, modal, keyboard, …
  if (!showTipsEnabled()) return;                  // P-2; Scene Lines and Inline Intros still pass when def.surface allows
  const sig = host.signals();
  const candidates = REGISTRY
    .filter(def => def.hosts.includes(host.screen))
    .filter(def => !settled(records.get(def.id), def))
    .filter(def => { if (def.learnedWhen(sig)) { records.obsolete(def.id, 'learned_by_use'); return false; } return true; })
    .filter(def => def.eligible(sig, host.context))
    .filter(def => depsSatisfied(def))             // soft ordering only
    .filter(def => withinBudget(def, host))
    .filter(def => host.targets[def.target]?.available() !== false)
    .sort(byPriorityThenRegistryOrder);
  const def = candidates[0];
  if (!def) return;
  const token = uuid();
  state.active = { token, id: def.id, hostKey: host.hostKey, startedAt: now(), dwellMet: false };
  records.attempt(def.id);                          // presentAttempts++
  host.present({ token, def, copy: resolveCopy(def, sig, host.context) });
  // presentation must start within PRESENT_WINDOW_MS (1500) of selection, or it is abandoned (no record change beyond attempt)
}
```

### 4.3 Priority arbitration and celebration rule

From highest to lowest:

1. **Celebrations and story moments:**
   - milestone presenter queue non-empty (`milestoneCelebrationStore.queue.length > 0` — `useMilestonePresenter` keeps the presenting item at `queue[0]`);
   - `V2ThreadEventModal` presentable;
   - Home first-Anchor or practice arrival active;
   - Chart opening, reach or commit ceremony;
   - release burn;
   - the practice completion scene itself (its own Scene Line is the only guidance allowed inside it).
2. **User-initiated UI:** explainer sheet, menus, share, pickers, switcher, layout sheet, keyboard, `V2DialogManager` dialogs, native alerts, paywall, purchase or restore.
3. **P0 guidance** (G6 Chart, G2 Scene Line).
4. **P1 guidance** (G1, G4, G5).
5. **P2 guidance** (G3, G7, G8).
6. **Inline copy** (always rendered; not arbitrated).

Rules:

- **Outranked ⇒ don't present.** `outrankedNow()` is true while any level-1 or level-2 condition holds.
- **Yield on arrival.** If a level-1 or level-2 condition becomes true while guidance is visible, the coordinator hides it at once: outcome `preempted`, record unsettled, `interruptCount++`. Guidance never animates over a starting celebration. Hiding is a 120 ms fade, or instant with Reduce Motion.
- **Never hold.** Guidance never calls `useMilestonePresentationHold`. The presenter ends a playing presentation whenever any hold exists (`useMilestonePresenter.ts:47`), so a guidance hold would *interrupt* a celebration.
- **After a celebration, the same visit stays quiet:**
  - If a level-1 event occurred during the current host visit, no Context Bubble presents for the rest of that visit.
  - Inline intros and Scene Lines are unaffected, but a Scene Line that was covered before dwell is not counted.

### 4.4 Budgets

| Budget | Value | Applies to |
|---|---|---|
| Visible recorded teachings app-wide | 1 | all recorded surfaces |
| Per host visit | 1 | Context Bubble, Whisper |
| Per foreground session | 1 new unsolicited Context Bubble (+ P0 G6 may add one) | Context Bubble |
| Session boundary | cold start, or foreground after ≥ 30 min in background | replaces Phase 1's per-process counter |
| `maxAttempts` | G1 3 · G3 2 · G5 3 · G6 3 · G7 2 | presentations, then `obsolete('not_applicable')` |
| Exempt from the session budget | G2 Scene Line, G4 Whisper, G8 Inline Intro | still obey single-visible and celebration rules |

### 4.5 Lifecycle edge cases

| Situation | Behaviour |
|---|---|
| Rapid navigation | Hosts never reach `ready`; nothing is selected; no record changes. |
| Background during a surface | Hide; `interrupted`; dwell cancelled; re-evaluate on foreground after host `ready` again. |
| Remount (same route) | Same `routeKey` ⇒ the same visit; `visitShown` prevents a second bubble. |
| New visit to the same screen | New `routeKey` ⇒ eligible again if unsettled and the budget allows. |
| Target lost or unmeasurable | Hide before showing; no attempt counted if never visible; host may retry once in the same visit. |
| Interrupted animation or scroll | The surface stays hidden while the provider re-measures (window, keyboard or sheet change). |
| Offline | Fully local; unaffected. |
| Guest → account | Promote the guest record set into the account (existing `teachingSeen` approach, §6). |
| Account switch or sign-out | `bindAccount()` hides any surface, clears memory, loads the new account's records. |
| Reinstall or new device | Records are local (P-6), so teachings may show again; `learnedWhen` makes most obsolete from synced history (anchors, sessions, courses). |
| Subscription change | Entitlement is read live in `signals()`; a teaching whose feature isn't available is simply ineligible. |
| Records unreadable (keystore failure) | **Fail closed:** no recorded teachings this session. Inline copy is unaffected. |
| Navigation before target exists | Provider returns `available() === false`; not selected. |

---

## 5. Registry

### 5.1 Definition type

```ts
interface GuidanceDefinition {
  id: string; version: number;
  priority: 0 | 1 | 2;
  surface: 'context_bubble' | 'scene_line' | 'whisper' | 'inline_intro';
  hosts: GuidanceScreen[];                 // e.g. ['home'] ; G1 later ['home','practice']
  target?: string;                         // host target key
  dependsOn?: string[];                    // soft ordering (§ blueprint 6.2)
  eligible: (s: GuidanceSignals, ctx: HostContext) => boolean;
  learnedWhen: (s: GuidanceSignals) => boolean;
  completion: 'on_outcome' | 'on_display';
  maxAttempts: number;
  respectsShowTips: boolean;               // G8 inline intro: true; G2: true (P-2 'off' hides it)
  copy: (s: GuidanceSignals, ctx: HostContext) => GuidanceCopy;   // templating (G1 duration, G2 variant)
}
```

### 5.2 Signals (all from existing stores; nothing new is persisted except records and discovery stamps)

| Signal | Source [V] |
|---|---|
| `accountKey` | `useAuthStore.user?.id ?? 'guest'` |
| `hasCompletedPractice` | `useSessionStore.sessionLog` |
| `hadPracticeBeforeGuidance` | boot stamp (§6.3) |
| `today: {state, mode, durationSeconds, doneToday}` | Home model (`useV2HomeModel`, `todayForDisplay`) |
| `activeAnchorCount`, `switcherRendered` | Practice hub |
| `visionPhotoCount`, `boardIdle` | `V2SavedVision` |
| `scene: {kind, instanceId, gainPositive}` | `usePracticeCompletionScene` (`planPracticeSceneKind`) |
| `chart: {moveVisible, sheetDetent, idle}` | `ChartActiveView` conditions |
| `everCompletedMove` | course store moves with `status === 'COMPLETED'`, any course, plus discovery stamp |
| `threadMeasured` | Progress model `!unmeasured` |
| `recapWeeksViewed` | discovery stamp (§8) |
| `showTips` | settings (P-2) |
| entitlement | `useSubscriptionStore` / `useTrialStatus` (none of the current eight need it) |

The per-teaching eligibility, blockers, completion and recurrence are in the blueprint §6 table. That table is normative.

---

## 6. Persistence

### 6.1 Storage

- **Key:** one encrypted JSON blob per account, `anchor:v2:guidance:<encodeURIComponent(accountId)>` (guest: `guest:guidance`).
- **Shape:** `{ schema: 1, bootedAt, hadPracticeBeforeGuidance, records: Record<id, GuidanceRecord>, discovery: Record<string, string /*ISO*/> }`.
- **Writes:** serialised per key, using the same pattern as `teachingSeen.write()`. Every write is a read-modify-write of the in-memory copy, debounced 250 ms. An immediate flush happens on settle and on background.
- Writes are presentation-only: failures are swallowed, and the next session retries from memory if still running.

### 6.2 Guest promotion

On first account read, if the account blob is absent or lacks a record the guest blob has, copy the guest records and discovery stamps in. **Settled wins over unsettled; the earlier `firstDisplayedAt` wins.** Then delete the guest blob. This mirrors `teachingSeen.ts:28-41`.

### 6.3 First boot and migration (runs once per account)

1. `bootedAt = now`; `hadPracticeBeforeGuidance = sessionLog.length > 0`.
2. Map existing keys to records:

| Existing key | New record |
|---|---|
| `anchor:v2:teach:home.today:*`, `…practice.today:*` | `today.recommended` → `acknowledged` (`outcomeDetail: 'migrated'`) |
| `…vision.first:*` | `vision.first_photo` → displayed (settled, on_display) |
| `…vision.second:*` | `vision.lead_image` → `acknowledged` (migrated) |
| `…practice.switch:*` | `practice.switch_anchor` → `acknowledged` |
| `…progress.thread:*` | `progress.levels` → `acknowledged` |
| `anchor:v2:chart2:taught:*` (and legacy per-course keys, as `chartTaughtState` already migrates) | `chart.next_move` → `acknowledged` |
| `home.progress`, `home.thread`, `home.vision`, `home.chart`, `details.*`, `progress.week/rhythm/route` | none. **Thread exposure does not settle `thread.glow`** (D-03: existing users get the glow lesson once) |
| legacy `teachingStore.userFlags.hasSeenThreadStrengthEducation === true` | none. `thread.glow` stays unsettled, so the user gets variant B on their next gaining practice (D-03) |

3. Apply `learnedWhen` to every definition (history may already make G1, G3, G5, G6 obsolete with `preexisting_history`).
4. Old keys are left in place for one release, for rollback, then deleted by a cleanup step.

### 6.4 Replay ("Replay tips")

Clears `records` (not `discovery`, not `bootedAt`). Then re-applies `learnedWhen` immediately. So Replay shows only teachings that still make sense: for example, a user with completed moves will not see G6 again.

[D] Alternative: Replay ignores `learnedWhen` once, showing everything as a refresher. Recommended default: **respect `learnedWhen`.**

### 6.5 Versioning

Bumping `definition.version`:

- If `def.reteachOnVersion` is true, records from older versions become unsettled.
- Otherwise they stay settled.
- Retiring an id writes `obsolete('version_retired')`.

---

## 7. Targets and real actions (pass-through)

**Surfaces never intercept touches inside the target.**

- A Context Bubble has no scrim (Chart: a ring plus a ≤0.24 dim, outside the target only).
- The hole and the target area use `pointerEvents="none"` on the overlay.

**Recording the action.** Each host wraps the target's real handler:

```ts
const report = useGuidanceAction('today.recommended', 'target:today');
<TodayCard onPress={report(handlePracticePress)} />            // sync: success = handler didn't throw and navigation fired
<ChartOneMoveRow onCheck={report.async(() => completeMove(id))} /> // async: success only when it resolves true
```

`report` is inert unless that teaching is the active surface (token match). On success it settles `action_performed` with `outcomeDetail`, then hides the surface. On failure (`false` or a throw) the surface hides with `interrupted`; the record stays unsettled.

| Teaching | Target(s) | Counts as action_performed when |
|---|---|---|
| G1 | Today card | `handlePracticePress` runs and navigation is dispatched |
| G2 | "What's Thread Strength?" link | explainer sheet becomes visible |
| G3 | switcher | switcher opens |
| G5 | lead slot or any photo | `onReorder` resolves `true` |
| G6 | circle / words | `completeMove` resolves `true` / the row expands |
| G7 | hero score, "How it works" | explainer sheet becomes visible |

**Measurement.** `TargetProvider = { available(): boolean; measure(): Promise<Rect | null> }`, built on the existing `measureTeachingTarget` and `scrollToTarget`. Re-measure on `useWindowDimensions`, keyboard and sheet-detent change. While re-measuring, the bubble is hidden (opacity 0), not dismissed.

**Accessibility.**

- The bubble is announced politely and is focusable.
- It isn't modal (no `accessibilityViewIsModal`), so the target stays reachable.
- The Android back button dismisses it.
- Chart's dim is not modal either.

---

## 8. Discovery signals (independent learning)

These are emitted from existing seams, persisted as stamps (`discovery[signal] = ISO`), and drive `learnedWhen` for teachings that were never shown:

| Signal | Seam [V] | Retires |
|---|---|---|
| `practice.completed` | completion save confirmed (`V2FocusCompleteScreen` `sessionSaved`) | G1 |
| `thread.explainer_opened` | `ThreadStrengthExplainerSheet` visible (Details, Progress hero, G2 link) | G2, G7 |
| `practice.switcher_opened` | `V2PracticeScreen` `setIsSwitcherOpen(true)` | G3 |
| `vision.photo_count>=2` | `V2SavedVision` tiles | G4 |
| `vision.reordered` | `onReorder` → true | G5 |
| `chart.move_completed` | `handleCompleteMove` → ok | G6 |
| `weekly.week_viewed` | V2 recap rendered for a distinct week key | G8 (after 2 weeks) |

---

## 9. Integration per host

| Host | Ready = (existing gate) | Registers | Notes |
|---|---|---|---|
| Home | `homeIsIdle` (`V2HomeScreen.tsx:487-490`) | target `today` (`todayTeachingRef` through `scrollToTarget`) | G1 copy reads `model.today` |
| Practice hub | Phase 1 `blocked` inverted | `switcher`, `today` (G1 fallback) | |
| Completion scene | scene planned, kind ∈ {first, repeat}, chrome visible | `sceneLine` slot (`sublineText` style beside the note, `V2FocusCompleteScreen.tsx:466-478`) | Subline fades in after note + `noteInMs`; the link sits under it. Dwell starts when the subline is fully opaque. **If the scene is skipped**, it appears in the settled state. |
| Vision board | `!visionTeachingBlocked` | `leadSlot` via `projectTeachingSlot` | G4 Whisper unchanged |
| Chart | the conditions at `ChartActiveView.tsx:611-620` | `row`, `circle`, `body` (existing refs and visibility requests) | G6 one step |
| Progress | Phase 1 `blocked` inverted | `hero` | |
| Weekly recap | recap content rendered | inline slot at top | G8 inline |

---

## 10. Settings

- **"Show tips"** (P-2): `settingsStore.showTips` (new, default `true`, synced locally only). When off, no recorded teaching presents; inline copy remains. It replaces the 2.0 "Guide mode" row; `guideMode` remains for 1.5.
- **"Replay tips"** (Help & about): §6.4. It emits `guidance.replay` to the coordinator, not a DeviceEventEmitter string.

---

## 11. Analytics

Built on `AnalyticsService` (PostHog). Common props: `{ guidance_id, version, variant, surface, priority, screen, session_index, days_since_boot }`.

| Event | When | Extra |
|---|---|---|
| `guidance_displayed` | dwell met | `attempt` |
| `guidance_dismissed` | user | `via: x/scrim/back/sheet` |
| `guidance_acknowledged` | Got it | — |
| `guidance_action_performed` | confirmed action | `detail` |
| `guidance_obsoleted` | learnedWhen, history, retire | `reason` |
| `guidance_interrupted` | system | `reason: celebration/blur/background/target_lost/modal` |
| `guidance_suppressed` | sampled 10 %, only budget/outranked decisions | `reason` |

These replace `teaching_beat_*` after cutover. Keep both during shadow mode (§13).

---

## 12. Testing

**Unit:**

- The state machine (every arrow in §3) and `settled()`.
- The dwell timer: cover before 1 s ⇒ not displayed.
- Budget math, including the 30-minute session boundary.
- Priority order.
- `outrankedNow()` against every level-1 and level-2 source.
- `learnedWhen` for each definition.
- Migration table rows.
- Guest promotion merge.
- Fail-closed when storage is unreadable.
- Replay respects `learnedWhen`.
- Registry lint (copy rules, blueprint §7).

**Integration (RNTL, real stores):**

1. Enqueue a milestone while G1 is visible ⇒ G1 hides; record unsettled; the celebration plays uninterrupted.
2. Tap Today with G1 visible ⇒ navigation, then `action_performed`.
3. G6 circle tap with `completeMove` → false ⇒ `interrupted`, unsettled.
4. Home → Vision → Home within 1 s ⇒ no record change.
5. Background mid-dwell ⇒ not displayed.
6. Account switch mid-surface ⇒ hidden; the new account's records load.
7. First-scene G2 covered by a celebration at 0.6 s ⇒ not displayed. The next `repeat` scene shows variant A or B per the eligibility rule.
8. Static: no guidance module imports `useMilestonePresentationHold`.

**Device (iOS and Android):**

- Target measurement with notch and gesture insets; font scale 200 %; split-screen resize mid-bubble.
- TalkBack and VoiceOver: bubble announced, target reachable, back dismisses.
- Reduce Motion: no movement, instant hide.
- Low-end Android: no frame drops in the completion scene with the subline.

---

## 13. Rollout

1. **Shadow mode** (`EXPO_PUBLIC_GUIDANCE_COORDINATOR=shadow`). The coordinator evaluates and logs `guidance_shadow_decision {id|null, reason}`, but Phase 1's queue still presents. Compare decisions for a week of internal use.
2. **On** (`=on`). Hosts render coordinator presentations; `useTeachingQueue` is bypassed; migration runs.
3. **Cleanup release.** Delete old keys, `teachingSession`, `chartTaughtState` and DeviceEventEmitter strings; retire the automatic Details card (P-4) once G2 is live.

**Order of work:**

1. Records and migration.
2. Coordinator and locks.
3. Hosts: Home, Chart, Vision.
4. Context Bubble component.
5. G2 Scene Line.
6. G3, G7, G8.
7. "Show tips".
8. Analytics.

**Estimated effort:** 6–9 days of engineering plus device QA.

---

## 14. Files (expected)

- **New:**
  - `constants/v2/guidanceRegistry.ts`
  - `stores/v2/guidanceRecords.ts`, `stores/v2/guidanceCoordinator.ts`
  - `hooks/v2/guidance/{useGuidanceHost,useGuidanceAction,discoverySignals,surfaceLocks}.ts`
  - `components/v2/guidance/{ContextBubble,SceneLine,InlineIntro}.tsx`
  - tests beside each
- **Modified:**
  - Host screens: `V2HomeScreen`, `V2PracticeScreen`, `V2FocusCompleteScreen`, `V2SavedVision`, `ChartActiveView`, `V2ProgressScreen`, `V2WeeklyRecapScreen`.
  - `HelpAboutSubscreen`, `PracticeSubscreen` (Show tips), `settingsStore` (`showTips`).
  - `teachingCopy.ts`, `usePracticeCompletionScene.ts` (stop setting the Details-card flag, P-4).
- **Unchanged by rule:** Thread scoring and `ThreadAura`, Chart, Vision and Practice business logic, the milestone store and presenter, onboarding.
