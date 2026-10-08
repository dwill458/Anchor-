# Contextual teaching implementation — 2026-10-08

Implemented the eight stages against the supplied Markdown and HTML references in eight local stage commits. Production data, navigation, premium gates, existing artwork and board gestures remain in place. Nothing has been pushed or deployed. The pre-existing dirty Chart work remains outside these commits.

## Per-stage delivery

| Stage | Commit | Delivery | Focused verification at stage |
|---|---|---|---|
| 1 | d9b8f2bc | Fresh settings default guideMode=false; persisted true and migration versions retained. | 10 passed |
| 2 | d6cb8da7 | Shared coach/whisper, encrypted account flags, capped frozen queue, analytics, scroll helper and dev replay/reset controls. | 12 passed |
| 3 | f8f5c7c9 | Home priority queue, conditional Progress/Thread, existing elastic scrolling and arrival gates. | 57 passed |
| 4 | 8a83359c | Empty Details Vision before Chart, one beat per focus visit; sheet opens before measuring. | 48 passed |
| 5 | 49ec0ed7 | Today plus switch only for 2+ anchors, two per visit; session/setup excluded. | 36 passed |
| 6 | 72cfaa4d | Thread/week then rhythm/route; unmeasured skips Thread; scroll and range-motion gates. | 20 passed |
| 7 | d098b8d6 | One-photo whisper, newest-photo projected spotlight at 2+, actual board/camera motion gates. | 45 passed |
| 8 | final replay commit | Settings replay for current account with existing toast. Final review tightens account callback isolation, in-flight cache invalidation, equal-timestamp newest-photo selection, interruption analytics, Home drag gating and actual Add Vision eligibility/export gating. | Included in final checks below |

Settings copy locations: `src/stores/settingsStore.ts:574` changes only the initial default; `src/constants/v2/teachingCopy.ts:1` contains all new registry copy (replay at line 3); `src/screens/settings/PracticeSubscreen.tsx:714` adds the row beneath the unchanged guide toggle. The exact changed line ranges for every file appear below.

## Persistence and queue

The only new production key family is `anchor:v2:teach:{beat}:{encodedAccountId}` through the existing encrypted persistence adapter. Guests use memory only. Reset deletes the 15 registered beats for the current account only. Storage failures are caught. Per-key write serialization and cache generations prevent stale asynchronous reads/writes from resurrecting reset flags. A stale dismissal callback cannot mark another account's beats.

Each focused visit waits until unblocked, loads seen flags and waits one InteractionManager turn before selecting the first N unseen eligible beats. The batch is frozen. Scrim/back/completion dismissals mark the batch; interruption empties it without marking and does not restart during that focus visit. Both guide-mode values run the same contextual teaching code. Settings replay takes effect on later screen visits; the dev Replay teaching control can restart the currently mounted dev screen.

## Targets, refs and fallbacks

No target testIDs were renamed. Existing target IDs remain on the real components. New overlay IDs: `spotlight-coach-measure`, `spotlight-coach`, `teaching-whisper`.

| Screen | Added target refs / adapters | Measurement |
|---|---|---|
| Home | todayTeachingRef, progressTeachingRef, visionTeachingRef, chartTeachingRef, threadTeachingRef; optional teachingThreadRef through V2HomeHero/AnchorHeroItem and teachingRef on ThreadReading | Existing sections wrapped without layout styling; thread ref attaches to existing reading. scrollViewportRef establishes window origin. |
| Details | visionTeachingRef, chartTeachingRef, teachingScrollRef, teachingViewportRef | Existing Add Vision/Create Chart sections; raise sheet using existing timing, scroll then measure. |
| Practice | todayTeachingRef, switchTeachingRef | Real Today card and anchor switcher. |
| Progress | threadTeachingRef, weekTeachingRef, rhythmTeachingRef, routeTeachingRef, scrollRef | Hero wrapper includes ring and permanent pips; real cards scroll then measure. |
| Vision | teachingScrollRef; teachingTarget callback ref in V2SavedVision; teachingViewportRef in VisionBoard | Measures board viewport only, then projects actual slotRects using restCamera, order and latest saved scene. No photo measureInWindow. |
| Shared coach | root | Converts window target rectangles to overlay coordinates. |

