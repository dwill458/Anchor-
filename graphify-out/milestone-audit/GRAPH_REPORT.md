# Graph Report - anchor\mobile\src\utils  (2026-07-12)

## Corpus Check
- 66 files · ~24,924 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 633 nodes · 860 edges · 72 communities (48 shown, 24 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9f496f10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]

## God Nodes (most connected - your core abstractions)
1. `generateTrueSigil` - 12 edges
2. `backfillMilestoneDates()` - 10 edges
3. `generateTrueSigil()` - 10 edges
4. `checkAndRecordMilestones()` - 9 edges
5. `isoWeekKey()` - 9 edges
6. `queueProgressionMilestonesFromStores()` - 9 edges
7. `getCurrentRank()` - 8 edges
8. `distillIntention()` - 8 edges
9. `Letter Distillation` - 8 edges
10. `normalizedScopeId()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Traditional Sigil Generation` --references--> `generateTrueSigil`  [INFERRED]
  anchor/mobile/src/utils/sigil/README.md → anchor/mobile/src/utils/sigil/traditional-generator.ts
- `EntitlementInput` --references--> `PrimingHistoryEntry`  [EXTRACTED]
  entitlements.ts → primingAnalytics.ts
- `getNormalizedProgressionSessions()` --calls--> `toProgressionLocalDateString()`  [EXTRACTED]
  progression.ts → progressionTimezone.ts
- `calculateStreak()` --calls--> `utcDay()`  [INFERRED]
  streakHelpers.ts → streak.ts
- `classifyToTierPreliminary()` --calls--> `detectCategoryFromText()`  [EXTRACTED]
  tierClassifier.ts → categoryDetection.ts

## Hyperedges (group relationships)
- **Central Entitlement Computation** — entitlements_compute_entitlements, entitlements_count_anchors_created_today, entitlements_count_anchors_created_during_trial, entitlements_count_weekly_practice_sessions, entitlements_get_entitlements [EXTRACTED 1.00]
- **Multi-Factor Milestone Recording Flow** — milestonetracking_get_dates, milestonetracking_check_and_record, milestonetracking_backfill, milestonetracking_write_dates [EXTRACTED 1.00]
- **Prime-Only Sheet Milestone Flow** — milestonetracking_get_sheet_dates, milestonetracking_check_and_record_sheet, milestonetracking_backfill_sheet, milestonetracking_write_sheet_dates [EXTRACTED 1.00]
- **Traditional Sigil Generation Pipeline** — traditional-generator_process_intent, traditional-generator_letter_to_number, traditional-generator_create_sigil_path, traditional-generator_generate_true_sigil [EXTRACTED 1.00]
- **Practice Progression Ladders** — practiceprogress-test_rank, practiceprogress-test_depth, practiceprogress-test_mark [INFERRED 0.85]
- **Milestone Persistence and Notification** — milestonetracking-test_check_record, milestonetracking-test_async_storage, milestonetracking-test_subscribe [INFERRED 0.85]

