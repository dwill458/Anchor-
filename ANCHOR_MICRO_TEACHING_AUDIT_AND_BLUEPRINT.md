# Anchor 2.0 — Micro-Teaching System Audit & Experience Blueprint (v2, reconciled)

**Repository:** `E:\Projects\Anchor\` · **v1:** 2026-10-26 · **v2 (this file):** 2026-10-26, after product review
**Scope:** `anchor/mobile/src`, plus `backend/src` where teaching copy depends on server behaviour. Read-only; no production code changed.
**Companion documents:**

- `ANCHOR_GUIDANCE_PHASE1_CLEANUP_PLAN.md` — the precise, low-risk cleanup.
- `ANCHOR_GUIDANCE_COORDINATOR_ARCHITECTURE.md` — the coordinator.
- Design canvas "Anchor Guidance — key moments" — updated mockups.

Legend:

- **[V]** Verified in code (path:line).
- **[D]** Decision: owner-approved, or recommended here and awaiting confirmation.
- **[A]** Must be verified during implementation.

---

## 0. What changed since v1

1. **Your product decisions are applied** (§1). Deep Focus, Strength Buffer, existing-user glow lesson, removal of the fog and reference-photo claims, the user-initiated explainer, accurate Chart copy, celebration priority, the four-outcome model and target pass-through.
2. **Code inspection overturned three v1 assumptions.** Each changes a decision, so read these first:
   - **"Rest Days" is already a shipped, server-synced feature with a different meaning.** `settingsStore.restDays` (weekdays 0–6) syncs to `user_settings.rest_days` (`backend/prisma/schema.prisma:995`). It is honoured by Thread decay (`backend/src/services/v2/ThreadStrengthService.ts:122-135, 415-423`) and by notifications. The explainer already tells users "Your rest days never count as time away" (`ThreadStrengthExplainerSheet.tsx:117`). Applying the same name to the weekly rhythm bridge would create two features called Rest Days. → see **P-1**.
   - **The Progress "grace day" doesn't do what its label implies.** `consumeGraceDay()` (`sessionStore.ts:729`) has **no callers**, so `lastGraceDayUsedAt` is always null. The badge always reads "Grace day ready" (`V2ProgressWeek.tsx:66`) and the "one per week" limit never applies. The bridge also lasts only until the user practices that day: once today has a session, `calculateStreak` restarts the count at the gap (`utils/streakHelpers.ts:52-64`). Day boundaries are UTC, not local. → it can't be named or taught accurately until it is fixed or retired (**P-1**, **P-3**).
   - **The Home "eases since last seen" glow is not rendered anywhere.** `HeroHalo` (`components/v2/home/V2HomeHeroLight.tsx`) and its `homeGlowSeenStore` have no production consumer. The last change was commit `84bcdaf4b`, 2026-10-19, "remove hero status ring…". The live glow is `ThreadAura` on `CircularAnchorRenderer`: opacity is a pure function of Thread Strength, there is **no glow at 0 or unmeasured**, and it eases over 420 ms only when the value changes while mounted (`components/v2/anchor/ThreadAura.tsx:73-86`, `threadAuraModel.ts:20-24`). The one place a user *watches* the glow change with their Thread is the **practice completion scene**: the Thread bar fills from the real before→after values while the glow brightens in step (`usePracticeCompletionScene.ts:110-123`, `V2FocusCompleteScreen.tsx:85-101`). → The glow lesson moves there (G2).
3. **The registry is rebuilt** (§6): **8 recorded teachings** and **4 inline copy changes**. 17 v1 items are retired.

---

## 1. Decision log

| # | Decision | Status | How it was verified | Consequence |
|---|---|---|---|---|
| D-01 | User-facing name **Deep Focus** everywhere; keep internal ids and stored data | [D] approved | Practice hub and session defaults already say Deep Focus (`constants/v2/practice.ts:27`, `screens/settings/SessionDefaultsPanel.tsx:58`). Still "Deep Prime" in user-visible 2.0 text: `components/v2/progress/progressTokens.ts:54` (Progress evidence summary), `adapters/v2/progress/progressAdapter.ts:137` (Progress session titles), `types/practice.ts:12` `PRACTICE_MODE_LABELS`, the Android widget "DEEP PRIMES" (`widgets/android/AnchorLargeWidget.tsx:449`, behind `EXPO_PUBLIC_ENABLE_WIDGETS`). | Copy-only change; **no migration**. Leave unchanged: mode id `deep_prime`; the server recommendation action `'Deep Prime'` (`backend/src/domain/v2/recommendation.ts:10`, `constants/v2/practice.ts:41-45`); `todayForDisplay.ts:5-10` (maps to that server enum, not displayed); analytics values; legacy 1.5 screens. Add a guard test (Phase 1, item 1.8). |
| D-02 | Rename the two grace concepts | **Strength Buffer: approved and accurate. "Rest Days" for the rhythm bridge: on hold** | Strength Buffer = `SENSITIVITY_GRACE_DAYS` lenient 2 / balanced 1 / strict 0 days away before −3/day softening; rest weekdays never count as away (`ThreadStrengthService.ts:62-66, 206-214`; mobile mirror `utils/threadStrength.ts`). The rhythm bridge is non-functional and "Rest Days" is taken (§0). | Adopt "Strength Buffer" in Thread settings and the explainer. Strict reads "No buffer". Don't rename the rhythm bridge until **P-1** is answered. Phase 1 hides the misleading "Grace day ready/used" badge (**P-3**). |
| D-03 | Existing users get the glow lesson once, after their next practice-driven strength increase | [D] approved | "Next increase" = the next completion scene of kind `repeat`, which only plays when the saved, authoritative session produced `gain > 0` (`usePracticeCompletionScene.ts:326-334`). | Existing user = account with ≥1 completed session when guidance first boots (stamped once). Lesson variant B (§6, G2). Never on launch, never on Home. |
| D-04 | Remove unverified fog and reference-photo claims | [D] approved | — | v1 R7 and R10 are deleted. (For later: a consent gate `useProfilePhotoForVision`, default false, exists at `schema.prisma:988-990`. No copy until the policy is confirmed.) |
| D-05 | Today copy fits the real recommended duration | [D] approved | Today card = `mode` + `durationSeconds` (the user's saved length per mode; `undefined` for Release) (`useV2HomeModel.ts:91, 221`, `V2HomeTodaySection.tsx:179`). Labels via `v2PracticeModeTitle` and `v2PracticeDurationLabel` (`constants/v2/practice.ts:57-65`). | Templated copy. Not eligible when the recommendation is Release. |
| D-06 | Glow lesson: brief, rewarding, synced with the real glow change | [D] approved | See §0.2 (third finding). | One subline inside the completion scene, appearing as the glow settles. No numbers or levels. No Home overlay. |
| D-07 | Expanded Thread explanation only by user request ("What's Thread Strength?") | [D] approved | `ThreadStrengthExplainerSheet` is already reachable by tap from the Progress hero (`V2ProgressHero.tsx:169-172`) and Details (`V2AnchorDetailsScreen.tsx:1090, 1114`). | The completion scene gains the link. **The automatic Details education card retires** (**P-4**): it is a second lesson that appears unasked. |
| D-08 | No hard-coded gains, levels or guarantees | [D] approved | — | Copy rule plus a registry lint (§7). The only number in teaching copy is the Today duration, which comes from data. |
| D-09 | Shorter Chart lesson with accurate claims | [D] approved | Circle = one tap marks the move done after server success (`ChartOneMoveRow.tsx:73-87`, `ChartActiveView.tsx:824-849`). Words = expand "Done when" / "Waypoint reached when" (`ChartOneMoveRow.tsx:89-93, 125-150`). After a move is done today: "Today's move is done. Next move tomorrow." + "Do another move now" (`map/chartRhythm.ts:159-161`). A waypoint is reached only by the user confirming it ("Progress only moves on your word.", `chartRhythm.ts:166-170`). | One step instead of three. The v1 claims "the next one is ready" and "your route moves when you do" are dropped. |
| D-10 | Celebrations outrank unsolicited teaching; never interrupt one | [D] approved | `MilestoneCelebrationHost` presents over any screen (`MilestoneCelebrationHost.tsx:12-48`). Its queue is `milestoneCelebrationStore.queue`, and holds are `hold/release`. | Guidance never shows while a celebration is presenting or queued, and **yields** if one starts. Guidance **never holds** a celebration (reverses v1 §5.4). |
| D-11 | Waiting is fine; stale is not | [D] approved | v1 queue froze batches per focus (`useTeachingQueue.ts:38-63`). | No message is carried across contexts. A candidate is bound to a screen visit (or one scene instance) and dies with it. Later moments re-derive eligibility from live state. |
| D-12 | Separate displayed / dismissed / acknowledged / action performed | [D] approved | v1 conflated them (`useTeachingQueue.ts:65-84`). | Record model in the coordinator doc §3. Independent discovery = `obsolete`. |
| D-13 | Tapping a highlighted target runs its real action | [D] approved | Today the hole dismisses (`SpotlightCoach.tsx:116-117`). | Phase 1 makes the hole non-interactive so touches reach the real control. Phase 2 records `action_performed` only once the action confirms success. |
| D-14 | Independent discovery suppresses intros | [D] approved | Pattern exists for `vision.first` (`V2SavedVision.tsx:249-251`). | Every recorded teaching has a `learnedWhen` predicate (§6). |
| D-15 | Preserve reliable 2.0 infrastructure | [D] approved | — | Reused, unchanged: encrypted per-account records with guest promotion, `useTeachingFocus`, `scrollToTarget` and `measureTeachingTarget`, screen idle gates, Chart sheet visibility logic, `ThreadStrengthExplainerSheet`, the completion scene choreography, milestone store. |

---

## 2. Outstanding decisions

### 2a. Genuine product decisions (need your answer)

| # | Question | Recommended default | Rationale | Implementation consequence |
|---|---|---|---|---|
| **P-1** | What should the weekly rhythm concept be, given "Rest Days" already exists? | **One concept: the rhythm honours the user's existing Rest Days.** Retire the separate weekly bridge. Rest-day weekdays then count as neither practised nor missed in Progress, as they already do for Thread. | One name, one behaviour, already server-synced and already explained in the explainer. No second "allowance" to teach. | A **Progress logic change**: `progressAdapter.buildStreak` passes `restDays`, and `utils/streak.ts` treats rest weekdays as neutral. This is outside the teaching programme and needs its own ticket. Rest Days also needs a 2.0 settings entry point: `RestDaysScreen.tsx` exists but nothing in 2.0 links to it. **Until decided, no teaching mentions the rhythm or rest.** Alternative if you want a separate weekly allowance: fix it (call `consumeGraceDay`, persist the bridge, use local days) and give it a distinct name, e.g. "Pause Day". |
| **P-2** | Replace the "Guide mode" toggle? | **Yes: "Show tips", default ON.** | Guide mode defaults off in the store (`settingsStore.ts:574`) but reads on in the UI (`PracticeSubscreen.tsx:40`, `?? true`), and it controls only legacy 1.5 tips. No 2.0 tip respects it. | New persisted `showTips: true`. Off = no unsolicited recorded teachings. Inline copy and user-initiated explainers stay. Old `guideMode` remains for 1.5 only. |
| **P-3** | Hide the Progress "Grace day ready/used" badge now? | **Yes, in Phase 1.** | It always reads "ready" and promises protection that ends as soon as the user practises. | One render condition in `V2ProgressWeek.tsx:63-68`. Streak math is untouched. |
| **P-4** | Retire the automatic Thread card on Anchor Details? | **Yes.** | It is a second lesson that appears unasked right after the first (D-07), and it was the source of the Details double-teaching. | Stop setting `threadStrengthEducationPending` (`usePracticeCompletionScene.ts:638`) and stop rendering the card (`V2AnchorDetailsScreen.tsx:1168-1175`). Keep the component and flags for migration. |
| **P-5** | Keep v1's "Progress moved off Home" migration tip (R17)? | **Drop it.** | 1.5 → 2.0 changes everything; one layout tip is noise. 2.0 staging users already saw `home.thread`. | Nothing to build. `home.thread` is retired. |
| **P-6** | Sync teaching state across devices? | **Not now; local, per account (as today).** | Re-teaching on a new device is mild; the server has no generic prefs blob (C-5). | Later, if wanted: one nullable `guidance_state Json?` column on `user_settings` plus a field on the existing settings `PUT`. No new table. |
| **P-7** | The Chart circle's accessibility label says "Mark this move not done" once checked, but the circle can't undo (`ChartOneMoveRow.tsx:74, 106`). | **Fix the label** (or add a real undo) as a separate Chart ticket. | Teaching must not describe an undo. | No teaching change. Copy avoids undo claims. |

### 2b. Resolved by code inspection

| # | v1 question | Answer [V] | Consequence |
|---|---|---|---|
| C-1 (A4) | Where does the glow visibly change? | Completion scene (bar + glow, real before→after). `ThreadAura` on Home/Details is proportional but not "watched". `HeroHalo` is orphaned (§0). | G2 lives in the scene. Treat `HeroHalo` and `homeGlowSeenStore` as dead code to delete or revive separately; **not** a teaching dependency. |
| C-2 (A8) | Does "Replay app tips" re-trigger the first-Anchor arrival? | Yes, when the user has no other Anchor. `resolveArrivalKind` returns `'first'` once `hasSeenFirstAnchorArrival` is reset (`creationHandoff.ts:52-56`; reset at `HelpAboutSubscreen.tsx:56`). The first-practice scene is safe (it also needs `isFirstPracticeEver`). | Phase 1: Replay stops resetting legacy `userFlags`. |
| C-3 (A9) | Do trace hints have a 2.0 consumer? | No. Only `ManualReinforcementScreen`, which `AnchorCreationFlowScreen.tsx:2` marks DEFERRED. | Delete at 1.5 cutover. |
| C-4 (A10) | Can we tell existing users from new ones? | Yes: `useSessionStore.sessionLog` has completed sessions when guidance first boots. | One-time stamp `{ bootedAt, hadPracticeBeforeGuidance }` per account (coordinator doc §6). |
| C-5 (A7) | Is there a generic prefs sync? | No. `user_settings` is typed columns (`schema.prisma:966-1000`). `notificationState` is a generic record, but it is scoped to notifications (`auth.ts:347-358`). Don't overload it. | See P-6. |
| C-6 | Which "Deep Prime" strings are user-visible in 2.0? | D-01 list. | Phase 1, item 1.8. |
| C-7 | Can a celebration start before the first scene finishes? | **Likely.** The completion screen releases its milestone hold on a fixed 2.5 s timer (`V2FocusCompleteScreen.tsx:145-147`); the first scene runs 3.9 s. [A] confirm on device. | G2 yields if covered and only counts as displayed after 1 s visible and uncovered. Whether celebrations should wait for the scene is a celebration-team question, not teaching's. |
| C-8 | Does Weekly Insight suggest a next step? | A `WeeklyNextDirection` section exists (`components/v2/weeklyInsight/WeeklyNextDirection.tsx`). [A] confirm it renders for the V2 recap. | Gate G8's "suggests where to focus next" clause on that section being present. |

v1 A5 (fog) and A6 (reference photo) are closed by D-04.

---

## 3. Verified facts teaching copy depends on

| Topic | Fact [V] | Teaching implication |
|---|---|---|
| Modes | Focus · Deep Focus · Visualize · Release; purposes shown on the hub (`practice.ts:26-29`) | Mode differences are taught by existing hub copy. No tip. |
| Durations | Focus 10/30/60 s; Deep Focus 2/5/10 min; Visualize 1/3/10 min (`practice.ts:26-28`) | Today copy must template the duration. |
| Thread levels | Surface 0–19, Grounded 20–39, Rooted 40–59, Embedded 60–79, Sovereign 80–100 (`threadEvents.ts:29-39`) | Level *names* may be taught. Thresholds, gains and timelines may not. |
| Thread growth | Earned by completed practice (first-practice bonus, daily return, minutes up to a daily cap) (`threadStrengthCopy.ts:4-10`) | "Practice strengthens your thread" is accurate. "Every practice adds X" is not allowed. |
| Softening | After the Strength Buffer, −3 per day away; Rest Days never count as away (`ThreadStrengthService.ts:206-214, 122-135`) | Say "long breaks let it soften". Never say "you'll lose". |
| Glow | Brighter with higher Thread Strength; none at 0 or unmeasured (`threadAuraModel.ts:20-24`) | "As your Thread Strength grows, so does your Anchor's glow" is accurate. Never promise a glow to a 0-strength Anchor. |
| Completion scenes | `first` / `repeat` require a saved, authoritative session with `gain > 0`; stage and full-strength scenes are their own celebrations (`usePracticeCompletionScene.ts:326-334, 110-230`) | G2 attaches only to `first` or `repeat`. |
| Chart next move | Row label "Your next move" (`chartCopy.ts:19`); circle = mark done; words = details; daily close "Next move tomorrow"; waypoint reached by the user's confirmation | G6 copy (§6). |
| Celebrations | Global milestone presenter; thread-event modal on Home; first-anchor arrival; reach ceremony; release burn | All outrank guidance (D-10). |

---

## 4. Audit inventory: v2 verdicts

The full evidence for each item is in `ANCHOR_MICRO_TEACHING_AUDIT_V1_EVIDENCE.md` §2 (v1, preserved). Changes from v1 are in **bold**.

| Item | v2 verdict |
|---|---|
| `home.today` | **Merged into G1 `today.recommended`** (duration-aware Context Bubble) |
| `practice.today` | **Merged into G1** (Practice hub is the fallback host) |
| `home.progress`, `home.vision`, `home.chart`, `home.thread` | **Retire** |
| `details.vision`, `details.chart` | **Retire** → inline payoff copy I-1, I-2 |
| `practice.switch` | **G3** |
| `progress.thread` | **Replaced by G7 `progress.levels`** |
| `progress.week` | **Retire** until P-1 (it teaches the non-functional grace day) |
| `progress.rhythm`, `progress.route` | Retire |
| `vision.first` | **G4** (unchanged behaviour) |
| `vision.second` | **G5**, as a Context Bubble (no scrim) |
| Chart One Move (3 beats) | **G6**, one step, accurate copy |
| Thread education card (Details, automatic) | **Retire automatic display** (P-4) |
| `ThreadStrengthExplainerSheet` | Keep; user-initiated destination |
| Legacy registry on 2.0 paths (`IntentionInputScreen` whispers) | **Remove whispers in Phase 1** (they only run with Guide mode on, and the hesitation timer interrupts typing). Keep the "Short. Present. Felt." sheet. |
| Legacy milestone toasts (`queueMilestone`) | Stop queuing under 2.0; clear the persisted backlog (Phase 1) |
| Legacy screens' teachings | Remove at 1.5 cutover |
| v1 R7 (reference photo), R10 (fog), R12 (first waypoint), R14 (week), R17 (migration) | **Dropped.** The reach ceremony already says "Look how far you've come." |

---

## 5. Teaching experience model

**Surfaces** (visual direction retained from the approved Home and Chart mockups):

- **Context Bubble** — cream `#FBF9F4` card, 16 pt radius, soft realistic shadow, caret to the target, EB Garamond title + Figtree body, one navy "Got it". Optional ring and **light dim (≤0.24)** only when the target sits in a busy sheet (Chart); otherwise no scrim. The target stays live (D-13).
- **Scene Line** — one subline inside an existing scene, plus an optional text link. Nothing is added on top of the scene.
- **Whisper** — the existing bottom pill (Vision only).
- **Inline Card** — an in-flow intro block (Weekly only), dismissable ×.
- **Inline copy** — rewrites existing UI text. No record.

