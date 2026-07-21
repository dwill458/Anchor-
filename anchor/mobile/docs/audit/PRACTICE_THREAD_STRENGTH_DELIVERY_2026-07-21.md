# Practice + Thread Strength delivery report

Date: 2026-07-21

## 1. Implementation summary

The Practice home and Thread Strength detail experience now read from one account-scoped canonical practice ledger. Deep Prime, Visualize, Focus Session, and Release completion paths create durable, idempotent records; the same normalized records feed UI metrics, notification decisions, widgets, restoration, and backend export. The supplied `Practice Screen.html` and `Thread Strength.html` were used as visual-direction references while preserving the existing React Native navigation, theme, accessibility, and product behavior.

## 2. Screens and components changed

- Rebuilt `PracticeScreen` hierarchy with the current-anchor control, today goal, weekly activity, mode actions, and Thread Strength entry.
- Added `ThreadStrengthDetailScreen`, `PracticeOverviewCard`, and `PracticeModeRow`.
- Added the detail route to `PracticeStackNavigator` and exported it through the practice screen barrel.
- Aligned completion treatments across Deep Prime, Visualize, Focus, and Release, including reduced-motion behavior.
- Preserved the app's established Cinzel/Crimson Pro typography, dark field, gold linework, anchor imagery, and navigation conventions from the supplied prototypes.

## 3. Canonical data model

`PracticeSessionRecord` / backend `PracticeSession` carries: stable event ID, account owner, optional anchor ID plus local/server snapshots, exact canonical mode, planned and completed duration, completed status, start/completion UTC instants, completion-local date, IANA time zone, completion UTC offset, completion source, schema version, legacy type, audio settings, visualization scene snapshot, next action, client version, metadata, and client sync state. The database indexes owner/time, owner/mode, and owner/anchor.

## 4. Canonical mode aliases

- `deep_prime`: deep prime spellings plus `prime`, `priming`, `charge`, `charged`, `reinforce`, and `reinforcement`.
- `visualize`: `visualize`, `visualization`, and `visualisation`.
- `focus`: focus spellings plus `activate`, `activation`, `quickactivate`, and `quick_activation`.
- `release`: `release`, `released`, `burn`, `burned`, and `burning`.

Only `deep_prime | visualize | focus | release` enters metrics. Unrecognized legacy values are retained as diagnostic history and excluded from totals rather than silently misclassified.

## 5. Migration and restoration

- Added Prisma migration `20260721000000_canonical_practice_ledger` and schema relations.
- Backfills canonical sessions from live activations, charges, and valid burned-anchor JSON histories.
- Creates Release records from released/burned anchors and retains nullable anchor snapshots after deletion.
- Uses deterministic legacy-derived IDs and conflict-safe inserts, so rerunning the migration does not duplicate events.
- Hydration merges canonical export history with legacy rows, restores released history, binds it to the authenticated account, normalizes aliases, and records a once-per-app-session migration completed/failed analytic.
- Local persisted state moved to schema version 5 with owner binding and unknown-history diagnostics.

## 6. Thread Strength formula

- Empty-ledger baseline: 50.
- Session gains: Deep Prime +40, Visualize +40, Focus +25, Release +25, capped at 100.
- Missed eligible days use the existing sensitivity policy: decay begins on day 3 lenient, day 2 balanced, or day 1 strict; the first penalty is 30 and each later eligible day adds 15.
- Configured rest weekdays do not decay the score. Decay floors at 5.
- Events are sorted deterministically by completion instant then ID, deduplicated by event ID, account-filtered, and future timestamps beyond five minutes are excluded.
- Session breakdown percentages use largest-remainder rounding and always sum to 100 when history exists. Dominant-mode ties resolve by latest completion and then canonical mode order.

## 7. Release treatment

Release is a full canonical session mode, contributes +25 to Thread Strength, appears in counts/breakdown/heatmap, and remains part of lifetime history after its anchor is removed. The stable Release event is durably queued before the destructive server burn call. If burn fails or the device is offline, the UI does not pretend deletion succeeded; the queued event survives for retry without allowing old anchor state to resurrect.

## 8. Date, time-zone, and day-boundary policy

`completedAt` is stored in UTC. `localDateKey`, IANA `timeZone`, and `utcOffsetMinutesAtCompletion` are captured at completion and validated by the API against the instant. Daily goals, streak-style day grouping, current week, and the 22-week heatmap use the captured local day, so travel and daylight-saving changes do not retroactively move sessions. Invalid time zones use an internally consistent UTC fallback.

