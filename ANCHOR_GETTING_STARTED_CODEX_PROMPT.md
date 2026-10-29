# Codex prompt: Getting started card + contextual teaching (Home, Anchor details, Vision, Progress)

Active code is `anchor/mobile/src/`. Do not touch `anchor-v2/`.
Approved prototype: `ANCHOR_GETTING_STARTED_PROTOTYPE.html` (repo root). Open it in a browser and use **Jump to a state** before you start. Where this prompt and the prototype disagree, this prompt wins.

## Read first, in this order
1. `ANCHOR_GUIDANCE_COORDINATOR_ARCHITECTURE.md` §4.3–4.5, §7, §8. This work extends the coordinator. It does not build a second system.
2. `src/constants/v2/guidanceRegistry.ts`, `src/constants/v2/teachingCopy.ts` (whole files).
3. `src/stores/v2/guidanceCoordinator.ts`, `src/stores/v2/guidanceRecords.ts`, `src/hooks/v2/guidance/*` (whole folder).
4. `src/hooks/v2/teaching/useTeachingQueue.ts`, `homeTeaching.ts`, `detailsTeaching.ts`, `progressTeaching.ts`, `visionTeaching.ts`.
5. `src/components/v2/teaching/ScreenTeaching.tsx`, `SpotlightCoach.tsx`, `TeachingWhisper.tsx`, `scrollToTarget.ts`.
6. `src/screens/v2/home/V2HomeScreen.tsx` ~124-138 (teaching refs), ~495-511 (idle gate, queue, `getTeachingRect`), ~688-765 (hero and section order), ~779-782 (`ScreenTeaching`).
7. `src/components/v2/home/V2HomeHero.tsx` (`ThreadReading` ~94-125, `AnchorHeroItem` ~192+), `V2HomeHeader.tsx` (~104 Create Anchor), `V2HomeProgressSection`, `V2HomeVisionSection.tsx`, `V2HomeChartSection.tsx`.
8. `src/screens/v2/anchors/V2AnchorDetailsScreen.tsx` ~613-614 (refs), ~923-940 (queue and `getTeachingRect`), ~1187-1202 (Vision and Chart blocks), ~1256-1258 (`ScreenTeaching`).
9. `src/screens/v2/progress/V2ProgressScreen.tsx` ~116, ~321. `src/components/v2/vision/V2SavedVision.tsx` ~256. `src/components/v2/thread/ThreadGlowLesson.tsx`.
10. `src/screens/settings/HelpAboutSubscreen.tsx` ~53-57 (Replay tips).

## Why
A new user lands on Home with no Vision and no Chart. Today they get one bubble per session, and Home only has two live beats (`home.today`, `home.anchor`). Nobody is taught that:
- Vision and Chart are added from the anchor's page, which you reach by tapping the anchor.
- Progress is the Progress section on Home until a Vision exists, and after that it opens from Thread Strength under the anchor.
- Thread Strength is the glow behind the anchor, which grows with consistency.
- **+** makes another anchor, and each anchor has its own Home that you swipe between.

The fix has two parts:
- **A "Getting started" card on Home** with six steps. It completes from real behaviour, so it never nags and can't over-teach.
- **Short contextual bubbles** at the moment each path becomes relevant. These use the existing cream coach card, without the full scrim.

## Order of work (one commit per stage)
Stage 1: measurement fix. Stage 2: guidance definitions and copy. Stage 3: Getting started card. Stage 4: per-screen hosts (Home, Details, Vision, Progress). Stage 5: tests. Do not start a stage until the previous stage's tests pass.

## Stage 1: measure after the scroll settles
The prototype showed rings and tips landing where the target *was* mid-scroll.

| # | File | Change |
|---|---|---|
| 1.1 | `scrollToTarget.ts` | After issuing the scroll, resolve only once the offset has been stable for 4 consecutive frames (≤0.5 px), or after a 2 s cap. Export `waitForScrollSettle(scrollY: SharedValue<number>)`. |
| 1.2 | `V2HomeScreen.tsx` `getTeachingRect` (~505) | `await` the settle before `measureTeachingTarget`. |
| 1.3 | `V2AnchorDetailsScreen.tsx` `getTeachingRect` (~930) | Replace the fixed `SNAP_MS + 40` wait with the sheet snap callback plus the same settle check on the inner scroll. |
| 1.4 | `SpotlightCoach.tsx` tip width | Clamp the tip to `bounds.width - MARGIN * 2`, including padding. In the prototype, tips ran 30 px past the right edge. |