## Communities (72 total, 24 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (45): capped, entitlements, nextDay, now, sessions(), allowance, currentDate, history (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (27): getGridConfig(), GRID_REGISTRY, GridConfig, calculateStrokeWidth(), createBorder(), createSeed(), createSigilPath(), generateAllVariants() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (39): anchors, progress, sessions, AnchorPrimeStats, averageProgress(), DeepestPracticeAnchorState, DEPTH_TIERS, DepthName (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (19): activations, eightDaysAgo, lastUsed, now, result, sevenDaysAgo, sixDaysAgo, today (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (24): addDays, Central Entitlement Policy, computeEntitlements, countAnchorsCreatedDuringTrial, countAnchorsCreatedToday, countWeeklyPracticeSessions, FREE_WEEKLY_SESSION_LIMIT, getEntitlements (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (24): 11-Step Anchor Creation Flow, Austin Osman Spare Method, distillIntention, getDistillationSummary, Letter Distillation, Sigil Generation Utilities, Traditional Sigil Generation, validateIntention (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (20): coldStartedAt, distillation, intention, SAMPLE_INTENTIONS, variants, warmStartedAt, containsAlphabeticCharacter(), DISTILLATION_CACHE (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (18): createBorder(), createDecorations(), generateAbstractSigil(), generateAllVariants(), getTransform(), LETTER_VECTORS, seededRandom(), SigilGenerationResult (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (21): AsyncStorage Milestone Dates, backfillMilestoneDates, checkAndRecordMilestones, getMilestoneDates, pre-launch Milestone Sentinel, subscribeToMilestoneDates, Milestone Tracking Test Suite, getPracticeDays (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (52): index, baseKey, listener, metrics, scopeId, unsubscribe, hash32FNV1a(), stableIndex() (+44 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (9): suggestion, getForegroundLocationForPriming(), LocationPrimingAudioMode, LocationPrimingDeviceLocation, LocationPrimingPreset, LocationPrimingSessionType, LocationPrimingSuggestion, LocationPrimingZone (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (17): AsyncStorage.getItem, AsyncStorage.setItem, backfillMilestoneDates, backfillSheetMilestones, checkAndRecordMilestones, checkAndRecordSheetMilestones, getMilestoneDates, getEarnedMarkNames (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (12): avatar, avatar0, avatar1, avatar10, avatar11, avatar2, avatar9, avatarNeg1 (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.26
Nodes (11): res1, res2, res3, res4, text, analyzeIntention(), detectFutureTense(), detectGibberish() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.28
Nodes (10): buildProfileGreeting(), extractFirstName(), getHourForTimezone(), extractIanaTimezone(), formatDateFromParts(), getProgressionHourForTimezone(), getProgressionTimezoneInfo(), parseUtcOffsetMinutes() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (12): Expo Haptics impactAsync, Expo Haptics notificationAsync, Expo Haptics selectionAsync, safeHaptics.impact, safeHaptics.notification, safeHaptics.selection, logger.debug, logger.error (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.31
Nodes (9): anchor, fallbackTime, lastActivatedAt, AnchorLike, buildRecoveredChargeState(), hasAnchorPrimeHistory(), hasChargeMarkers(), isFirstPrimeForAnchor() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (9): anchors, customAnchor, mockBaseAnchor, noCategoryAnchor, result, results, CATEGORY_LABELS, redactAnchor() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (17): Algorithm (Austin Osman Spare Method), API, code:typescript (import { distillIntention } from './distillation';), code:typescript (interface DistillationResult {), code:typescript ({), code:typescript (const result = distillIntention('Close the deal');), code:bash (npm test distillation.test.ts), `distillIntention(intentionText: string): DistillationResult` (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.36
Nodes (6): firstVisit, seen, TeachingProbe(), TeachingGateContext, trackSuppressed(), useTeachingGate()

### Community 22 - "Community 22"
Cohesion: 0.38
Nodes (7): computeEntitlements, PrimingHistoryEntry Session Fixtures, Entitlements Test Suite, getPrimeSessionAllowance, Weekly Priming History Fixture, Prime Session Access Test Suite, getWeeklyPrimeUsage

### Community 23 - "Community 23"
Cohesion: 0.38
Nodes (7): Expo Location getCurrentPositionAsync, getForegroundLocationForPriming, Expo Location getLastKnownPositionAsync, Expo Location getForegroundPermissionsAsync, requestCurrentLocationForPriming, Expo Location requestForegroundPermissionsAsync, Expo Location hasServicesEnabledAsync

### Community 24 - "Community 24"
Cohesion: 0.38
Nodes (5): baseInput, input, result, generateWeeklyInsight(), WeeklyInsightInput

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (6): buildRecoveredChargeState, Charge State Recovery, hasAnchorPrimeHistory, hasChargeMarkers, isFirstPrimeForAnchor, needsChargeStateBackfill

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (6): analyzeIntention, detectFutureTense, detectGibberish, getGuidanceText, detectNegation, Intention Patterns Test Suite

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (6): analyzeIntention, detectFutureTense, detectGibberish, detectNegation, getGuidanceText, lastAnalyzedText

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (6): AsyncStorage.getItem, AsyncStorage.setItem, isPostPrimeTraceEligible, markPostPrimeTraceAttemptStarted, parseStoredDate, Settings Store getState

### Community 29 - "Community 29"
Cohesion: 0.53
Nodes (4): BALANCED_VECTORS, DENSE_VECTORS, MINIMAL_VECTORS, keys

### Community 30 - "Community 30"
Cohesion: 0.47
Nodes (4): CATEGORY_KEYWORDS, detectCategoryFromText(), ClassificationResult, classifyToTierPreliminary()

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (5): buildRecoveredChargeState, hasAnchorPrimeHistory, isFirstPrimeForAnchor, needsChargeStateBackfill, anchorPriming Test Suite

### Community 32 - "Community 32"
Cohesion: 0.70
Nodes (3): isPostPrimeTraceEligible(), markPostPrimeTraceAttemptStarted(), parseStoredDate()

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (4): createDeveloperMasterUser, isDeveloperMasterAccountEnabled, Developer Master Account, Developer Master Account ID

### Community 36 - "Community 36"
Cohesion: 0.50
Nodes (4): Expo Location Services and Permissions, getForegroundLocationForPriming, matchLocationPrimingZone, Location Priming Resolver Test Suite

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (4): debugLoggingEnabled, logger.info, useSettingsStore, Logger Test Suite

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (4): isPostPrimeTraceEligible, markPostPrimeTraceAttemptStarted, AsyncStorage Trace Attempt Timestamp, Post-Prime Trace Eligibility Test Suite

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (4): Privacy Category Labels, Privacy-Safe Anchor Redaction, redactAnchor, redactAnchors

### Community 40 - "Community 40"
Cohesion: 0.50
Nodes (4): useTeachingGate, TeachingProbe, useTeachingStore, useTeachingGate Test Suite

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): calculateThreadDecay(), DECAY_START_DAY, getThreadDecayStartDay()

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): getAvatarByIndex, getDefaultAvatar, avatarUtils Test Suite

### Community 44 - "Community 44"
Cohesion: 1.00
Nodes (3): Default Avatar Pool, getAvatarByIndex, getDefaultAvatar

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (3): hash32FNV1a, stableIndex, Hash Utility Test Suites

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (3): isCompactPhoneViewport, isShortPhoneViewport, Layout Viewport Test Suite

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (3): redactAnchor, redactAnchors, Privacy Helpers Test Suite

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (3): generateWeeklyInsight, Weekly Insight Priority Rules, Weekly Insight Test Suite

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (3): reviewsPreviousWeekWindow, Weekly Review Window Test Suites, isWithinWeeklyReviewWindow

## Knowledge Gaps
- **258 isolated node(s):** `AnchorLike`, `DEFAULT_AVATARS`, `CATEGORY_KEYWORDS`, `screen`, `pixelRatio` (+253 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logger` connect `Community 1` to `Community 9`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `distillIntention()` connect `Community 6` to `Community 7`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `PrimingHistoryEntry` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `generateTrueSigil` (e.g. with `Traditional Sigil Generation` and `Deterministic Hand-Drawn SVG`) actually correct?**
  _`generateTrueSigil` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AnchorLike`, `DEFAULT_AVATARS`, `CATEGORY_KEYWORDS` to the rest of the system?**
  _267 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05909090909090909 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._