## 9. Canonical colors

- Deep Prime: `#D4AF37`, bright `#F0CB6A`.
- Visualize: `#78B4D1`.
- Focus Session: `#AD99D2`.
- Release: `#C8875A`.

These mappings are shared by the mobile mode rows, heatmap, Android widgets, and iOS widget. The violet family is reserved for Focus; Deep Prime remains gold.

## 10. Downstream consumers

- Practice home metrics and Thread Strength detail.
- Daily completion goals and current-week status.
- 22-week Monday-through-Sunday heatmap.
- Notification rules and practice-completion controller.
- Android small/medium/large widget data and dominant-mode color treatment.
- iOS widget snapshot decoding and four-mode heat colors.
- Account export/restoration and released-anchor lifetime history.

## 11. Analytics

Added or standardized events for practice-mode selection, current-anchor change, Thread Strength opening, completion queued/synced/failed, duplicate prevention, and practice-data migration completed/failed. Completion events carry canonical mode, source, event ID, account/anchor presence, duration, and sync outcome without placing intention text or other user content in analytics.

## 12. Tests added or updated

- Canonical normalization, owner isolation, idempotency, offline queue/retry, duplicate handling, and sync failure behavior.
- Restoration/migration and canonical/legacy merging.
- Release-before-delete ordering and persistence.
- Metrics: empty/single/multi-mode history, largest-remainder percentages, deterministic ties, released-anchor history, future-event exclusion, heatmap calendar alignment, local dates, daily goal, decay, and rest days.
- Practice screen navigation/current-anchor behavior and widget rendering.
- Backend validation: ownership, idempotency conflict semantics, canonical modes, time zone, local date, and exact completion offset.

## 13. Verification results

- Mobile TypeScript: `npx tsc --noEmit` passed.
- Mobile Jest: 128/128 suites passed; 1,055 passed, 1 skipped, 1,056 total.
- Final focused mobile regression: 4/4 suites, 21/21 tests passed.
- Backend TypeScript: `npx tsc --noEmit` passed.
- Backend Jest: 19/19 suites, 328/328 tests passed.
- Prisma schema validation passed.
- Changed backend practice route passes ESLint; whole-backend lint still reports pre-existing formatting findings in unrelated files.
- `git diff --check` passed apart from Git's existing Swift LF-to-CRLF warning.
- Source secret-pattern scan found no committed API-key/private-key patterns in the implementation.

## 14. Assumptions

- Existing product Thread Strength weighting and decay policy are authoritative; this work unifies their inputs rather than inventing a second scoring system.
- Daily practice goal remains the user's settings value (default 3, valid 1–20).
- Monday is the first weekday for both the weekly strip and heatmap.
- Legacy Stabilize product code remains available outside the four-mode canonical metrics for backward compatibility.
- Guest first-prime history remains encrypted locally and is owner-bound during authenticated migration.

## 15. Known limitations and security debt

- The SQL migration was validated but intentionally not executed against a live production database from this workspace; deploy it through the normal database release process with a backup and row-count review.
- iOS widget code received static/type-shape review only because Swift compilation is unavailable on Windows.
- Production dependency audits currently report existing transitive findings: mobile 38 total (1 low, 20 moderate, 13 high, 4 critical); backend 52 total (1 low, 39 moderate, 9 high, 3 critical). No forced dependency upgrades were made because that would be a separate, potentially breaking remediation effort.
- Server burn is deliberately non-optimistic: an offline Release event is retained, but anchor deletion waits for server confirmation.

## 16. Unsafe or impossible backfill cases

Historical legacy rows did not record the user's IANA zone or offset. The migration therefore marks their calendar date using the stored UTC instant; exact historical local-day reconstruction is impossible without inventing data. Invalid burned-history JSON is skipped by the SQL backfill rather than aborting migration. Client-side unknown types are preserved in diagnostics and excluded from canonical metrics. These cases should be compared by owner and source-row counts during rollout.

## 17. Screenshots and visual QA

No simulator screenshots are attached. The supplied HTML references were reviewed, but the local Expo web build reaches an existing `import.meta`-in-classic-bundle runtime failure and the available Android AVD stayed unauthorized to ADB even with a cold boot. The temporary server, emulator, logs, and browser tabs were closed. Because neither path produced the actual React Native screen, prototype images were not mislabeled as implementation screenshots. Capture phone and small-phone screenshots in the release CI/device environment before store submission.
