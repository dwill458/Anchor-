> **Superseded design.** This is v1 of the audit, kept for its verified evidence (§2). Decisions, registry and plans are in `ANCHOR_MICRO_TEACHING_AUDIT_AND_BLUEPRINT.md` (v2).

# Anchor 2.0 — Micro-Teaching System Audit & Experience Blueprint

**Repository:** `E:\Projects\Anchor\` · **Audited:** 2026-10-26 · **Scope:** `anchor/mobile/src` (read-only; no production code changed)
**Status:** Audit + design handoff. Implementation has not started.

Legend used throughout:

- **[V]** Verified in code (file + line cited).
- **[P]** Proposed design decision.
- **[A]** Assumption or open question that needs runtime validation or a product decision.

---

## 0. Executive summary

1. **There are four teaching systems, not one.** [V]
   - **Legacy registry** (`constants/teaching.ts`, `stores/teachingStore.ts`, `utils/useTeachingGate.ts`, `components/teaching/*`) — 27 entries written for Anchor 1.5 ("Prime", "Charge", "Burn", "Stabilize", "Vault").
   - **V2 beat queue** (`constants/v2/teachingCopy.ts`, `hooks/v2/teaching/*`, `components/v2/teaching/*`) — 15 beats on Home, Anchor Details, Practice, Progress and Vision.
   - **Chart One Move coach** (`components/v2/chart/sheet/ChartOneMoveTeaching.tsx`, `hooks/v2/chart/chartTaughtState.ts`) — a second, hand-copied spotlight with its own persistence and its own replay event.
   - **Thread Strength education** (`components/v2/thread/ThreadStrengthEducationCard.tsx`) — an inline card driven by flags in the *legacy* store.
2. **Anchor 2.0 is the live navigator.** `isAnchorV2Enabled()` returns `true` unless the env var is literally `'false'` (`config/v2FeatureFlag.ts:1-7`). The comment in `App.tsx:101-102` and `ANCHOR_2_V2_ISOLATION_ARCHITECTURE.md` ("release builds always select RootNavigator") are stale. Consequence: almost the entire legacy registry is unreachable in 2.0. Only `IntentionInputScreen` (reused as `FirstAnchorCreation`) still runs legacy gates, and those are off by default because `guideMode` defaults to `false` (`stores/settingsStore.ts:574`).
3. **Nothing coordinates across systems.** Each V2 screen runs its own queue; Chart bypasses the per-session cap; the global `MilestoneCelebrationHost` renders "over whatever screen the user is on" with no awareness of teaching, and no teaching surface holds milestone presentation. On Anchor Details, the Thread Strength card and the Vision/Chart spotlight can both qualify on the same visit.
4. **Thread Strength is explained in six places with six different framings**, and none of them uses the glow, the thing users actually see change.
5. **The V2 queue has good bones.** Per-account encrypted persistence with guest→account migration, focus/settle gating, idle gating, window-space measurement with scroll-to-target, and a "discovery suppresses teaching" pattern (`vision.first` is marked seen when the user adds a second photo on their own). **Evolve it; don't replace it.**
6. **Biggest wins with least risk:** (a) put one app-level presentation lock in front of the existing queues, Chart coach and milestone host; (b) delete or rewrite three outdated beats; (c) turn the Anchor Details spotlights into the inline empty-state copy that is already there; (d) make the first glow increase on Home the Thread Strength lesson.

---

## 1. Verified product vocabulary (from current screens)

| Concept | User-facing term in code | Source | Note |
|---|---|---|---|
| Practice modes | **Focus**, **Deep Focus**, **Visualize**, **Release** | `constants/v2/practice.ts:26-29` | [V] Practice hub says **Deep Focus**. Progress (`progressTokens.ts:54`, `progressAdapter.ts:137`) and Home Today (`todayForDisplay.ts:7`) say **Deep Prime**. [A] Product must pick one before any teaching copy names the mode. This blueprint uses **Deep Focus** (what the hub shows). |
| Thread Strength levels | Surface 0–19 · Grounded 20–39 · Rooted 40–59 · Embedded 60–79 · Sovereign 80–100 | `constants/v2/threadEvents.ts:29-39` | [V] |
| Thread scoring (display mirror of server 2.1) | first-practice bonus 12 · daily return +1.5 · 0.5/min · 10-min daily cap · −3/day after grace | `constants/v2/threadStrengthCopy.ts:4-10, 43-49` | [V] Grace depends on sensitivity: Lenient 2 days, Balanced 1 day, Strict none. |
| Glow | Eases from last-seen Thread Strength to the current one on Home | `stores/v2/homeGlowSeenStore.ts:5-9` | [V] This is the natural "show, don't tell" moment. |
| Chart | waypoint, next move ("One Move" internally), Course Log ("COURSE LOG", "View course log") | `constants/v2/chartCopy.ts:43-62, 70, 237` | [V] Users see "next move" in sentence case. |
| Release | "Release this intention", "Hold to release" | `constants/v2/release.ts:136-146` | [V] "Burn the sigil…" is marked DEFERRED / vocabulary-locked; never reuse. |
| Weekly Insight | Global recap behind `EXPO_PUBLIC_WEEKLY_INSIGHT_V2` and server flag; reached by pull from Home/Progress | `constants/v2/weeklyInsightFlags.ts`, `screens/v2/home/dailyShell.tsx:108` | [V] There is no scheduled auto-present in the client. |

Legacy registry copy uses vocabulary 2.0 has retired: "Prime", "Stabilize", "Charge", "imprint", "Burn", "Ash Line", "Vault", "Evolve". [V] (`constants/teaching.ts`)

---

## 2. Deliverable A — Current System Audit

### 2.1 Architecture as found

```
                        ┌─────────────────────────── App.tsx ───────────────────────────┐
                        │ anchorV2Enabled (true by default) ? AnchorV2Navigator : Root… │
                        └────────────────────────────────────────────────────────────────┘
 V2 BEAT QUEUE (per screen, independent)        CHART COACH (separate)          LEGACY (mostly unreachable)
 Home ─┐                                         ChartActiveView                  IntentionInputScreen ← still live
 Details ─┤ useTeachingQueue ─ ScreenTeaching    └ ChartOneMoveTeaching           useTeachingGate + teachingStore
 Practice ─┤   └ teachingSeen (encrypted,          └ chartTaughtState              (guideMode=false ⇒ silent)
 Progress ─┤      per account)                      (encrypted, per account)      anchorStore/sessionStore still
 Vision ──┘   └ teachingSession (1 coach/process)   no session cap                 queueMilestone() → never drained
                                                                                   in V2 (drain lives in MainTabNavigator)
 THREAD EDUCATION: usePracticeCompletionScene sets legacy flag → Details renders ThreadStrengthEducationCard
 GLOBAL OVERLAYS NOT COORDINATED WITH ANY OF THE ABOVE: MilestoneCelebrationHost, V2ThreadEventModal (Home only gates it)
```

### 2.2 Inventory — V2 beat queue (live)

Mechanics, all [V]:

- **Eligibility** is a pure function per screen (`hooks/v2/teaching/{home,details,practice,progress,vision}Teaching.ts`).
- **Decision:** `useTeachingQueue` (`useTeachingQueue.ts:38-63`) waits for `isFocused && !blocked`, reads `seen` for every candidate, waits for `scheduleAfterInteractions`, then freezes a batch of up to `cap` unseen beats. The batch is decided once per focus.
- **Session cap:** `MAX_COACH_SEQUENCES_PER_SESSION = 1` is a module variable (`teachingSession.ts:1-16`). "Session" means JS process lifetime. It is never reset on background or foreground. `vision.first` is exempt.
- **Persistence:** `markShown(beat)` sets seen **when the beat is displayed** (`useTeachingQueue.ts:65-76`). Dismissing commits **every non-skipped beat in the batch, including ones never displayed** (`ScreenTeaching.tsx:46-48`, `useTeachingQueue.ts:77-84`).
- **Keys:** `anchor:v2:teach:<beat>:<accountId>` or `guest:teach:<beat>`. Guest flags migrate into the account on first read (`teachingSeen.ts:7-46`). Storage is local only (`encryptedPersistStorage`).
- **Replay:** Settings › Help & about › "Replay app tips" (`HelpAboutSubscreen.tsx:55-67`) resets V2 seen, Chart taught, the legacy store **and its `userFlags`**, and the legacy practice key, then emits `replayAppTeaching` and `chartReplayOneMoveTeaching`.
- **Presentation:** `SpotlightCoach` dims the full screen (`rgba(14,14,12,0.64)`), cuts a hole round the target, and places a cream tip above or below. Tapping inside the hole **dismisses** rather than acting (`SpotlightCoach.tsx:116-117`). The button is 40 pt tall (<44). Colours are hard-coded (`#F4EFE6`, `#1D1B18`) rather than `theme/v2` tokens (`#F4F1E9`, `#171717`). `TeachingWhisper` is a bottom pill that auto-dismisses after 8 s.
- **Analytics:** `teaching_beat_shown | _advanced | _dismissed` with `{screen, beat, step, total, reason}` (`utils/v2/teachingAnalytics.ts`).

| # | Beat ID | Screen / target | Copy (title — body) | Trigger / eligibility [V] | Works? | Fit for 2.0 | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `home.today` | Home · Today card | "A little focus goes a long way." — "Each day Anchor picks a short practice to bring you back to your goal. Begin it here." | Home idle, has selected anchor; always first | Yes (subject to Home idle gate) | Good concept. Full scrim is too heavy for one card. | **MODIFY** → Context Bubble, no scrim |
| 2 | `home.progress` | Home · Progress card (no Vision yet) | "Your progress starts here." — "Every practice builds your Thread Strength, and it fades slowly if you stop. Tap to see your full progress." | `!hasVision` | Yes | Teaches Thread Strength before the user has practiced; leads with fading. Duplicates #12 and the Details card. | **REPLACE** with `thread.glow_grew` (§4) |
| 3 | `home.vision` | Home · Vision card | "Keep your future in sight." — "Your Vision gives the future…" | `hasVision` | Yes | Teaches a feature the user already created. Low value. | **REMOVE** (fold into discovery logic) |
| 4 | `home.chart` | Home · Chart card | "Turn your vision into movement." — "Your Chart breaks a big goal into smaller milestones…" | `hasChart` | Yes, but `cap:2` and position 3 mean it rarely shows | Same problem as #3. Uses "milestones" where the Chart says "waypoints". | **REMOVE** |
| 5 | `home.thread` | Home · Thread Strength row | "Your progress lives here now." — "Your Vision has taken the Progress card's place on Home…" | `hasVision` | Yes | **Migration copy shown to brand-new users** who never saw a Progress card on Home. | **REMOVE** (one-time `migration.home_progress_moved` for upgraded users only, if wanted) |
| 6 | `details.vision` | Details · Vision section | "See the future you're building." — … | `!hasVisionContent` | Yes | The section is already an empty dashed row: "Add Vision · See where this leads." (`V2AnchorDetailsScreen.tsx:72-77, 432-435`). Spotlighting a self-explaining row adds a scrim, not meaning. | **REPLACE** → Inline Guidance (richer payoff line) |
| 7 | `details.chart` | Details · Chart section | "Give your goal a path forward." — … | `chart.state === 'none'` | Yes | Same as #6 ("Create Chart · Map the path from here."). | **REPLACE** → Inline Guidance |
| 8 | `practice.today` | Practice hub · Today | "Today's practice is picked for you." — "A few minutes to return to your intention. Everything below is yours to choose." | hub idle | Yes | Useful but overlaps #1. | **MODIFY** — show only if #1 was never shown (shared concept ID `today.recommended`) |
| 9 | `practice.switch` | Practice · anchor switcher | "Switch anchors here." — "Tap to practice a different anchor." | ≥2 active anchors and switcher rendered | Yes | Right trigger (appears when it becomes relevant). | **KEEP** → Context Bubble |
| 10 | `progress.thread` | Progress hero | "This is your Thread Strength." — "It grows when you practice and fades slowly when you don't. The five stages…" | `!unmeasured` | Yes | Accurate. Should be the "deeper" layer after the glow lesson. | **MODIFY** → Context Bubble; depends on `thread.glow_grew` or Details card |
| 11 | `progress.week` | Progress · week dots | "Your week at a glance." — "…One grace day a week covers a single missed day…" | `hasWeek` | Yes | Accurate for streak grace (`sessionStore.lastGraceDayUsedAt`), but "grace" also means Thread decay protection (`THREAD_STRENGTH_DECAY_COPY`). Two meanings of one word. | **MODIFY** → Inline caption; rename one of the two "grace" concepts [A] |
| 12 | `progress.rhythm` | Progress · rhythm | "Your rhythm is your record." — "Practices, minutes and Moves…" | `hasRhythm` | Yes | Restates the chart's own labels. | **REMOVE** (the labels teach it) |
| 13 | `progress.route` | Progress · route crop | "Your route, at a glance." — … | `hasRoute` | Yes | Restates a tappable thumbnail. | **REMOVE** |
| 14 | `vision.first` | Vision board · whisper pill | "Images make the future feel real. Add another and choose which one leads." | exactly 1 photo; auto-marked seen once the user has ≥2 photos (`V2SavedVision.tsx:249-251`) | Yes | Best-designed beat in the app: brief, non-modal, suppressed by discovery. | **KEEP** (generalise its discovery rule) |
| 15 | `vision.second` | Vision board · lead slot | "Choose the image that leads." — "Drag photos into any spot. The one in the top spot leads, and it's the image Home shows." | ≥2 photos | Yes | Explains a hidden rule (top slot = Home image). Only overlay in Vision that earns one. | **KEEP** → single-step Spotlight, lighter scrim |

### 2.3 Inventory — Chart One Move coach (live)

[V] `ChartActiveView.tsx:331-395, 611-633`; copy `constants/v2/chartCopy.ts:43-62`.

- Three beats over the One Move sheet row, done circle, and body. Copy: "This is your next move." / "The circle is for done." / "The words are for detail."
- Shows once the map opening has finished, the runner is idle, there is no ceremony, reach, confirm or menu, the sheet is at `peek`/`half`, and at least one waypoint has a move.
- Marked taught **on the first beat being ready** (`markTeachingShown`), per account (legacy per-course keys migrate). Interrupting it on beat 1 means it never returns.
- **Bypasses `teachingSession`**, so a Home coach and a Chart coach can both run in one cold start.
- Duplicates `SpotlightCoach` (≈240 lines of the same scrim/hole/tip geometry) with its own sheet-aware visibility logic, which is genuinely needed.
- **Verdict: MODIFY.** The content is P0 (it prevents marking moves done before doing them). Cut it to two steps (row, then circle) and move the "detail" beat inline. Put it behind the shared coordinator. Keep its sheet-visibility logic as a `TargetProvider`.

### 2.4 Inventory — Thread Strength education (live)

[V] `ThreadStrengthEducationCard.tsx`, set by `usePracticeCompletionScene.ts:633-639`, rendered at `V2AnchorDetailsScreen.tsx:1168-1175`.

- After the **first** practice scene actually starts, it sets `threadStrengthEducationPending`. On the next Anchor Details visit, an inline card appears: "Your Anchor is taking hold." / "Every time you return to practice, your Thread Strength grows. As it strengthens, your Anchor's glow becomes more vibrant." / "Thread Strength is now {n}, {level}." with "How Thread Strength works" (opens `ThreadStrengthExplainerSheet`) and "Got it".
- Good: inline, accurate, links to the deep explainer, and doesn't promise numbers.
- Problems: (a) it can coexist with the `details.vision` spotlight on the same visit, because the Details queue `blocked` ignores it; (b) flags live in the legacy store, which is device-global and wiped on sign-out (`authStore.ts:474-483, 1230`) and by "Replay app tips"; (c) it uses `borderLeftWidth: 3`, the left-border-accent pattern the design guidance says to avoid; (d) if the user never opens Details, they never get it.
- **Verdict: KEEP content, MODIFY plumbing.** Make it registry item `thread.first_practice` (Learning Card, inline). Register it with the coordinator so Details overlays defer. Move its flags to per-account guidance state.

### 2.5 Inventory — legacy registry (`constants/teaching.ts`)

All gates are in `useTeachingGate.ts` [V]: returning-user suppression, `guideOnly` requires `guideMode`, lifetime exhaustion, session-seen, per-teaching cooldown, one Ground Note per session, 24 h Veil Card cooldown and keyboard suppression.

| Teaching ID | Host screen | Reachable in 2.0? | Verdict | Reason |
|---|---|---|---|---|
| `intention_input_first_time_v1` "Say it plainly, like you would out loud." | `IntentionInputScreen` (route `FirstAnchorCreation`) | **Yes**, but `guideOnly` and `guideMode` defaults to `false` ⇒ silent for most users. The copy is also rendered in the "Short. Present. Felt." info sheet regardless (`IntentionInputScreen.tsx:473-480`). | **REPLACE** | Use V2 `assessIntention()` (`components/v2/creation/intentionGuidance.ts`), already written for the dev-only `V2Creation`, as inline Short · Present · Felt chips. |
| `intention_input_hesitation_v1` "If it reads like a headline, make it simpler." | same | Same, plus an idle timer | **REPLACE** | Same as above. Hesitation timers interrupt typing (Rule 1). |
| `milestone_first_anchor_v1`, `milestone_first_charge_v1`, `milestone_first_burn_v1` toasts | queued by `anchorStore.addAnchor` (`:323-332`) and `sessionStore` (`:616-630`); drained only by `MainTabNavigator.tsx:303-331` | **Queued yes, drained no.** `pendingMilestones` grows in persisted storage and is never shown in 2.0. | **REMOVE** (stop queuing under V2; clear on migration) | V2 has `MilestoneCelebrationHost` and the first-practice scene. |
| `activation_ground_note_v1`, `completion_seal_whisper_v1`, `confirm_burn_*`, `burn_ash_line_v1`, `post_burn_toast_v1`, `distillation_first_time_v1`, `structure_forge_first_time_v1`, `lock_structure_first_time_v1`, `enhancement_choice_first_time_v1`, `style_selection_first_time_v1`, `charge_setup_first_time_v1`, `evolve_intro_v1`, `visualize_scene_explainer`, `visualize_controls_hint`, `vault_intro_first_time_v1`, `anchor_reuse_v1`, `anchor_history_v1`, `practice_thread_strength_v1`, `mode_prime_v1`, `mode_stabilize_v1`, `mode_release_v1` | Legacy screens (`screens/rituals/*`, `screens/create/{Distillation,StructureForge,LockStructure,EnhancementChoice}`, `screens/vault/*`, `screens/visualize/*`, `screens/practice/*`) | **No** — none of these routes is registered in `AnchorV2Navigator.tsx:593-636`. | **REMOVE at cutover** (keep while `RootNavigator` can still be selected) | 1.5 vocabulary ("Prime", "Charge", "Burn", "Vault"). `practice_thread_strength_v1` ("shows how recently you've returned") is wrong for scoring 2.1. |
| Trace hints (`constants/traceHints.ts`, `traceHint*` in store) | `ManualReinforcementScreen` | Not in the V2 stack. [A] Confirm `AnchorCreationFlowScreen`'s `DrawControls` doesn't read them. | **INVESTIGATE** | |
| `practice_teaching_auto_seen_v2` (AsyncStorage) | legacy `PracticeScreen.tsx:79` | No | **REMOVE at cutover** | Still reset by Replay. |
| `AnchorRevealScreen` `guideMode` guidance | legacy | No | **REMOVE at cutover** | |

**Settings "Guide mode"** (`PracticeSubscreen.tsx:40, 118-124`): the label says "Show guidance while you create and practice". It reads `guideMode ?? true` while the store default is `false`, and it controls **only legacy teachings**. No V2 beat respects it. **[P] MODIFY**: rename it "Show tips" and make it the coordinator's switch for P1–P3 overlays. Inline guidance and P0 stay on.

### 2.6 Inventory — inline guidance that already teaches (keep, don't duplicate)

| Where | What | Verdict |
|---|---|---|
| `components/v2/vision/visionGuidance.ts` + `VisionMomentInput.tsx` | Word-count hint ("23 words · Add a little more detail for stronger images"), four prompts (Where / Doing / See / What's different) | **KEEP**. This is the model for in-flow teaching. |
| `components/v2/creation/intentionGuidance.ts` | Short · Present · Felt assessment that never fails the user | **KEEP and wire into** `IntentionInputScreen` |
| Details empty rows | "Add Vision · See where this leads." / "Create Chart · Map the path from here." | **KEEP and strengthen** (§7) |
| `ThreadStrengthExplainerSheet` (Details, Progress hero) | On-demand deep explanation | **KEEP** as the P3 "learn more" destination |
| `constants/v2/practice.ts` `purpose` lines | Mode purposes on the hub | **KEEP**. They already answer "why this mode". |
| Release preflight "What releasing this Anchor means" | Consequence explanation before hold | **KEEP**. Release needs no extra teaching. |
| First-anchor Home arrival, first-practice scene, `V2ThreadEventModal`, milestone celebrations | Motion-led reinforcement | **KEEP**. Teaching should attach to these, never compete with them. |

### 2.7 Defects and risks found [V unless marked]

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| D1 | High | No cross-surface mutual exclusion. Milestone celebrations can render over an active spotlight, and Chart's coach ignores the session cap. | `MilestoneCelebrationHost.tsx:12-48`; no `useMilestonePresentationHold` in any teaching file; `ChartActiveView.tsx:611-620` |
| D2 | High | Anchor Details can show the inline Thread card **and** the Vision spotlight on one visit. | `V2AnchorDetailsScreen.tsx:922-926` (blocked omits `education.visible`), `:1168` |
| D3 | Medium | `home.thread` is migration copy shown to new users. | `teachingCopy.ts:10` |
| D4 | Medium | Dismissing step 1 permanently marks unshown steps as seen. "Not now" becomes "never". | `ScreenTeaching.tsx:46-48` |
| D5 | Medium | Spotlight hole swallows taps: the user taps "Begin" on Today and the tip closes instead. It feels broken. | `SpotlightCoach.tsx:116-117` |
| D6 | Medium | Session cap is per process, not per foreground session, so behaviour depends on whether the OS killed the app. | `teachingSession.ts` |
| D7 | Medium | Legacy `pendingMilestones` grows forever under V2. | `anchorStore.ts:323-332`, `sessionStore.ts:616-630`, drain only in `MainTabNavigator.tsx:303` |
| D8 | Medium | "Replay app tips" resets legacy `userFlags`, including `hasSeenFirstAnchorArrival` and `hasSeenFirstPracticeScene`. [A] Could replay the "first Anchor" arrival on the next creation. `resolveArrivalKind` may also check the anchor count — validate. | `HelpAboutSubscreen.tsx:56`, `creationHandoff.ts:71-72` |
| D9 | Low | Thread Strength explained six ways (`home.progress`, `home.thread`, `progress.thread`, education card, explainer sheet, legacy `practice_thread_strength_v1`). | §2.2–2.5 |
| D10 | Low | "Deep Focus" vs "Deep Prime" in user-visible labels. | §1 |
| D11 | Low | Teaching colours hard-coded off-token; CTA 40 pt; the education card uses a left-border accent. | `SpotlightCoach.tsx:131-146`, `ThreadStrengthEducationCard.tsx:82` |
| D12 | Low | All teaching state is device-local. Reinstall or a second device re-teaches everything. | `teachingSeen.ts`, `chartTaughtState.ts` |
| D13 | Info | `App.tsx` comment and the isolation doc describe V2 as opt-in. The code makes it default-on. | `config/v2FeatureFlag.ts` |

---

## 3. Deliverable B — Screen Coverage Matrix

| Screen / Feature | Current Teaching | Problem | Proposed Teaching | Trigger | Priority |
|---|---|---|---|---|---|
| First Run / onboarding (`V2FirstRunFlow`) | None (onboarding is the teaching) | — | **None.** Don't touch onboarding. | — | — |
| Anchor creation — intention (`IntentionInputScreen`) | Legacy whispers (silent by default) + "Short. Present. Felt." info sheet | Dead path, idle timer interrupts typing | `create.intention_principles` Inline: live Short · Present · Felt chips from `assessIntention` | Text ≥3 words, after 600 ms typing pause; no overlay | P1 (inline) |
| Anchor creation — flow (`AnchorCreationFlowScreen`) | None | — | **None.** Motion carries it. Never interrupt. | — | — |
| First-anchor Home arrival | Arrival motion | — | **None during it.** `home.today` waits for `arrival.context.active=false` (already in `homeIsIdle`). | — | — |
| Home | 5 spotlight beats, cap 2 | Heavy scrim, D3, overlap with Progress/Details | `today.recommended` (Context Bubble) · `thread.glow_grew` (Milestone Explanation tied to glow change) | `home.first_ready` after arrival / first upward glow ease after first practice | P1 / P0 |
| Practice hub | `practice.today`, `practice.switch` | Duplicates Home | `today.recommended` (shared concept; only if unseen) · `practice.switch_anchor` | hub ready / ≥2 anchors | P1 / P2 |
| Practice prep (duration) | None | Durations are self-evident | **None** | — | — |
| Active session (Focus / Deep Focus / Visualize) | None in V2 | — | **Never.** Immersive. | — | — |
| Practice complete scene | First-practice scene | — | **None on top of it.** It sets `thread.first_practice` pending. | — | — |
| Anchor Details | Thread card + 2 spotlights | D2; spotlights duplicate empty rows | `thread.first_practice` Learning Card (inline, existing) · `discover.vision` / `discover.chart` Inline Guidance in the existing empty rows | first Details visit after first practice / always when empty | P0 / P2 |
| Vision — creation | Word-count hint and prompts | — | **Keep** · `vision.reference_photo` Inline note in the photo-source step [A — verify current photo-source UI] | Before first generation | P1 (inline) |
| Vision — board | `vision.first` whisper, `vision.second` spotlight | Fine | **Keep both.** Lighter scrim on `vision.second`. | 1 photo / ≥2 photos | P1 |
| Visualize (from Vision) | Legacy only | — | **None in session.** Mode purpose line suffices. | — | — |
| Chart — creation (Ask chat) | None | Chat teaches itself | **None** | — | — |
| Chart — route review / map reveal | None | Users may read fog as "broken" or "locked" | `chart.fog` Inline caption under the reveal, once [A — confirm fog semantics in `chartFogFieldData.ts`] | after map reveal finishes (`openingFinished`) | P1 |
| Chart — One Move sheet | 3-beat spotlight | Interrupt-proofing; bypasses cap | `chart.next_move` 2-step Spotlight (row → circle) | first time a move is visible at peek/half and idle | **P0** |
| Chart — waypoint reached | Reach ceremony + milestone | — | `chart.first_waypoint` Milestone Explanation line appended inside the existing ceremony | `waypoint.reached` #1 | P1 |
| Course Log | None | Discoverable through its CTA | **None** (CTA "View course log" is explicit) | — | — |
| Progress | 4 spotlight beats | Repeats labels | `progress.levels` Context Bubble on hero (only after the glow/Details lesson) · `progress.week` inline caption | first Progress visit with measured Thread | P2 / P3 |
| Weekly Insight | None | — | `weekly.first` Inline intro paragraph inside the first recap; **no overlay** | first recap render | P2 (inline) |
| Milestones collection | None | Self-explaining | **None** | — | — |
| Release | Preflight consequence copy | — | **None** (preflight already teaches) | — | — |
| Share Studio | Layout sheet hint ("Share Studio will suggest…") | — | **None** | — | — |
| Paywall / trial | None | — | **None, by rule.** Teaching never sells. | — | — |
| Guest limits / saving progress | Existing auth/paywall flows | — | **None as teaching.** Account prompts stay with existing auth surfaces. | — | — |
| Settings | Replay app tips | Resets legacy flags (D8) | "Show tips" switch + "Replay tips" | user action | — |

---

## 4. Deliverable C — Teaching Registry (target)

Typed shape [P] (proposed file `constants/v2/guidanceRegistry.ts`; copy stays in `constants/v2/teachingCopy.ts`):

```ts
export type GuidanceCategory = 'orientation' | 'discovery' | 'contextual' | 'reinforcement';
export type GuidancePriority = 0 | 1 | 2 | 3;               // P0 critical … P3 enrichment
export type GuidanceSurface = 'inline' | 'bubble' | 'spotlight' | 'learning_card' | 'milestone_line' | 'whisper';
export type GuidanceScreen = 'home' | 'practice' | 'details' | 'vision' | 'chart' | 'progress' | 'weekly' | 'creation';

export interface GuidanceDefinition {
  id: string;                       // stable, never reused: 'domain.concept'
  version: number;                  // bump when meaning changes; old completion becomes obsolete
  category: GuidanceCategory;
  priority: GuidancePriority;
  screen: GuidanceScreen;
  surface: GuidanceSurface;
  target?: string;                  // host-registered target key
  requires?: string[];              // guidance IDs that must be completed|dismissed|obsolete first
  trigger: GuidanceEvent | 'screen.ready';
  eligible: (ctx: GuidanceContext) => boolean;     // pure; existing *TeachingBeats logic moves here
  learnedWhen?: (ctx: GuidanceContext) => boolean; // discovery-by-use ⇒ obsolete
  budget: 'exempt' | 'counts';      // P0 and inline are exempt from the daily overlay budget
  maxDefers: number;                // then convert to inline or obsolete
  steps: Array<{ copyKey: string; target?: string }>; // ≤2 for spotlight, 1 otherwise
  persistence: 'on_display' | 'on_complete';
  fallback: 'skip' | 'inline' | 'retry_next_visit';
}
```

### Registry entries

All copy is proposed and verified against the code listed. **Bold** = primary action. Every surface's dismiss uses accessibility label "Dismiss tip".

**R1 · `today.recommended`** · Orientation · P1 · Home (or Practice hub if Home never showed it)
- Target: Home Today card (`todayTeachingRef`) / hub Today (`practice.today` target).
- Requires: none. Eligible: has a selected anchor, today state is not loading, `thread.first_practice` not pending. Learned when: the user has completed any practice. This makes it obsolete for anyone who has already practiced, including migrated users.
- Trigger: `home.first_ready` (Home idle gate already defined in `V2HomeScreen.tsx:487-490`), i.e. after the first-anchor arrival.
- Timing: 600 ms after idle. Surface: **Context Bubble** (no scrim; the target stays tappable and tapping it completes the teaching).
- Copy — Title: "Start here each day." Body: "Anchor suggests one short practice for today. A minute is enough." Primary: **Got it**. A11y: "Tip. Start here each day. Anchor suggests one short practice for today."
- Persistence: `on_display`. Replay: yes. Analytics: shown, completed (target tap or Got it), dismissed. Fallback: target unmeasurable → skip this visit and retry next visit (max 3) → obsolete.
- Returning-user alternate: none (obsolete once practiced).

**R2 · `thread.first_practice`** · Reinforcement + Orientation · **P0** · Anchor Details · Learning Card (inline, existing `ThreadStrengthEducationCard`)
- Trigger: `practice.first_completed` (the existing `begin()` in `usePracticeCompletionScene.ts:633-639`). Shows on the next Details visit **or** is satisfied by R3, whichever comes first.
- Eligible: strength is a finite number.
- Copy (existing, kept): Title "Your Anchor is taking hold." Body "Every time you return to practice, your Thread Strength grows. As it strengthens, your Anchor's glow becomes more vibrant." Support "Thread Strength is now {n}, {level}." Secondary: **How Thread Strength works** (opens explainer). Primary: **Got it**.
- Persistence: `on_complete` (Got it or Learn more). While pending it holds all Details overlays.

**R3 · `thread.glow_grew`** · Reinforcement · **P0** · Home · Milestone Line (a one-line caption under the Anchor during the glow ease)
- Trigger: `thread.glow_changed` with `delta > 0`, the first time after `practice.first_completed`. Source: Home's glow ease from `homeGlowSeenStore`. [A] The exact hook point lives in the Home hero glow component. Add an emitted event; don't change the animation.
- Copy: "That practice strengthened your thread — see the glow?" Secondary (text link): **What's Thread Strength?** → explainer sheet. Auto-hides 6 s after the ease ends. Never a modal.
- Reduced motion: the glow snaps (existing behaviour). Show the caption with the before→after value instead: "Thread Strength {from} → {to}."
- Persistence: `on_display`. Completing R3 marks R2 as completed too (same concept, different surface). This fixes "user never opens Details".

**R4 · `practice.switch_anchor`** · Discovery · P2 · Practice hub · Context Bubble
- Eligible: ≥2 active anchors and the switcher rendered (existing `practiceTeachingBeats`). Learned when: the user has opened the switcher once.
- Copy: "Practicing another Anchor?" / "Switch between them here." **Got it**.

**R5 · `vision.first_photo`** · Contextual · P1 · Vision board · Whisper (existing `vision.first`, unchanged)
- Copy (kept): "Images make the future feel real. Add another and choose which one leads." Learned when: ≥2 photos (existing).

**R6 · `vision.lead_image`** · Contextual · P1 · Vision board · Spotlight (1 step, light scrim) (existing `vision.second`)
- Copy (kept): "Choose the image that leads." / "Drag photos into any spot. The one in the top spot leads, and it's the image Home shows." Learned when: the user has reordered once.

**R7 · `vision.reference_photo`** · Contextual · P1 · Vision creation · Inline (no overlay) [A]
- Placement: under the photo-source choice, before the first generation. Copy: "A clear photo of you helps the scenes look like you. It stays private to your Vision." [A] Verify storage and privacy wording with the Vision photo service before shipping. Don't claim "private" unless that's verified.

**R8 · `discover.vision`** · Discovery · P2 · Anchor Details · Inline (existing empty row)
- Upgrade the payoff line when the user has ≥1 completed practice and no Vision: Title "Add Vision". Payoff: "Picture where this leads. You'll use it in Visualize." Replaces the `details.vision` overlay.

**R9 · `discover.chart`** · Discovery · P2 · Anchor Details · Inline (existing empty row)
- Payoff when Vision exists or ≥3 practices: "Turn this into waypoints and one next move." Replaces `details.chart`.

**R10 · `chart.fog`** · Contextual · P1 · Chart · Inline caption under map reveal [A]
- Trigger: `openingFinished` on the first ever Chart view. Copy: "The route ahead clears as you reach each waypoint." Auto-fades after 5 s or on first gesture. [A] Confirm with `chartFogFieldData.ts` that reaching waypoints is what reveals the fog.

**R11 · `chart.next_move`** · Contextual · **P0** · Chart sheet · Spotlight, 2 steps (refactor of the existing 3-beat coach)
- Step 1 (row): "This is your next move." / "One small, real step you can take now. Tap the text to see the details." Step 2 (circle): "The circle is for done." / "Tap it once you've actually done the move. Your route moves when you do." Primary: **Next** / **Got it**.
- Requires: R10 completed, dismissed, or obsolete (never explain moves before the route is visible).
- Persistence: `on_complete`, or `on_display` of step 2. An interrupted step 1 retries next visit (max 2). This fixes the lost-forever risk.
- Holds milestone presentation while visible.

**R12 · `chart.first_waypoint`** · Reinforcement · P1 · Chart reach ceremony · Milestone Line
- Trigger: `waypoint.reached` #1 (existing reach flow → `queueMilestoneAction` in `V2ChartScreen.tsx:253`). Appended as one line inside the existing ceremony, never a new overlay. Copy: "First waypoint reached. Your next move is ready."

**R13 · `progress.levels`** · Orientation (depth) · P2 · Progress hero · Context Bubble
- Requires: R2 or R3 completed. Copy: "Five stages, one thread." / "Surface, Grounded, Rooted, Embedded, Sovereign. Regular practice moves you up; long breaks soften it." Secondary: **How it works** → explainer.

**R14 · `progress.week`** · Contextual · P3 · Progress week dots · Inline caption under the dots (first 3 visits)
- Copy: "Filled dots are days you practiced. One missed day a week won't break your rhythm." [A] Rename one of the two "grace" concepts in product language first.

**R15 · `weekly.first`** · Orientation · P2 · Weekly Insight · Inline intro block inside the first recap
- Copy: "Each week, Anchor reads your practice across every Anchor and suggests where to put your attention next." Dismissable inline ×. Never overlays the recap.

**R16 · `create.intention_principles`** · Contextual · P1 · Intention input · Inline chips
- Chips "Short", "Present", "Felt" light up from `assessIntention()` ("met" only; never a failing state). Tap → existing rules sheet. No timers, no whispers.

**R17 · `migration.home_progress_moved`** · Orientation · P2 · Home · Context Bubble · **only** when `migrationSource === 'legacy_v1_5'` and the user had the old Home layout [A] (decide whether this is needed at all).

**Removed:** `home.progress`, `home.vision`, `home.chart`, `home.thread` (except R17), `details.vision`, `details.chart` (as overlays), `progress.rhythm`, `progress.route`, all legacy registry entries on 2.0 paths.

### Dependency graph (soft; exploration never blocked)

```
practice.first_completed ─► R2 thread.first_practice ═╗ (same concept; either completes both)
                           R3 thread.glow_grew ═══════╝
                                     │
                                     ▼
                           R13 progress.levels ──► (explainer sheet, P3, on demand)

R10 chart.fog ──► R11 chart.next_move ──► R12 chart.first_waypoint
R5 vision.first_photo ──► R6 vision.lead_image
R1 today.recommended   (no deps; obsolete after any practice)
R8/R9 discovery inline (no deps; content upgrades with usage)
```

A `requires` edge only **orders** teachings. If a user opens Progress before any practice, R13 isn't eligible (no measured Thread), and nothing else is forced on them.

---

## 5. Deliverable D — Trigger Architecture

### 5.1 Decision: evolve, with one new central layer [P]

Keep `teachingSeen` storage, `useTeachingFocus`, `scrollToTarget`, `measureTeachingTarget`, the per-screen idle gates, and the pure eligibility functions. Add **one** app-level coordinator (`stores/v2/guidanceCoordinator.ts`, Zustand, not persisted). It owns:

1. **The surface lock.** At most one overlay guidance surface app-wide (bubble, spotlight, whisper). Inline surfaces don't take the lock.
2. **Presentation locks from other systems.** Milestone presenter, thread-event modal, paywall, keyboard, native alert, active practice session, creation flow, Chart ceremony/reach, Weekly Insight route, purchase/restore.
3. **The budget.** Per visit, per foreground session, and a rolling 24 h window.
4. **The queue.** Event-driven eligibility, priority arbitration, deferral counts.
5. **State transitions and persistence.**

`useTeachingQueue` becomes a thin adapter (`useGuidanceHost`) so screen code barely changes. `ChartOneMoveTeaching` keeps its sheet-visibility logic, but asks the coordinator before showing.

### 5.2 Lifecycle

```
 (domain seam emits)            (pure)                 (coordinator)                (host)                 (component)          (storage)
 Event ──► Eligibility(ctx) ──► Priority & deps ──► Queue (memory) ──► Screen readiness ──► Presentation ──► Response ──► Persist
   │            │                    │                    │                 │                     │              │
   │            └ learnedWhen ⇒ OBSOLETE (persist)        │                 │ blocked ⇒ DEFERRED   │ unmeasurable ⇒ fallback
   │                                                      │                 │ (count++)            │ dismissed ⇒ DISMISSED
   └ screen.ready is also an event                        │ lock held by    │                      │ action/Got it ⇒ COMPLETED
                                                          │ milestone etc ⇒ wait                   │ interrupted ⇒ back to QUEUED
```

States: `eligible` (derived, never stored) → `queued` (memory) → `displayed` (persist `displayedAt`, `displayCount`) → `completed` | `dismissed` (persist) · `deferred` (persist `deferCount` only) · `obsolete` (persist, with reason `learned_by_use | version_retired | entitlement`).
"Seen" for suppression = `completed | dismissed | obsolete`, or `displayed` when `persistence === 'on_display'`.

### 5.3 Events — map to existing seams (no duplicate event systems) [P]

| Guidance event | Existing seam to emit from [V] |
|---|---|
| `anchor.created` | `navigation/v2/creationHandoff.ts` `prepareHomeArrival` |
| `home.first_ready` | Home `homeIsIdle` turning true with no previous `today.recommended` record |
| `practice.first_completed` | `usePracticeCompletionScene.ts` `begin()` when `kind === 'first'` |
| `thread.glow_changed {from,to}` | Home glow ease that reads/writes `homeGlowSeenStore` [A: exact component] |
| `vision.photo_count {n}` | `V2SavedVision` `boardTiles.length` |
| `chart.revealed` | `ChartActiveView` `openingFinished` |
| `waypoint.reached {index}` | `V2ChartScreen.tsx:253` reach path |
| `weekly.first_rendered` | `V2WeeklyRecapScreen` first FINAL/provisional render |
| `screen.ready {screen}` | `useGuidanceHost` when focused, settled and not blocked |

Use one in-process emitter (the coordinator's `emit`), not `DeviceEventEmitter` string events (today's `replayAppTeaching` / `chartReplayOneMoveTeaching` become coordinator actions).

### 5.4 Pseudocode

```ts
// guidanceCoordinator.ts (sketch)
emit(event) {
  for (const def of REGISTRY.filter(d => d.trigger === event.name || d.trigger === 'screen.ready')) {
    const rec = state.records[def.id];
    if (isSettled(rec, def)) continue;                       // completed/dismissed/obsolete/displayed(on_display)
    const ctx = buildContext();                               // existing stores only; see §5.6
    if (def.learnedWhen?.(ctx)) { persist(def.id, 'obsolete', 'learned_by_use'); continue; }
    if (!def.eligible(ctx)) continue;
    if (!depsSatisfied(def, state.records)) continue;
    enqueue(def);                                             // dedupe by id
  }
  pump();
}

pump() {
  if (state.lock || anyExternalLock()) return;                // milestone, thread modal, paywall, keyboard, session…
  const host = state.activeHost;                              // the focused, settled screen
  if (!host?.ready) return;
  const next = state.queue
    .filter(d => d.screen === host.screen && host.targets.has(d.target ?? ''))
    .filter(d => d.surface === 'inline' || withinBudget(d))
    .sort(byPriorityThenQueuedAt)[0];
  if (!next) return;
  if (next.surface !== 'inline') {
    state.lock = { id: next.id, token: uuid() };
    holdMilestones(true);                                     // useMilestonePresentationHold equivalent
  }
  host.present(next, state.lock?.token);
}

onResponse(id, token, outcome) {                              // 'completed' | 'dismissed' | 'interrupted' | 'unmeasurable'
  if (state.lock?.token !== token) return;                    // stale callback from an unmounted host
  switch (outcome) {
    case 'interrupted':  requeue(id); break;                  // NOT persisted; displayCount stays
    case 'unmeasurable': defer(id); break;                    // deferCount++; > maxDefers ⇒ fallback
    default:             persist(id, outcome);
  }
  release(); spendBudget(id, outcome); pump();
}
```

### 5.5 Rules & recommended values [P]

| Rule | Value | Reasoning |
|---|---|---|
| Overlay surfaces at once | **1 app-wide** | Fixes D1/D2. |
| Unsolicited overlays per screen visit | **1** (a 2-step spotlight counts as 1) | A visit is for using the screen. |
| New overlay teachings per foreground session | **1**, plus P0 | A session = cold start, or foreground after ≥30 min in background. Replaces per-process (D6). |
| Rolling 24 h overlay budget | **2** (P0 exempt; inline exempt) | Keeps a new user's first day to Today and Thread at most. |
| Settle delay before any overlay | `V2_TRANSITION_SETTLE_MS` + **600 ms** idle | Existing settle plus a beat, so the screen reads first. |
| After a celebration / thread event / weekly insight | **No overlay for the rest of that screen visit** | Reinforcement moments shouldn't be followed by instruction. |
| Back-and-forth navigation | A teaching interrupted by blur is requeued **once per session**. A second blur in the same session defers it to the next session. | Stops "ping-pong" re-display. |
| Spotlight steps | **≤2** | Current 3-beat Chart is cut to 2. |
| `maxDefers` | 3 (P0: 5) | Then convert to inline (if defined) or obsolete. |
| Dismissal semantics | Dismiss = this teaching only. Unshown steps are **not** committed. Scrim tap = "not now" (requeue next session, once); ×/Got it = done. | Fixes D4 while still respecting a clear "no". |
| Target tap inside spotlight | **Pass through and complete** the teaching | Fixes D5. Teaching should never block the action it teaches. |
| "Show tips" off | Suppress P1–P3 overlays; keep inline + P0 Chart circle as **inline** fallback (subtitle under the circle once) | Never punish dismissal. P0 stays reachable without an overlay. |
| Entitlement | `eligible()` must call the same entitlement selectors the feature uses; premium-only features are never "discovered" to users who can't open them | Rule 4; teaching never becomes a paywall. |

### 5.6 Context signals — availability [V]/[A]

| Signal | Source | Available |
|---|---|---|
| Account / guest | `useAuthStore.user?.id` | [V] |
| Active anchor, count | `useAnchorStore` | [V] |
| Completed sessions | `useSessionStore.sessionLog` / `practiceHistory` | [V] |
| First practice | `isFirstPracticeEver`, `hasSeenFirstPracticeScene` | [V] |
| Thread value / glow delta | Home model, `homeGlowSeenStore` | [V] / [A] event hook |
| Vision photos | `V2SavedVision` tiles | [V] (screen-local; emit) |
| Chart exists / revealed / reached | `useCourseStore`, `ChartActiveView` | [V] |
| Entitlement / trial | `useSubscriptionStore`, `useTrialStatus` | [V] |
| Milestone presenting | `useMilestonePresenter` | [V] |
| Keyboard / native alert / modal | per-screen today | [A] Add a global `useKeyboardVisible` and `V2DialogManager` open state |
| Cross-device history | none | **Gap** (see 5.8) |

### 5.7 Concurrency, recovery, versioning

- **Tokens:** every presentation carries a lock token. Stale responses from unmounted hosts are ignored.
- **Background:** on `AppState` → background, the active overlay is torn down with outcome `interrupted` (no persist). On foreground, the pump re-runs after settle. Interrupted P0 re-presents; others wait for the next visit.
- **Remount:** hosts re-register; queue and records survive (memory + storage).
- **Target missing:** `unmeasurable` → defer; never present a bubble pointing at nothing.
- **Account switch:** coordinator `bindAccount(id)` clears queue and lock, then loads records for the new key. Guest → account migration reuses the `teachingSeen` approach (promote guest records, then delete guest keys).
- **Versioning:** records store `{id, version}`. A registry bump makes old completion `obsolete: version_retired` (or re-eligible, if the meaning changed enough to re-teach — decided per entry).
- **Migration from today's flags (one-time, on first coordinator boot):**
  - `anchor:v2:teach:home.today` → `today.recommended: completed`
  - `practice.today` → `today.recommended: completed`
  - `home.progress | home.thread | progress.thread` → mark `thread.*` as *not* completed (the new glow lesson is worth seeing once). [A] product call: alternatively mark R3 obsolete for these users.
  - `vision.first / vision.second` → R5 / R6 completed
  - `chart2:taught` → R10 + R11 completed
  - legacy `hasSeenThreadStrengthEducation` → R2 + R3 completed
  - users with ≥1 session and no records → R1 obsolete (`learned_by_use`)
  - Clear legacy `pendingMilestones` (D7) under V2.
  - Stop "Replay tips" from resetting legacy `userFlags` (D8). Replay resets only guidance records.

### 5.8 Local vs server

- **Local (encrypted, per account):** all guidance records. Already implemented.
- **Server (optional, Phase 5):** sync a compact `{id: state}` map so reinstalls and second devices don't re-teach. [P] Use an existing user-preferences or settings sync payload if the backend has one. [A] I didn't verify one exists in `backend/`. Only if none exists, add a single nullable JSONB column `users.guidance_state` — **not a new table**. Merge rule: settled state wins over unsettled; newest `updatedAt` wins between settled states.
- Offline: everything works locally; sync is best-effort.

---

## 6. Deliverable E — UX Specifications

Tokens: use `theme/v2` (`colors.surface #FBF9F4`, `colors.text.primary #171717`, `colors.text.secondary #6C6861`, `ink.base #121A22`, `ink.raised #18212A`, `ink.text.*`, `radii`, `spacing`, `shadows`). Display: EB Garamond Medium. Body: Figtree. Replace hard-coded hex in the current components (D11).

| Component | Layout | Max copy | Actions | Motion | Positioning | Dismissal | Accessibility |
|---|---|---|---|---|---|---|---|
| **Context Bubble** | 16 pt padding, radius 16, max-width 320, 10 pt caret toward the target; light or ink variant to match the surface underneath | Title ≤32 chars, body ≤110 | One text button ("Got it"), optional link | Fade + 6 pt rise, 180 ms; reduced motion: fade only | Window-space measure of the target (existing `measureTeachingTarget`); prefer below, flip above; 12 pt from the target; respects safe areas and keyboard | ×/Got it, target tap (completes), Android back | `accessibilityLiveRegion="polite"` / announce; focus moves to the bubble; 44 pt targets |
| **Feature Spotlight** | Existing `SpotlightCoach` geometry, but scrim `ink.deep` at **0.40** (not 0.64); hole stroke 1.5 pt `surface` | Same as bubble; ≤2 steps with "1 of 2" | Next / Got it | Existing 260 ms hole travel; reduced motion: no travel | Existing; plus pass-through hole | Scrim tap = not now; Got it = done | `accessibilityViewIsModal`; announce step |
| **Learning Card** | Inline card in the scroll flow, `grouped` fill, radius `lg`, **no left-border accent**; optional 56 pt visual slot (glow mini) | Title ≤34, body ≤150, one support line | Primary "Got it", secondary link | Height expand 220 ms; reduced motion: none | In flow — never overlays | Got it / link | `accessibilityRole="summary"`; header role on title |
| **Milestone Line** | One centred caption line attached to an existing celebration/glow/ceremony; optional link | ≤70 chars | Optional link | Fades in after the celebration's own beat; auto-hides 6 s | Owned by the host animation | Auto / link | Announced once; never steals focus |
| **Inline Guidance** | Rewrites existing UI text (empty rows, captions, chips) | ≤80 chars | Existing control | None | In flow | None / inline × | Part of the control's label |
| **Whisper** | Existing `TeachingWhisper` bottom pill | ≤90 | × | Fade 180 ms | Bottom, above safe area | × or 8 s | Announce |

**Target measurement contract [P]:** a host registers `targets: Record<string, () => Promise<Rect | null>>`. Providers must (1) return window-space rects, (2) scroll into view through the existing `scrollToTarget`, (3) return `null` if clipped by a sheet viewport (the Chart provider keeps its existing clip logic). The coordinator re-measures on `useWindowDimensions` change, keyboard change and sheet detent change, and hides the surface (not completes it) while measuring.

Mockups of the highest-impact moments are on the companion Design canvas ("Anchor Guidance — key moments").

---

## 7. Microcopy — before → after

| ID | Before | After |
|---|---|---|
| Today | "A little focus goes a long way." / "Each day Anchor picks a short practice to bring you back to your goal. Begin it here." | "Start here each day." / "Anchor suggests one short practice for today. A minute is enough." |
| Thread (Home) | "Your progress starts here." / "Every practice builds your Thread Strength, and it fades slowly if you stop…" | Milestone line after the glow eases: "That practice strengthened your thread — see the glow?" · link "What's Thread Strength?" |
| Thread (Details) | (kept) "Your Anchor is taking hold." … | (kept) |
| Progress levels | "This is your Thread Strength." / "…The five stages show how established your thread has become." | "Five stages, one thread." / "Surface, Grounded, Rooted, Embedded, Sovereign. Regular practice moves you up; long breaks soften it." |
| Details Vision row | "Add Vision · See where this leads." | "Add Vision · Picture where this leads. You'll use it in Visualize." (after first practice) |
| Details Chart row | "Create Chart · Map the path from here." | "Create Chart · Turn this into waypoints and one next move." |
| Chart move (2 steps) | 3 beats | "This is your next move." / "One small, real step you can take now. Tap the text to see the details." → "The circle is for done." / "Tap it once you've actually done the move. Your route moves when you do." |
| Chart fog | — | "The route ahead clears as you reach each waypoint." [A] |
| First waypoint | — | "First waypoint reached. Your next move is ready." |
| Weekly | — | "Each week, Anchor reads your practice across every Anchor and suggests where to put your attention next." |
| Switch | "Switch anchors here." / "Tap to practice a different anchor." | "Practicing another Anchor?" / "Switch between them here." |
| Settings | "Guide mode · Show guidance while you create and practice" + "Replay app tips" | "Show tips · Short pointers the first time you use something" + "Replay tips" |

Copy rules: no "Did you know", no promises of scores or timelines, no "sigil/ritual/charge", name the mode "Deep Focus" only after D10 is resolved, and never start with "Don't" or failure framing (low Thread copy says "soften", never "lose").


---

## 8. Analytics & measurement

Infrastructure [V]: `AnalyticsService` (PostHog, `services/AnalyticsService.ts:49-58`). Events today: V2 `teaching_beat_*`, legacy `teaching_shown` and `teaching_suppressed` (10 % sampled), `teaching_reset`.

[P] Replace these with one family, `guidance_*`, sharing properties `{id, version, category, priority, surface, screen, step, total, session_index, days_since_install, reason}`:

- `guidance_displayed` · `guidance_completed {via: got_it|target_tap|learned_by_use}` · `guidance_dismissed {via: x|scrim|back}` · `guidance_interrupted {reason}` · `guidance_failed {reason: unmeasurable|timeout}`
- `guidance_suppressed` — **only** for budget/lock suppressions, sampled at 10 %; never per render.
- No "eligible" event (too noisy). Eligibility is derivable.

**Outcome metrics (the real signal):** downstream events that already exist or are cheap to add.

| Goal | Teaching | Metric |
|---|---|---|
| First practice | R1 | % of new users completing a practice within 24 h of `anchor.created` |
| Thread understanding | R2/R3 | D7 return rate; 2nd practice within 72 h; explainer-sheet opens (curiosity, not success) |
| Vision activation | R8, R5/R6 | Vision created within 7 d; 2nd photo; reorder |
| Chart | R9–R12 | Chart created; first move marked done **with a later waypoint reach** (proxy for "marked honestly"); move-done → undo rate |
| Weekly | R15 | Recap feedback submitted; next-week return |

**Experiment design:** add a `guidance_variant` property from a PostHog feature flag at the *registry entry* level (e.g. R3 on/off, or R1 bubble vs inline). Use holdout ≥10 % for P1–P3 only, never for P0. Compare downstream metrics over 14 days. Don't optimise on tap-through.

---

## 9. Deliverable F — Journey Simulations

Notation: ✅ shown · ⏸ deferred · ⛔ suppressed · ⊘ obsolete.

1. **New guest creates first Anchor.** Onboarding → intention input: R16 chips light as they type (inline, no overlay) → creation flow (none) → Home arrival (none; `arrival.context.active`) → Home idle +600 ms → ✅ R1 bubble on Today. They tap Today → R1 completed via target tap → Practice. Budget: 1/2 for 24 h. ⛔ Nothing else this session.
2. **First Practice completed.** Session (immersive; all locks) → first-practice scene (lock) → `practice.first_completed` queues R2/R3 → Home: glow eases → ✅ R3 milestone line (P0, budget-exempt). R2 marked completed with it. Details later: no Thread card (already completed); empty rows show R8 copy. ⛔ Milestone celebration, if queued, plays first. R3 waits for it to finish, then for the next Home visit with a glow ease. If no ease remains, R2 becomes the fallback on Details.
3. **Discovers Vision first time.** From Details "Add Vision" (R8 inline) → creation shows existing prompts and word hint + R7 inline → board with 1 photo → ✅ R5 whisper → adds second photo on their own → R5 obsolete → ✅ R6 spotlight (1 step). If R6 is dismissed via scrim → requeued once next session.
4. **Creates first Chart.** Details R9 inline → Ask chat (none) → route review (none) → map reveal finishes → ✅ R10 inline caption → sheet at peek, idle → ✅ R11 two steps (counts as this visit's overlay; P0). On their first reach → ✅ R12 line inside the ceremony. ⛔ Milestone presentation is held while R11 is visible.
5. **Returning user, low Thread (e.g. 14, Surface).** All earlier teachings settled. No guilt teaching exists by design. If R13 is unseen and they open Progress → ✅ R13 bubble ("long breaks soften it"), phrased neutrally. ⛔ Nothing on Home.
6. **Consistent user reaches a stage.** Existing `V2ThreadEventModal` plays (lock). No guidance during or after it on that visit. R13, if still unseen, waits for the next Progress visit.
7. **Dismissed several teachings.** Each dismissal settled only its own ID (D4 fix). Budget unaffected. They keep full function: inline guidance (R8/R9/R16) still shows because it's part of the UI. If they switch "Show tips" off, only inline + P0 Chart inline remain.
8. **Rapid navigation (Home → Practice → Vision → Chart in 5 s).** No host ever reaches "settled + 600 ms idle". Nothing presents. Any candidate is still `queued` in memory, never persisted. On the next settled screen, at most one overlay shows.
9. **Existing user updates.** Migration (§5.7) maps flags. Anyone with practices gets R1 obsolete. Anyone who saw the old Home thread beats gets R3 once on the next glow ease [A product call]. Legacy `pendingMilestones` cleared. No sequence of catch-up tips.
10. **Premium user who explored most things.** `learnedWhen` makes R1, R4, R5, R6, R8, R9 obsolete on first evaluation. They may see R3 once (if never shown) and R10/R11 only if they never opened a Chart. Practically zero overlays.

---

## 10. Deliverable G — Testing Strategy

**Unit (Jest; extend existing `hooks/v2/teaching/__tests__`):**
- Registry: unique IDs; every `copyKey` exists; spotlight ≤2 steps; copy length limits; no banned words (`sigil|ritual|charg|Did you know`).
- Coordinator: single lock under concurrent `emit`; stale-token responses ignored; priority order P0 > P1 …, ties by queue time; budget windows (24 h rolling, per session after a 30-min background, per visit); `learnedWhen` → obsolete; dependency ordering; dismissal commits only the shown ID; interrupted → requeued, not persisted; `maxDefers` → fallback.
- Persistence: guest → account promotion; account switch isolation; version bump → obsolete; migration table (every legacy key → expected state); Replay resets guidance only (not `hasSeenFirstAnchorArrival`).
- Entitlement: premium-gated entries never eligible without entitlement.

**Integration (RNTL with real stores):**
- Home: arrival active ⇒ no R1; after arrival + idle ⇒ R1; target tap completes R1 and navigates.
- Details: R2 pending + empty Vision ⇒ only R2 inline, no overlay (D2 regression).
- Milestone presenter queued while R11 visible ⇒ milestone waits; after R11 completes ⇒ milestone plays (D1 regression).
- Chart: R11 interrupted on step 1 by sheet hide ⇒ re-presents next visit (max 2).
- Background during an overlay ⇒ torn down, not persisted; foreground ⇒ re-pumps after settle.
- Keyboard visible ⇒ no overlay; `V2DialogManager` open ⇒ no overlay.
- Reduced motion ⇒ no hole travel, R3 shows the numeric before→after.

**Device (Android + iOS):**
- Measurement on notch/Dynamic Island and Android gesture-nav insets; split-screen/fold resize mid-bubble (re-measure); font scale 200 % (bubble grows, flips above/below, still inside safe area).
- VoiceOver/TalkBack: announce order, focus trap only for spotlight, Android back dismisses as "not now".
- Low-end Android: no dropped frames during the glow ease while R3 renders (caption is static text over the existing animation).
- Cold start vs warm foreground session semantics; OS process kill during an overlay.

---

## 11. Deliverable H — Implementation Roadmap

Recommended order (safer than the brief's order, because the lock fixes the two High defects before any new UI):

**Phase 1 — Stop the bleeding (1–2 days, low risk)**
- Remove beats `home.thread`, `home.progress`, `home.vision`, `home.chart`, `progress.rhythm`, `progress.route` from eligibility (copy stays until Phase 4).
- Details: add `education.visible` to the Details `blocked` (D2).
- `ScreenTeaching` dismiss: commit only shown beats (D4). Spotlight hole: pass the tap through and complete (D5).
- Stop `queueMilestone` under V2 and clear `pendingMilestones` (D7). Replay no longer resets legacy `userFlags` (D8).
- Fix the stale `App.tsx` comment and the isolation doc (D13). Tests for each.

**Phase 2 — Coordinator (3–5 days, medium risk)**
- `guidanceCoordinator` store: lock, external locks (milestone presenter, thread modal, paywall, keyboard, dialog), budget, foreground-session semantics.
- `useGuidanceHost` adapter behind `useTeachingQueue`'s existing signature. Chart coach requests the lock. Lock holds milestone presentation.
- Records + migration (§5.7). Feature-flag the coordinator (`EXPO_PUBLIC_GUIDANCE_V2`) with today's queue as the fallback path.

**Phase 3 — Components (3–4 days)**
- Context Bubble (new), Spotlight (lighter scrim, tokens, 44 pt), Learning Card (restyle of the existing card), Milestone Line, Whisper (tokens).
- Fold `ChartOneMoveTeaching` rendering onto the shared Spotlight; keep its sheet target provider.

**Phase 4 — Coverage (4–6 days)**
- R1, R3 (glow event hook), R8/R9 inline copy, R10–R12, R13, R14, R15, R16 (IntentionInputScreen inline chips; delete legacy whisper code on that screen), Settings "Show tips".
- Resolve D10 (Deep Focus vs Deep Prime) and the "grace" naming first.

**Phase 5 — Measure & sync (ongoing)**
- `guidance_*` events and dashboards for outcome metrics; PostHog flags per entry.
- Optional server sync of records (existing prefs payload, or one JSONB column).
- At 1.5 cutover: delete legacy registry, store, gate, components and screens.

**Reuse:** `teachingSeen` (storage/migration pattern), `useTeachingFocus`, `scrollToTarget`, `measureTeachingTarget`, `SpotlightCoach` geometry, Chart sheet visibility logic, `ThreadStrengthEducationCard`, `ThreadStrengthExplainerSheet`, `visionGuidance`, `intentionGuidance`, `useMilestonePresentationHold`.
**Risks:** Home idle gate complexity (many motion sources); the glow ease hook point [A]; sheet measurement on Android; migration correctness for users with partial flags; locale/vocabulary decisions blocking copy.

---

## 12. Final design questions — answers

1. **What's wrong?** Four uncoordinated systems; 1.5 vocabulary in the registry; overlays that duplicate self-explaining UI; Thread Strength taught six ways and never through the glow; "not now" treated as "never"; and nothing stops a teaching from colliding with a celebration.
2. **How much to preserve?** Most of the V2 plumbing: storage, focus/idle gates, measurement, discovery suppression, Thread card and explainer, inline Vision/intention guidance, Chart sheet logic. Replace the per-screen decision layer and retire the legacy registry.
3. **Centralised event-driven coordinator?** Yes, but thin. Events come from seams that already exist, eligibility stays pure, and screens stay hosts. The thing it must own is the lock.
4. **How does a teaching fire?** Event → eligible + deps + not learned → queued → host settled + 600 ms idle + no external lock + within budget → present → respond → persist.
5. **Avoid teaching the already-discovered?** `learnedWhen` for every discovery/contextual entry, evaluated before display, plus migration that marks R1 and friends obsolete for anyone with usage history.
6. **Frequency rules?** 1 overlay app-wide; 1 per visit; 1 new per foreground session plus P0; 2 per rolling 24 h; none after a celebration on that visit; ≤2 spotlight steps; 3 deferrals max.
7. **Must-understand concepts?** (1) Practice today — a minute counts. (2) Practice grows Thread Strength, and the glow shows it. (3) A Chart move is done only when you've done it. Everything else can be discovered.
8. **Under-explained today?** The glow ↔ Thread link, Chart fog/route reveal, what reaching a waypoint does, Weekly Insight's purpose, the lead image on Vision (explained, but only by overlay).
9. **Inline instead of overlays?** Details Vision/Chart, intention principles, Vision reference photos, Chart fog, Progress week, Weekly Insight intro, first waypoint (inside the ceremony), and Thread on Details.
10. **Thread & glow intuitive?** Teach it at the moment it changes: the first glow increase after the first practice gets one line, "That practice strengthened your thread — see the glow?" The numbers and levels live one tap away, in the explainer and on Progress.
11. **Scaling?** New features add registry entries, not components or queues. Each entry declares surface, priority, deps, `learnedWhen` and its event. The lock and budget protect existing users from new-feature tip storms. Version bumps handle changed meaning.
12. **Build first?** Phase 1 (one or two days): remove the bad beats, fix Details' double teaching, change the dismissal and pass-through semantics, stop the dead milestone queue. Then the lock (Phase 2). Together they fix every High and Medium defect without new UI.

---

### Unresolved assumptions / decisions for the product owner

- **[A1]** Deep Focus or Deep Prime as the user-facing name.
- **[A2]** Rename one of the two "grace" concepts.
- **[A3]** Do migrated users see the new glow lesson (R3) once?
- **[A4]** Exact hook point for the glow-change event in the Home hero.
- **[A5]** Fog semantics on the Chart map (does reaching waypoints reveal it?).
- **[A6]** Vision reference-photo UI and privacy wording.
- **[A7]** Does the backend already sync a user-preferences payload that could carry guidance state?
- **[A8]** Does Replay's reset of `hasSeenFirstAnchorArrival` actually replay the first-arrival scene?
- **[A9]** Do trace hints have any 2.0 consumer?
- **[A10]** Is `MigrationSource` (1.5 → 2.0) detectable for R17, or should R17 be dropped?