Home/Progress use the same scrollToTarget helper: clamp current offset to scroll bounds, put target about 150px below viewport top, wait 460ms (instant reduced motion), measure again. Details/Vision also use this helper. An unmeasurable ordinary target is silently skipped. Vision falls back to the whole measured board viewport if the newest scene has no rendered slot; no failure requiring that fallback was observed on a real device because that acceptance pass remains open.

The complete added ref declarations (including internal bookkeeping refs and optional ref props) are listed below with source lines.

## Idle gates and analytics

Canonical Home signal is `homeIsIdle` in V2HomeScreen:461. It requires focused/transition settled, no active arrival or overlay arrival, no veil swap, no carousel swap, no veil/drag/overscroll/user momentum, no focus transition/paywall and no thread-event modal, ready anchor and settled Today/Progress/Vision/Chart data. Controlled teaching scrolling suppresses its own momentum gate; user drag and overscroll remain blockers. Queue also waits InteractionManager.

Details blocks sheet drag/settle, focus/pinned-bar transition, options/share, export operations and loading. Practice blocks anchor flight, switcher, setup/session/resume and loading. Progress blocks user scrolling, focus/anchor/thread sheets, loading and range spring movement. Vision blocks camera focus, drag, photo/card geometry motion, recompose, arrival/ceremony, loading, picker, add/manage/menu/native alert and user scrolling. Optional callbacks observe existing animation behavior without changing gestures or onReorder.

`src/utils/v2/teachingAnalytics.ts` uses existing AnalyticsService.track. New events are `teaching_beat_shown`, `teaching_beat_advanced`, `teaching_beat_dismissed`; props: screen, beat, step, total, reason. Shown is deduplicated per batch. Interruptions and unmounts report dismissal without marking seen. Existing analytics events/props are untouched.

No old guide-mode teaching call sites were found in these five target screens or their Vision components. Old guide-dependent guidance remains on AnchorRevealScreen:220 and its explainer at :247, outside these target screens; useSettings mapping remains at :114/:151. Chart keeps its independent ChartOneMoveTeaching/chartTaughtState system on the Chart route. Those systems were not merged or modified. The supplied protected chartCopy file already had user changes and was excluded from our commits.

## Verification and limits

Final expanded integration run: **27 suites, 256 tests passed**, zero failures. Final Details adjustment: **2 suites, 48 tests passed** (overlaps the integration run). Full `tsc --noEmit --pretty false` passes. Tests cover account persistence/reset, queue caps/freezing/interruption, Home scenarios, Details cap, Practice count, Progress prerequisites, Vision eligibility/projection/gesture regressions, settings replay/default hydration, reduced motion and accessibility labels/announcement. Coach text is scrollable and constrained to the viewport; native font-scale acceptance is still required.

Baseline comparison: before **90 tests: 80 passed, 10 failed**; after **90 tests: 80 passed, 10 failed**. All ten failures are existing ChartPreview snapshots (10 failed snapshots, 5 passing snapshots). The brief's predicted five Vision picker failures were not reproduced: visionPhotoInput has 8 passing tests; V2VisionScreen.addImage has 15 passing tests. No baseline snapshot or photo-picker failure was edited to force a pass. Stage counts overlap and must not be summed.

The attached Android emulator was inspected. Installed com.anchorintentions.app opens the existing standalone Chart opening QA entry; screenshot `emulator-current.png` records that limitation. The user's Metro/QA entry was preserved. This screenshot does not demonstrate teaching rendering.

