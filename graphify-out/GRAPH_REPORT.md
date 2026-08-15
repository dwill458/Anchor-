# Graph Report - E:\Projects\Anchor\anchor\mobile\src\screens\settings  (2026-08-13)

## Corpus Check
- Corpus is ~10,988 words - fits in a single context window. You may not need a graph.

## Summary
- 88 nodes · 116 edges · 7 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6

## God Nodes (most connected - your core abstractions)
1. `SettingsScreen()` - 8 edges
2. `SessionDefaultsScreen()` - 4 edges
3. `SETTINGS_SCREEN_BACKGROUND` - 4 edges
4. `SETTINGS_MUTED_TEXT` - 4 edges
5. `DailyPracticeGoalScreen()` - 3 edges
6. `DefaultFocusModeScreen()` - 3 edges
7. `formatHourLabel()` - 3 edges
8. `formatTimeLabel()` - 3 edges
9. `formatHapticFeedbackLabel()` - 3 edges
10. `clampCustomGoal()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `SettingsScreen()` --calls--> `formatHapticFeedbackLabel()`  [EXTRACTED]
  SettingsScreen.tsx → shared.ts

## Import Cycles
- None detected.

## Communities (7 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (14): clampFocus(), DefaultFocusModeScreen(), FOCUS_PRESETS, styles, HapticFeedbackScreen(), styles, styles, formatFocusModeLabel() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (15): mockAuthStoreState, mockFetchProfile, mockNavigate, mockNotifState, mockRequestPermissions, mockResetSettings, mockRestorePurchases, mockSettings (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (10): clampPrimeMinutes(), FOCUS_DURATION_OPTIONS, FocusDurationOption, PRIME_DURATION_OPTIONS, PrimeDurationOption, resolveInitialPrimeSelection(), SessionDefaultsScreen(), SessionTab (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.23
Nodes (10): ConfirmationKind, formatHourLabel(), formatMotionLabel(), formatTimeLabel(), PickerKind, restorePurchases(), SettingsScreen(), styles (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (8): LicenseItem, LICENSES, LicensesScreen(), rawData, styles, DAY_LABELS, RestDaysScreen(), styles

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (6): BAR_COLORS, DOT_COLORS, styles, ThreadStrengthScreen(), VISUALS, VisualTone

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (4): clampCustomGoal(), DailyPracticeGoalScreen(), GoalSelection, styles

## Knowledge Gaps
- **43 isolated node(s):** `GoalSelection`, `styles`, `styles`, `styles`, `LicenseItem` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SettingsScreen()` connect `Community 3` to `Community 1`, `Community 4`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `GoalSelection`, `styles`, `styles` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._