**Outcomes** (definitions in the coordinator doc §3): `displayed` (visible and uncovered ≥ 1000 ms) · `dismissed` (×, scrim, back) · `acknowledged` ("Got it") · `action_performed` (real target action succeeded) · `obsolete` (learned independently, retired, or never applicable). System interruptions (`interrupted`, `preempted`) are **not** outcomes. They leave the teaching unsettled.

**Budget:** at most one recorded teaching on screen app-wide; one per screen visit; one new unsolicited Context Bubble per foreground session. Scene Line, Whisper and Inline Card don't count against the session budget, but obey the single-surface rule and celebration priority.

---

## 6. Teaching registry (teaching by teaching)

Columns: **Eligible when** (all must hold) · **Blocked by** (any defers to a later visit; never queued) · **Completed by** · **Recurs?**
Common blockers on every surface, abbreviated **[CB]**:

- a milestone celebration presenting or queued (`milestoneCelebrationStore.queue.length > 0` or presenter active);
- `V2ThreadEventModal` active;
- first-Anchor or practice arrival active;
- release burn or Chart ceremony active;
- keyboard visible;
- a `V2DialogManager` or native alert open;
- paywall or purchase/restore in flight;
- another guidance surface active;
- "Show tips" off (recorded teachings only);
- screen not focused or settled.