Still owed on an authenticated real app/device:
- Fresh-install Home first/second launch and late Vision/Chart additions, both guide settings, all per-screen caps and Settings replay.
- No teaching during every live modal/paywall/arrival/drag/ceremony; dismiss by scrim/back/Got it.
- Post-dismiss scrolling/tapping, Vision focus/reorder and slot-0 Home leadership.
- Native screen reader announcements/focus, font scale 1.3, every tooltip placement/crop and reduced-motion behavior.
- Physical S24 Ultra frame pacing and fully visible scroll targets. No 60fps or visual-parity claim is made from unit tests.

## Every source/test file changed and exact diff line ranges

Paths below are relative to repository root. Ranges denote additions/edits in the final file, against the pre-task HEAD f56063a8. Existing unrelated dirty files were excluded.

- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx`: 35, 84, 89, 174, 190, 364, 373, 384-385
- `anchor/mobile/src/components/v2/primitives/V2SegmentedControl.tsx`: 3, 12, 31-38
- `anchor/mobile/src/components/v2/progress/V2ProgressRhythm.tsx`: 16, 168, 184
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx`: 1-52
- `anchor/mobile/src/components/v2/teaching/SpotlightCoach.tsx`: 1-127
- `anchor/mobile/src/components/v2/teaching/TeachingWhisper.tsx`: 1-22
- `anchor/mobile/src/components/v2/teaching/__tests__/SpotlightCoach.test.tsx`: 1-53
- `anchor/mobile/src/components/v2/teaching/__tests__/TeachingWhisper.test.tsx`: 1-15
- `anchor/mobile/src/components/v2/teaching/__tests__/scrollToTarget.test.ts`: 1-14
- `anchor/mobile/src/components/v2/teaching/scrollToTarget.ts`: 1-28
- `anchor/mobile/src/components/v2/vision/V2SavedVision.tsx`: 21, 24-30, 71-73, 86, 110-119, 161-176, 201, 203, 205, 214, 238, 240, 242, 248, 264-271, 292-293, 381
- `anchor/mobile/src/components/v2/vision/__tests__/V2SavedVision.teaching.test.tsx`: 1-59
- `anchor/mobile/src/components/v2/vision/board/VisionBoard.tsx`: 3, 16-17, 47-48, 59, 76-102, 212, 240
- `anchor/mobile/src/components/v2/vision/board/VisionBoardIntentionCard.tsx`: 3, 30, 36, 58-62
- `anchor/mobile/src/components/v2/vision/board/VisionBoardPhoto.tsx`: 48, 66, 105-119
- `anchor/mobile/src/components/v2/vision/board/VisionBoardScene.tsx`: 34, 61, 97, 105
- `anchor/mobile/src/constants/v2/teachingCopy.ts`: 1-25
- `anchor/mobile/src/hooks/v2/teaching/__tests__/detailsTeaching.test.tsx`: 1-21
- `anchor/mobile/src/hooks/v2/teaching/__tests__/homeTeaching.test.tsx`: 1-30
- `anchor/mobile/src/hooks/v2/teaching/__tests__/practiceTeaching.test.ts`: 1-6
- `anchor/mobile/src/hooks/v2/teaching/__tests__/progressTeaching.test.tsx`: 1-20
- `anchor/mobile/src/hooks/v2/teaching/__tests__/teachingSeen.test.ts`: 1-47
- `anchor/mobile/src/hooks/v2/teaching/__tests__/useTeachingQueue.test.tsx`: 1-47
- `anchor/mobile/src/hooks/v2/teaching/__tests__/visionTeaching.test.ts`: 1-23
- `anchor/mobile/src/hooks/v2/teaching/detailsTeaching.ts`: 1-5
- `anchor/mobile/src/hooks/v2/teaching/homeTeaching.ts`: 1-7
- `anchor/mobile/src/hooks/v2/teaching/practiceTeaching.ts`: 1-4
- `anchor/mobile/src/hooks/v2/teaching/progressTeaching.ts`: 1-5
- `anchor/mobile/src/hooks/v2/teaching/teachingSeen.ts`: 1-53
- `anchor/mobile/src/hooks/v2/teaching/useTeachingFocus.ts`: 1-25
- `anchor/mobile/src/hooks/v2/teaching/useTeachingQueue.ts`: 1-71
- `anchor/mobile/src/hooks/v2/teaching/visionTeaching.ts`: 1-21
- `anchor/mobile/src/screens/settings/PracticeSubscreen.tsx`: 42-44, 103-108, 714-715
- `anchor/mobile/src/screens/settings/__tests__/SettingsScreen.test.tsx`: 312
- `anchor/mobile/src/screens/settings/__tests__/SettingsSubscreens.test.tsx`: 9-12, 111-112, 153-160
- `anchor/mobile/src/screens/v2/anchors/V2AnchorDetailsScreen.tsx`: 55-60, 584-593, 676, 678, 684, 689, 726, 739, 767, 780, 847-865, 1051, 1053-1055, 1072, 1085, 1087, 1096, 1140-1143
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx`: 1, 4, 37-41, 115-126, 426, 456-474, 607, 611-618, 639, 666, 676, 678, 681, 683-684, 686, 693, 707-711
- `anchor/mobile/src/screens/v2/home/homeElasticScroll.ts`: 72, 98, 101, 168-172
- `anchor/mobile/src/screens/v2/practice/V2PracticeScreen.tsx`: 38-42, 127-130, 171-173, 555, 562, 579, 621-623
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx`: 31-37, 74-95, 152-160, 211, 217, 229, 237, 239, 252, 299-303
- `anchor/mobile/src/screens/v2/system/ChartLabDevHost.tsx`: 2, 5-7, 16-23, 51-54
- `anchor/mobile/src/screens/v2/vision/V2VisionScreen.tsx`: 19, 87, 154-155, 163, 355-357
- `anchor/mobile/src/screens/v2/vision/__tests__/V2VisionScreen.addImage.test.tsx`: 11
- `anchor/mobile/src/screens/v2/vision/__tests__/V2VisionScreen.test.tsx`: 24
- `anchor/mobile/src/stores/__tests__/settingsStoreTeaching.test.ts`: 1-13
- `anchor/mobile/src/stores/settingsStore.ts`: 574
- `anchor/mobile/src/utils/v2/teachingAnalytics.ts`: 1-7