## Stage 2: guidance definitions and copy
Add to `GUIDANCE_REGISTRY` (all `surface: 'bubble'` unless noted). Add new `BeatId`s to `TEACHING_COPY.beats`.

| # | Guidance id | Beat | Host · target | Eligible when | Settles when (`action_performed` / discovery) |
|---|---|---|---|---|---|
| 2.1 | `home.thread_glow` | `home.glow` | home · active anchor artwork (no ring, bubble below) | first Home focus after a confirmed practice, `threadMeasured` | Got it, or discovery `thread.explainer_opened` |
| 2.2 | `home.progress_section` | `home.progress` (un-retire) | home · `progressTeachingRef` | Show me only | Progress opened from the section |
| 2.3 | `home.progress_moved` | `home.thread` (un-retire, new copy) | home · `teachingThreadRef` | first Home focus after the anchor's first Vision image is saved, `hasCompletedPractice` | Got it, or Progress opened from Thread Strength |
| 2.4 | `home.open_anchor` | `home.anchor` (existing) | home · `teachingAnchorRef` | **Changes:** shown only via Show me; the persistent chip (Stage 3.4) does the unprompted work | details screen focused (existing `beginGuidanceAction`) |
| 2.5 | `details.vision_chart` | `details.vision` (un-retire, new copy) | details · `visionTeachingRef` | Vision empty, first details visit, or Show me | Add Vision tapped |
| 2.6 | `details.chart_next` | `details.chart` (un-retire, new copy) | details · `chartTeachingRef` | Chart empty and (Vision just added this visit, or Show me) | Create Chart tapped |
| 2.7 | `home.create_anchor` | `home.create` (new) | home · header + button | Show me only | creation flow opened (or paywall shown, see Open decision) |
| 2.8 | `home.swipe_anchors` | `home.swipe` (new) | home · hero carousel (no ring) | first Home focus with `activeAnchorCount >= 2` | Got it, or carousel index changes |
| 2.9 | `progress.levels` (existing) | `progress.thread` | unchanged | unchanged | copy change only |
| 2.10 | `vision.first_photo`, `vision.lead_image` (existing) | unchanged | unchanged | unchanged | Stage 1 fixes the placement; no logic change |

**Budget rule (amends §4.4).** A bubble whose trigger is the user's own action in the same session is a *follow-through* and is exempt from the per-session bubble budget. It still obeys "one visible app-wide", celebrations win, and one per host visit. This covers Show me, 2.1, 2.3, 2.5, 2.6 and 2.8. Add `followThrough: true` to those definitions and check it in the coordinator's session-budget branch. Spontaneous bubbles (`today.recommended`, `practice.switch_anchor`, `progress.levels`) keep today's budget.

**`home.thread_glow` vs the existing `thread.glow` scene line.** Keep both. The scene line names the glow on the completion screen. The Home bubble points at the real glow on Home. If `thread.glow` was dismissed without being read (`displayCount === 0`), the Home bubble still shows.

Remove `home.progress`, `home.thread`, `details.vision` and `details.chart` from `RETIRED_TEACHING_BEAT_IDS`. Leave a `// DEFERRED:` note listing what was un-retired and why.

## Stage 3: Getting started card
New files:
- `components/v2/home/V2HomeGettingStarted.tsx`
- `hooks/v2/guidance/useGettingStarted.ts`
- `constants/v2/gettingStartedCopy.ts`