| ID | Surface · screen · target | Eligible when | Blocked by | Completed by | Recurs? |
|---|---|---|---|---|---|
| **G1 `today.recommended`** | Context Bubble · Home Today card (fallback host: Practice hub Today) | Home settled and idle (existing `homeIsIdle`, `V2HomeScreen.tsx:487-490`) · selected Anchor · `today.state === 'ready'` · not done today · `mode !== 'release'` · the account has **no completed practice** · not settled | [CB] · Home motion or carousel moving · Today loading | **action**: tap the Today card → practice opens (real action) · **ack**: Got it · **dismiss**: × or back · **obsolete**: any completed practice | No. If interrupted before 1 s → re-derived on a later visit. If interrupted after being displayed → at most one re-show within 24 h, then obsolete. |
| **G2 `thread.glow`** | Scene Line · practice completion scene (`V2FocusCompleteScreen`) | Scene kind `first` → **variant A**; scene kind `repeat` → **variant B** (new users whose first scene was missed, and every existing user — D-03) · not settled · not obsolete | A celebration covering the screen before 1 s of dwell → not counted; waits for the next qualifying scene · scene kinds `stage*`, `full*`, `none` never carry it | **displayed** = completed (a line has nothing to dismiss) · **action**: tap "What's Thread Strength?" → explainer opens · **obsolete**: explainer opened *after guidance first boots* (discovery stamp). Pre-existing Thread flags and old beats don't settle it, so existing users still get it once. | No. Bound to one scene instance; never shown elsewhere. |
| **G3 `practice.switch_anchor`** | Context Bubble · Practice hub switcher | ≥2 active Anchors and the switcher is rendered (`practiceTeaching.ts`) · G1 settled or not eligible · not settled | [CB] · hub transitioning, Anchor in flight, switcher open, prepare or session active, recommendation loading (`V2PracticeScreen.tsx:178-180`) | **action**: tap the switcher → opens · **ack** · **dismiss** · **obsolete**: switcher opened before | No |
| **G4 `vision.first_photo`** | Whisper · Vision board | Exactly 1 photo · board idle in view mode (existing `visionTeachingBlocked`, `V2SavedVision.tsx:246-248`) | [CB] · edit mode, sheets, dragging, busy, arrival | **displayed** (8 s auto) · **dismiss**: × · **obsolete**: ≥2 photos (existing) | No |
| **G5 `vision.lead_image`** | Context Bubble · Vision board top slot | ≥2 photos · board idle · not settled | [CB] · as G4 | **action**: a reorder commits (`onReorder` resolves true) · **ack** · **dismiss** · **obsolete**: the user has reordered before | No. A drag that doesn't commit counts as interrupted. |
| **G6 `chart.next_move`** | Context Bubble + ring + light dim · Chart sheet, next-move row | Existing Chart conditions (`ChartActiveView.tsx:611-620`): a move is shown, opening finished, runner idle, no ceremony/reach/confirm/menu, sheet at peek or half, refs mounted · the account has **never completed a move** · not settled | [CB] · sheet moving or hidden · day-closed card showing · Chart weather hold | **action**: circle tap and the move completes (`onCheck` → true), or words tap and details expand · **ack** · **dismiss**: scrim or back · **obsolete**: any move ever completed | No. If interrupted, up to 3 presentation attempts across visits, then obsolete. |
| **G7 `progress.levels`** | Context Bubble · Progress hero | Thread measured (`!model.unmeasured`) · G2 settled · not settled | [CB] · loading, refreshing, switcher, event selected, range moving, scrolling (`V2ProgressScreen.tsx:114-117`) | **action**: tap the hero score or the "How it works" link → explainer · **ack** · **dismiss** · **obsolete**: explainer opened before | No |
| **G8 `weekly.first`** | Inline Card · top of the V2 weekly recap | The V2 recap is rendered with content · not settled | Recap loading or error | **dismiss**: × · **displayed** each visit (no settlement) · **obsolete**: a second distinct recap week viewed | Yes, on each recap visit until dismissed or obsolete (it's inline and costs no budget) |

**Inline copy (no records, no budget):**

- **I-1** Details empty Vision row payoff: "See where this leads." → "Picture where this leads. You'll use it in Visualize." (`V2AnchorDetailsScreen.tsx:72-77`).
- **I-2** Details empty Chart row payoff: "Map the path from here." → "Turn this into waypoints and a next move."
- **I-3** Intention "Short. Present. Felt." sheet: kept as is.
- **I-4** Vision description hints: kept as is.

### 6.1 Copy (final, for approval)

**G1** — Title "Start here each day." · Body "Each day Anchor suggests one practice. Today: **{Mode}**, **{duration}**." When `durationSeconds` is missing: "Today: **{Mode}**." · Primary "Got it" · A11y "Tip. Start here each day. Each day Anchor suggests one practice. Today: {Mode}, {duration spoken in full, e.g. 30 seconds}." `{Mode}` = `v2PracticeModeTitle(mode)`, `{duration}` = `v2PracticeDurationLabel(seconds)`.

**G2** — Scene note unchanged (variant A "Your Thread has begun." · variant B "Reinforced today ✓"), then subline:

- A: "As your Thread Strength grows, so does your Anchor's glow."
- B: "Your Thread Strength grew — and your Anchor's glow with it."

Link "What's Thread Strength?" (44 pt target) → `ThreadStrengthExplainerSheet`. A11y: the subline is announced once after the note; the link is a button.

**G3** — "Practicing another Anchor?" / "Switch between them here." · Got it.

**G4** — unchanged: "Images make the future feel real. Add another and choose which one leads."

**G5** — "Choose the image that leads." / "Drag a photo into the top spot. That one leads, and it's the image Home shows."

**G6** — Title "One small step for today." / Body "Tap the circle once you've done it. Tap the words to see the details." · Got it. Must **not** claim the next move is ready, that the route moves, or that a move can be undone.

**G7** — "Five stages, one thread." / "Surface, Grounded, Rooted, Embedded, Sovereign. Regular practice builds your thread; long breaks let it soften." · Got it · link "How it works".

**G8** — Title "Your week, across every Anchor." / "Anchor looks back at your practice and moves from the past week and suggests where to focus next." (last clause only if C-8 holds) · ×.

### 6.2 Dependency order (soft)

```
G1 today.recommended ──► G3 practice.switch_anchor
G2 thread.glow ────────► G7 progress.levels
G4 vision.first_photo ─► G5 vision.lead_image
G6 chart.next_move  (independent)      G8 weekly.first (independent)
```

Edges only order presentation; nothing blocks feature use.

---

## 7. Copy rules (enforced by a registry lint test)

- No "Did you know", "sigil", "ritual", "charge", "Deep Prime", "streak", "grace".
- No numerals in teaching copy except data-templated `{duration}`. No score, gain, level threshold or timeline.
- No future guarantees ("will", "always"). Use "can", "lets", or present-tense facts that hold in code.
- Never failure framing. Low strength softens; it is never "lost".
- Title ≤ 32 characters, body ≤ 120, Scene Line ≤ 70.

---

## 8. Screen coverage (v2)

| Screen | Teaching |
|---|---|
| Onboarding, creation flow, active sessions, Release, Share Studio, paywall, Course Log, milestones gallery | **None by design** |
| Intention input | I-3 (existing sheet). Legacy whispers removed. |
| Home | G1 only |
| Practice hub | G1 (fallback), G3 |
| Completion scene | G2 |
| Anchor Details | I-1, I-2. Explainer on tap. |
| Vision board | G4, G5 · creation hints I-4 |
| Chart | G6 |
| Progress | G7. Grace badge hidden (P-3). |
| Weekly Insight | G8 |

---

## 9. Journey simulations (v2)

1. **New guest, first Anchor.** Creation (none) → Home arrival → idle → **G1** "Today: Focus, 30 sec." They tap the Today card → `action_performed` → practice.
2. **First practice completed.** Scene `first`: bar fills, glow brightens, "Your Thread has begun." → **G2-A** subline. If a celebration covers it within 1 s, G2 stays unsettled for the next `repeat` scene. Home: nothing.
3. **First Vision.** Details I-1 → creation hints → board with 1 photo → **G4** → adds a second photo themselves → G4 obsolete → next idle board visit **G5**. They drag to the top → `action_performed`.
4. **First Chart.** Map opening → sheet at peek → **G6** one bubble → they tap the circle → move completes → `action_performed` → "Today's move is done." card shows (no teaching on it).
5. **Returning, low Thread.** No unsolicited teaching. Progress shows **G7** only if G2 has settled.
6. **Stage reached.** Stage scene (celebration) → no G2 on this scene → milestone, if any → nothing else.
7. **Dismissed several.** Each dismissal settles only itself. Inline copy remains. "Show tips" off → no recorded teachings at all.
8. **Rapid navigation.** No screen settles → nothing displays → nothing persisted → nothing queued for later.
9. **Existing user updates.** Boot stamp `hadPracticeBeforeGuidance: true` → G1 obsolete. On their next gaining practice → **G2-B** "Your Thread Strength grew — and your Anchor's glow with it." If they have a Chart with completed moves → G6 obsolete.
10. **Premium explorer.** G1, G3, G5, G6, G7 obsolete by history. They see G2-B once. G8 appears on their first V2 recap until dismissed.

---

## 10. Measurement (v2)

Events (one family, see the coordinator doc §8): `guidance_displayed`, `guidance_dismissed`, `guidance_acknowledged`, `guidance_action_performed`, `guidance_obsoleted {reason}`, `guidance_interrupted {reason}`, plus sampled `guidance_suppressed`.

Outcome metrics:

| Teaching | Metric |
|---|---|
| G1 | First practice within 24 h of creation |
| G2 | Second practice within 72 h; explainer opens (secondary) |
| G5 | Reorder rate |
| G6 | First move completed **and** later waypoint confirmed |
| G7 | Progress return visits |
| G8 | Recap feedback |

Tap-through alone is never a success metric.

---

## 11. Next steps

1. Answer P-1 to P-7 (P-1 blocks nothing in Phase 1; it only keeps rhythm teaching off).
2. Approve Phase 1 (`ANCHOR_GUIDANCE_PHASE1_CLEANUP_PLAN.md`).
3. Approve the coordinator (`ANCHOR_GUIDANCE_COORDINATOR_ARCHITECTURE.md`), then Phase 2 → 3.

*v1 is preserved as `ANCHOR_MICRO_TEACHING_AUDIT_V1_EVIDENCE.md`. Its §2 evidence tables remain valid where not contradicted above; its design sections are superseded by this file.*