## Added ref declarations and ref props

- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx:35` — `teachingThreadRef?: React.RefObject<View | null>;`
- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx:84` — `function ThreadReading({ thread, accent, active, teachingRef }: { thread: V2ThreadPresentation; accent: string; active: boolean; teachingRef?: React.RefObject<View | null> }) {`
- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx:89` — `<View ref={active ? teachingRef : undefined} collapsable={false} testID={active ? 'v2-home-thread-reading' : undefined} style={styles.threadRow}>`
- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx:190` — `teachingThreadRef?: React.RefObject<View | null>;`
- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx:364` — `<ThreadReading thread={thread} accent={accent} active={slot === 0} teachingRef={teachingThreadRef} />`
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx:1` — `import React, { useCallback, useRef } from 'react';`
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx:14` — `const active = useRef<BeatId | null>(null);`
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx:15` — `const presented = useRef<{ beat: BeatId; step: number; total: number } | null>(null);`
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx:16` — `const lastDismissed = useRef(false);`
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx:17` — `const shown = useRef(new Set<BeatId>());`
- `anchor/mobile/src/components/v2/teaching/ScreenTeaching.tsx:18` — `const previousBatch = useRef(queue.steps);`
- `anchor/mobile/src/components/v2/teaching/SpotlightCoach.tsx:1` — `import React, { useEffect, useRef, useState } from 'react';`
- `anchor/mobile/src/components/v2/teaching/SpotlightCoach.tsx:9` — `targetRef?: React.RefObject<View | null>;`
- `anchor/mobile/src/components/v2/teaching/SpotlightCoach.tsx:28` — `const latest = useRef(props);`
- `anchor/mobile/src/components/v2/teaching/SpotlightCoach.tsx:30` — `const root = useRef<View>(null);`
- `anchor/mobile/src/components/v2/teaching/SpotlightCoach.tsx:36` — `const hasSpot = useRef(false);`
- `anchor/mobile/src/components/v2/vision/V2SavedVision.tsx:116` — `const teachingTarget = useRef<((sceneId: string | null) => Promise<TeachingRect | null>) | null>(null);`
- `anchor/mobile/src/components/v2/vision/V2SavedVision.tsx:117` — `const teachingScrollRef = useRef<ScrollView>(null);`
- `anchor/mobile/src/components/v2/vision/V2SavedVision.tsx:118` — `const teachingScrollMetrics = useRef({ y: 0, content: 0, viewport: 0 });`
- `anchor/mobile/src/components/v2/vision/V2SavedVision.tsx:119` — `const teachingControlledScroll = useRef(false);`
- `anchor/mobile/src/components/v2/vision/board/VisionBoard.tsx:48` — `teachingTarget?: React.MutableRefObject<((sceneId: string | null) => Promise<TeachingRect | null>) | null>;`
- `anchor/mobile/src/components/v2/vision/board/VisionBoard.tsx:76` — `const teachingViewportRef = useRef<View>(null);`
- `anchor/mobile/src/hooks/v2/teaching/useTeachingQueue.ts:1` — `import { useCallback, useEffect, useRef, useState } from 'react';`
- `anchor/mobile/src/hooks/v2/teaching/useTeachingQueue.ts:18` — `const decided = useRef(false);`
- `anchor/mobile/src/hooks/v2/teaching/useTeachingQueue.ts:19` — `const batchRef = useRef<BeatId[]>([]);`
- `anchor/mobile/src/hooks/v2/teaching/useTeachingQueue.ts:21` — `const owner = useRef(session);`
- `anchor/mobile/src/hooks/v2/teaching/useTeachingQueue.ts:22` — `const live = useRef({ blocked, isFocused, session, accountId });`
- `anchor/mobile/src/screens/v2/anchors/V2AnchorDetailsScreen.tsx:586` — `const visionTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/anchors/V2AnchorDetailsScreen.tsx:587` — `const chartTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/anchors/V2AnchorDetailsScreen.tsx:588` — `const teachingScrollRef = useRef<Animated.ScrollView>(null);`
- `anchor/mobile/src/screens/v2/anchors/V2AnchorDetailsScreen.tsx:589` — `const teachingViewportRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/anchors/V2AnchorDetailsScreen.tsx:590` — `const teachingScrollSize = useRef({ content: 0, viewport: 0 });`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:1` — `import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:117` — `const todayTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:118` — `const progressTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:119` — `const visionTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:120` — `const chartTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:121` — `const threadTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:122` — `const scrollViewportRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:123` — `const teachingScrollSize = useRef({ content: 0, viewport: 0 });`
- `anchor/mobile/src/screens/v2/practice/V2PracticeScreen.tsx:129` — `const todayTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/practice/V2PracticeScreen.tsx:130` — `const switchTeachingRef = useRef<View>(null);`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:77` — `const scrollRef = React.useRef<ScrollView>(null);`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:78` — `const threadTeachingRef = React.useRef<View>(null);`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:79` — `const weekTeachingRef = React.useRef<View>(null);`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:80` — `const rhythmTeachingRef = React.useRef<View>(null);`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:81` — `const routeTeachingRef = React.useRef<View>(null);`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:82` — `const scrollMetrics = React.useRef({ y: 0, content: 0, viewport: 0 });`
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx:83` — `const controlledScroll = React.useRef(false);`