| # | Item | Spec |
|---|---|---|
| 3.1 | Placement | `V2HomeScreen.tsx`, directly after the Today block (~744) and before `V2HomeVisionSection`. It sits on the graphite zone and is **not anchor-scoped**: it doesn't fade with `contentVeilStyle` when the carousel moves. |
| 3.2 | Steps (account-wide, derived, never stored as their own flags) | 1 `practice`: `hasCompletedPractice`. 2 `progress`: discovery `progress.opened` (new seam: `V2ProgressScreen` focus). Locked until step 1. 3 `anchor`: discovery `home.open_anchor`. 4 `vision`: any active anchor has Vision content. 5 `chart`: any course exists. 6 `another`: `activeAnchorCount >= 2`, or discovery `creation.opened`. |
| 3.3 | Visibility | Show when the account's guidance boot stamp has `hadPracticeBeforeGuidance === false` and the card isn't dismissed. Existing users who practised before this ships never see it. Hide it permanently once all six are complete and the user taps Close. Persist `gettingStarted: { dismissedAt?: string }` inside the existing `guidanceRecords` blob (no new storage key). |
| 3.4 | "Tap your anchor" chip | `V2HomeHero.tsx`: a small ink pill under the **active** anchor ring while step 3 is incomplete and the card isn't dismissed. Gentle 2.4 s bob, off under Reduce Motion. Hide it while any bubble targets the anchor. It doesn't take taps (`pointerEvents="none"`). |
| 3.5 | Row anatomy | 30 px state circle (dashed outline, then filled ink with a check), title, one-line description, and a trailing **Show me** pill, or the locked text "After practice". Done rows strike through and drop their description. A six-segment progress bar sits under the header. **No route, flag or waypoint graphics, and none of the words "course" or "waypoint"**: a new user has no Chart, and Chart's visual language here reads as one. |
| 3.6 | Show me | Add `guidanceCoordinator.request(id, { pending? })`, which marks the id as user-requested. It presents on the next ready host that lists the id, even when the id is settled. It bypasses the session budget but not single-visible or celebrations. Show me calls it with the guidance id from the 2.x table. Vision and Chart rows request `home.open_anchor` with a `pending` value of `vision` or `chart`. Details reads it on focus and presents 2.5 or 2.6. The `progress` row requests 2.2 before a Vision exists and 2.3's target after. |
| 3.7 | Completion | When the last step completes, the rows collapse to one line plus a **Close** pill. Use a quiet ink fade, not a celebration: the celebration layer stays reserved for milestones. |
| 3.8 | Hide | The header "Hide" sets `dismissedAt`, followed by the toast "Bring it back in Settings → Replay app tips". |
| 3.9 | Replay | `replayGuidance` also clears `gettingStarted.dismissedAt`. |

## Stage 4: hosts
| # | File | Change |
|---|---|---|
| 4.1 | `homeTeaching.ts` | Return the eligible list in priority order: `home.thread_glow`, `home.progress_moved`, `home.swipe_anchors`, then `home.today`. `home.anchor` is no longer auto-eligible (the chip replaces it). |
| 4.2 | `V2HomeScreen.tsx` | Add targets for the + button (forward a ref through `V2HomeHeader`), the carousel, and the anchor artwork with `ring: false`. Keep `cap: 1`. |
| 4.3 | `detailsTeaching.ts` | Replace `return []` with: Vision empty → `details.vision`; Vision present and Chart empty → `details.chart`. Keep `DETAILS_BEATS_PER_VISIT = 1`. |
| 4.4 | `V2AnchorDetailsScreen.tsx` | After the Vision ceremony returns with a saved Vision, re-run eligibility in the same visit so 2.6 can present. Read the Getting started `pending` value on focus. |
| 4.5 | `V2ProgressScreen.tsx` | Emit discovery `progress.opened` on first focus. |
| 4.6 | `SpotlightCoach.tsx` | Add a `ring?: boolean` step option (default true). With `ring: false`, draw no outline and no scrim panels; show the tip and arrow only. Every new beat uses the no-scrim variant. Keep the scrim path for any existing caller that still needs it. |
| 4.7 | Creation entry | Emit discovery `creation.opened` where `onCreateAnchor` routes (Home header and All Anchors). |

## Copy (all new or changed strings)
| Key | File | Title | Body |
|---|---|---|---|
| `home.glow` | teachingCopy.ts | This glow is your Thread Strength | It's faint on day one. Every day you practice this anchor it grows brighter. Miss a day and it fades slowly, but never back to zero. |
| `home.progress` | teachingCopy.ts ~7 | Your progress lives here | Tap to open your Thread Strength, your week and your history. Once you add a Vision, you'll get here by tapping Thread Strength under your anchor. |
| `home.thread` | teachingCopy.ts ~11 | Progress moved here | Your Vision took the Progress section's spot on Home. Tap Thread Strength any time to see your full progress. |
| `home.anchor` | teachingCopy.ts ~8 | Tap your anchor | Its page is where you add a Vision and a Chart. |
| `details.vision` | teachingCopy.ts ~12 | Vision and Chart start here | Start with a Vision: a picture of where you're headed. Chart is right below it. |
| `details.chart` | teachingCopy.ts ~13 | Now give it a path | Chart breaks the goal into waypoints and the next move you can make. |
| `home.create` | teachingCopy.ts | Make another anchor | Tap + to start a new one. Each anchor gets its own Home, and you swipe between them here. |
| `home.swipe` | teachingCopy.ts | Swipe between your anchors | Each anchor has its own Home: its own Today, Vision, Chart and progress. All Anchors shows every one. |
| `progress.thread` | teachingCopy.ts ~16 | This is your Thread Strength. | It grows when you practice and fades slowly when you don't. The glow behind your anchor shows it. The five stages show how established your thread has become. |
| card header | gettingStartedCopy.ts | Getting started · Six steps to find your way around | Done: "You know the way around" + "Practice daily and watch the glow behind your anchor grow." |
| rows | gettingStartedCopy.ts | Do your first practice / See your progress / Open your anchor / Add a Vision / Chart your path / Make another anchor | "Today picks one for you." / "Tap the Progress section on Home." (after Vision: "Tap Thread Strength under your anchor.") / "Tap it. Vision and Chart live on its page." / "On your anchor's page. A picture of where you're headed." / "On your anchor's page. Waypoints and your next move." / "Tap + at the top. Each anchor gets its own Home." |
| chip | gettingStartedCopy.ts | Tap your anchor | — |

Practice row: use the real Today duration rather than "one minute". The vocabulary rules hold: no "prime", "streak", "ritual" or "sigil" anywhere.

## Preservation rules (locked)
- Route names, navigation params and screen exports unchanged.
- Storage: only the existing `guidanceRecords` blob gains `gettingStarted`. No new AsyncStorage keys. Bump the blob `schema` only if the loader rejects the extra field; if you do, migrate in place.
- Analytics: existing `guidance_*` and `teaching_beat_*` event names and props unchanged. New events: `getting_started_viewed` `{ completed, total }` once per Home visit, `getting_started_show_me` `{ step }`, `getting_started_step_completed` `{ step, source: 'organic'|'show_me' }`, `getting_started_dismissed` `{ completed }`, `getting_started_completed`. Add them to `ANCHOR_ANALYTICS_EVENT_CATALOG.md`.
- Exported signatures unchanged: `useTeachingQueue`, `useGuidanceHost`, `ScreenTeaching`, `SpotlightCoach` (new props optional only).
- Untouched: `ChartOneMoveTeaching.tsx`, `chartTaughtState.ts`, `ThreadGlowLesson.tsx` logic, the milestone presenter, and celebration timing.
- Nothing deleted. Anything superseded gets `// DEFERRED:` with a one-line reason.
- Don't fix the pre-existing failing tests (ChartPreview snapshots). Report the counts before and after.

## Tests
- Getting started derivation: each step flips from its real source. Progress stays locked until a practice exists. An existing user with `hadPracticeBeforeGuidance` never sees the card. Hide persists; Replay restores it.
- Follow-through budget: after `today.recommended` has used the session budget, Show me, `home.thread_glow`, `details.chart_next` and `home.swipe_anchors` still present. `practice.switch_anchor` does not.
- Celebrations win: a milestone queued during a follow-through hides the bubble with `interrupted`, and it stays unsettled.
- Details chain: Add Vision → the ceremony returns → `details.chart` presents in the same visit and targets the Chart block.
- Progress moved: the first Vision image saved → back to Home → `home.thread` targets Thread Strength; the Progress section is gone.
- `waitForScrollSettle` resolves after a stable offset and after the 2 s cap.
- `tsc --noEmit` passes.

## Acceptance
- [ ] Fresh install → seal → Home: the Today hint, the Getting started card (0 of 6) and the "Tap your anchor" chip. No scrim.
- [ ] First practice → back to Home: the glow fades in and the glow bubble sits under the anchor without covering it.
- [ ] Show me on every row scrolls, waits, then rings the right control on a mid-range Android and an iPhone.
- [ ] Tap the anchor → details: the bubble points at Vision. Add Vision → back on details: the bubble points at Chart.
- [ ] After the first Vision, Home shows Your Vision in place of Progress, and the "Progress moved here" bubble points at Thread Strength.
- [ ] Second anchor created → Home: neighbours peek and the swipe bubble appears once.
- [ ] Progress' first open uses the new glow line.
- [ ] Six of six → the card collapses to Close → closing it never brings it back unless Replay is used.
- [ ] Reduce Motion: no bob, no ring pulse, instant tip fades.
- [ ] Existing account with practice history: no card, no new bubbles beyond what's live today.

## Open decision (default applied)
Free users get one anchor, so **+** for a free user opens the paywall. The default here: step 6 completes on `creation.opened` *or* the paywall being shown from that tap, so free users can finish the card. If you'd rather hide step 6 for free users, gate it on entitlement and use "Five steps" in the header copy.

## Report back
Per stage: what changed, with line numbers; test counts before and after; which follow-through bubbles were suppressed by celebrations in your runs; anything you couldn't verify without a device (scroll settle timing on Android, the chip bob, the carousel peek).
