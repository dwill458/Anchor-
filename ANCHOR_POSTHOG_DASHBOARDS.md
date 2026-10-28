# Anchor 2.0 — Activation, Retention, Churn Definitions & PostHog Dashboards

**Target Release**: October 31, 2026  
**Event Schema**: See [`ANCHOR_ANALYTICS_EVENT_CATALOG.md`](file:///e:/Projects/Anchor/ANCHOR_ANALYTICS_EVENT_CATALOG.md)

---

## Part 1: Canonical Metric Definitions (Phase 4)

### 1. Activation Metrics

#### Primary Activation (`activated_primary_24h`)
- **Definition**: A new user who completes both **`first_anchor_created`** and **`practice_completed`** (where `practice_mode IN ('focus', 'deep_prime', 'visualize')`) within **24 hours** (`<= 86,400 seconds`) of their first session event (`onboarding_started` or first `app_opened`).
- **Cohort Entry**: First occurrence of `onboarding_started` (or first `app_opened` if `onboarding_started` was skipped via restore).
- **Identity Continuity**: Evaluated across merged PostHog person profiles (anonymous `distinct_id` -> authenticated `user_id` via `posthog.identify()`), and deduplicated via `AnalyticsService.trackFirstAnchorCreatedOnce()`.

#### Secondary Activation (`activated_secondary_7d`)
- **Definition**: A user who records **`practice_completed`** on **at least 2 distinct local calendar days** (`distinct count(local_date_key) >= 2`) within their first **7 days** (`<= 168 hours` from cohort entry).
- **Why Local Date Key**: Uses the session's `local_date_key` (`YYYY-MM-DD` in the user's local timezone from [`PracticeCompletionService`](file:///e:/Projects/Anchor/anchor/mobile/src/services/PracticeCompletionService.ts)) so midnight UTC boundaries do not artificially split or merge a user's local days.

#### Canonical 5-Stage Activation Funnel
| Stage | Event Name | Filter / Property Condition | Conversion Question Answered |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `onboarding_started` | None | Baseline new-user cohort entering Anchor 2.0 |
| **Stage 2** | `intention_submitted` | None | Do users formulate and submit a personal intention? |
| **Stage 3** | `first_anchor_created` | Deduplicated once per person | Do users survive AI generation, variation choice, and seal? |
| **Stage 4** | `practice_started` | `practice_mode IN ('focus', 'deep_prime', 'visualize')` | Do new Anchor creators initiate their first Practice session? |
| **Stage 5** | `practice_completed` | `completion_status = 'completed'` | Do users finish their first Practice session and earn initial Thread Strength? |

---

### 2. Retention Definitions

All return-to-practice retention metrics use **Cohort Day 0 (`D0`)** = the calendar date of the user's first `first_anchor_created` event (or first `onboarding_started` for top-of-funnel retention).

| Metric | Definition | PostHog Configuration |
| :--- | :--- | :--- |
| **D1 Return-to-Practice Retention** | % of users who created their first Anchor on `D0` and fired `practice_completed` on `D0 + 1 calendar day` (`local_date_key`). | Retention Insight: Cohort event = `first_anchor_created`, Return event = `practice_completed`, Interval = `Day`, Offset = `Day 1` |
| **D3 Return-to-Practice Retention** | % of users who fired `practice_completed` on `D0 + 3 calendar days` (and Unbounded/Rolling D3: practiced on any day in `[D1..D3]`). | Retention Insight: Day 3 (track both strict Day 3 and Rolling 3-Day return) |
| **D7 Return-to-Practice Retention** | % of users who fired `practice_completed` on `D0 + 7 calendar days` (plus Week 1 Rolling return). | Retention Insight: Day 7 |
| **D14 Return-to-Practice Retention** | % of users who fired `practice_completed` on `D0 + 14 calendar days`. | Retention Insight: Day 14 |
| **Weekly Active Practitioners (WAP)** | Distinct users with `>= 1` `practice_completed` event (`practice_mode != 'release'`) in a trailing 7-day window. | Trends Insight: `practice_completed` -> Unique Users -> Weekly |
| **Practice Days per Week** | Distribution (median, P75, P90) of distinct `local_date_key` values per active practitioner per 7-day window. | HogQL: `SELECT person_id, count(DISTINCT properties.local_date_key) AS practice_days FROM events WHERE event = 'practice_completed' AND timestamp >= now() - INTERVAL 7 DAY GROUP BY person_id` |
| **Rest Day-Adjusted Consistency** | Anchor allows configured Rest Days so nonconsecutive practice does not penalize Thread Strength. Consistency is measured as `practice_days_in_week / target_active_days` (default `>= 3 days/week` = consistent practitioner) rather than raw consecutive-day streaks. | Segmented into **Consistent Non-Consecutive** (`>= 3 days/wk`, gap `<= 2 days`) vs **Consecutive** (`>= 5 days/wk`) vs **Sporadic** (`1–2 days/wk`). |
| **Feature Adoption by Retention Cohort** | Compares D7 and D14 retention across adopters of `vision_board_saved`, `chart_approved`, `one_move_completed`, and `reminder_enabled` **controlling for early practice frequency** (to avoid survivorship bias). | Breakdown by cohort adoption within first 48h vs D7 retention |

---

### 3. Inactivity vs. Subscription Churn Definitions

To prevent conflating funnel drop-off, temporary rest days, and billing churn, Anchor 2.0 separates disengagement into three orthogonal states:

1. **Funnel Abandonment (Not Churn)**:
   - User triggers `onboarding_abandoned`, `practice_abandoned`, `visualize_abandoned`, or `paywall_dismissed` within a single session.
2. **Practitioner Inactivity (Behavioral Lapse / Dormancy)**:
   - **At-Risk Practitioner**: Previously active user (`>= 1` `practice_completed`) with `0` `practice_completed` events in the trailing **5 days** (exceeding normal Rest Day allowance).
   - **Dormant User**: Previously activated user with `0` `practice_completed` events in the trailing **14 days**.
3. **Subscription / Trial Churn (Financial Lifecycle)**:
   - **Trial Cancellation (`trial_cancelled`)**: User turns off auto-renew during the 7-day free trial (authoritative via RevenueCat webhook; user retains Pro entitlement until Day 7 expiration).
   - **Paid Subscription Cancellation (`subscription_cancelled`)**: Paid subscriber cancels auto-renewal (authoritative via RevenueCat).
   - **Entitlement Expiration (`subscription_expired`)**: Trial or paid billing period ends without renewal (`subscription_tier` transitions to `'expired'`).

---

## Part 2: Reproducible PostHog Dashboards (Step 3 — Priority Launch Dashboards)

> [!IMPORTANT]
> **Global Filter & Alias Deduplication Rules for All Dashboards**:
> 1. **Production Environment Filter**: Apply dashboard-level filters `properties.environment = 'production'` AND `properties.is_sandbox = false`.
> 2. **Sandbox Purchase Exclusion**: On monetization/paywall tiles, additionally filter `properties.is_sandbox_purchase != true` (or `properties.store_environment != 'sandbox'`) so TestFlight and App Store / Play Store sandbox receipts (`CustomerInfo.entitlements.active[id].isSandbox === true`) never inflate production conversion rates even in release builds (`__DEV__ === false`).
> 3. **Canonical vs. Legacy Alias Rule (Zero Double-Counting)**: Always query **only** the canonical Anchor 2.0 event name (e.g., `practice_started`, `practice_completed`, `vision_generation_started`, `vision_board_saved`, `chart_planning_started`, `chart_generated`, `chart_approved`, `one_move_completed`, `waypoint_reached`, `teaching_shown`, `teaching_dismissed`) in funnels and trends. Never combine a canonical event and its 1.5 legacy alias (`practice_session_started`, `vision_image_generation_started`, `chart_created`, etc.) with `OR` in the same series.

### Priority Launch Dashboard 1: First-Day Activation & Onboarding Funnel (`anchor-2-p1-activation-onboarding`)
- **Covers**: Dashboard 1 (Tiles 1.1–1.3) + Dashboard 2 (Tiles 2.1–2.6) + Tile 3.1 (`first_anchor_created` -> `practice_mode_viewed` -> `practice_started` -> `practice_completed`).
- **Reproducible PostHog Funnel JSON Specification**:
```json
{
  "name": "Anchor 2.0 — First-Day Activation & Onboarding Funnel",
  "filters": {
    "insight": "FUNNELS",
    "funnel_viz_type": "steps",
    "funnel_window_interval": 24,
    "funnel_window_interval_unit": "hour",
    "properties": [
      { "key": "environment", "value": "production", "operator": "exact", "type": "event" },
      { "key": "is_sandbox", "value": false, "operator": "exact", "type": "event" }
    ],
    "events": [
      { "id": "onboarding_started", "name": "1. Onboarding Started", "type": "events", "order": 0 },
      { "id": "intention_submitted", "name": "2. Intention Submitted", "type": "events", "order": 1 },
      { "id": "anchor_generation_started", "name": "3. AI Generation Started", "type": "events", "order": 2 },
      { "id": "anchor_generation_completed", "name": "4. AI Generation Completed", "type": "events", "order": 3 },
      { "id": "first_anchor_created", "name": "5. First Anchor Created (Deduped)", "type": "events", "order": 4 },
      { "id": "practice_started", "name": "6. First Practice Started", "type": "events", "order": 5 },
      { "id": "practice_completed", "name": "7. First Practice Completed", "type": "events", "order": 6 }
    ],
    "breakdown": "platform",
    "breakdown_type": "event"
  }
}
```

### Priority Launch Dashboard 2: Feature Friction Across Practice, Vision, and Chart (`anchor-2-p1-feature-friction`)
- **Covers**: Dashboard 3 (Tiles 3.1–3.5) + Dashboard 4 (Tiles 4.1–4.6).
- **Reproducible PostHog Feature Friction HogQL Query (Practice, Vision, Visualize & Chart Drop-Off / Error Summary)**:
```sql
SELECT
  feature_domain,
  started_users,
  completed_users,
  abandoned_or_failed_users,
  round(completed_users * 100.0 / nullIf(started_users, 0), 2) AS completion_rate_pct
FROM (
  SELECT
    'Practice (All Modes)' AS feature_domain,
     uniqExactIf(person_id, event = 'practice_started') AS started_users,
     uniqExactIf(person_id, event = 'practice_completed') AS completed_users,
     uniqExactIf(person_id, event IN ('practice_abandoned', 'practice_failed')) AS abandoned_or_failed_users
  FROM events
  WHERE timestamp >= now() - INTERVAL 7 DAY
    AND properties.environment = 'production'
    AND properties.is_sandbox = false
  UNION ALL
  SELECT
    'Vision Board Creation' AS feature_domain,
    uniqExactIf(person_id, event = 'vision_generation_started') AS started_users,
    uniqExactIf(person_id, event = 'vision_board_saved') AS completed_users,
    uniqExactIf(person_id, event = 'vision_generation_failed') AS abandoned_or_failed_users
  FROM events
  WHERE timestamp >= now() - INTERVAL 7 DAY
    AND properties.environment = 'production'
    AND properties.is_sandbox = false
  UNION ALL
  SELECT
    'Guided Visualize' AS feature_domain,
    uniqExactIf(person_id, event = 'visualize_started') AS started_users,
    uniqExactIf(person_id, event = 'visualize_completed') AS completed_users,
    uniqExactIf(person_id, event = 'visualize_abandoned') AS abandoned_or_failed_users
  FROM events
  WHERE timestamp >= now() - INTERVAL 7 DAY
    AND properties.environment = 'production'
    AND properties.is_sandbox = false
  UNION ALL
  SELECT
    'Chart Planning & Execution' AS feature_domain,
    uniqExactIf(person_id, event = 'chart_planning_started') AS started_users,
    uniqExactIf(person_id, event = 'one_move_completed') AS completed_users,
    uniqExactIf(person_id, event = 'chart_generation_failed') AS abandoned_or_failed_users
  FROM events
  WHERE timestamp >= now() - INTERVAL 7 DAY
    AND properties.environment = 'production'
    AND properties.is_sandbox = false
)
```

### Priority Launch Dashboard 3: Premium Feature Attempts, Paywall Conversion & RevenueCat Subscription Outcomes (`anchor-2-p1-monetization-revenuecat`)
- **Covers**: Dashboard 5 (Tiles 5.1–5.6).
- **Reproducible PostHog Funnel JSON Specification (Sandbox-Excluded)**:
```json
{
  "name": "Anchor 2.0 — Premium Attempts to Paywall & Trial/Paid Conversion",
  "filters": {
    "insight": "FUNNELS",
    "funnel_viz_type": "steps",
    "funnel_window_interval": 7,
    "funnel_window_interval_unit": "day",
    "properties": [
      { "key": "environment", "value": "production", "operator": "exact", "type": "event" },
      { "key": "is_sandbox", "value": false, "operator": "exact", "type": "event" },
      { "key": "is_sandbox_purchase", "value": true, "operator": "is_not", "type": "event" }
    ],
    "events": [
      { "id": "premium_feature_attempted", "name": "1. Premium Feature Attempted", "type": "events", "order": 0 },
      { "id": "paywall_viewed", "name": "2. Paywall Step 1 Viewed", "type": "events", "order": 1 },
      {
        "id": "paywall_page_viewed",
        "name": "3. Paywall Step 2 (Plans) Viewed",
        "type": "events",
        "order": 2,
        "properties": [{ "key": "step", "value": 2, "operator": "exact", "type": "event" }]
      },
      { "id": "paywall_plan_selected", "name": "4. Plan Selected", "type": "events", "order": 3 },
      { "id": "purchase_started", "name": "5. Store Checkout Started", "type": "events", "order": 4 },
      { "id": "paywall_converted", "name": "6. Trial Started or Paid Purchase", "type": "events", "order": 5 }
    ],
    "breakdown": "context",
    "breakdown_type": "event"
  }
}
```

---

### Dashboard 1: Executive Launch Health (`anchor-2-executive-launch-health`)

**Purpose**: Daily command center for the October 31, 2026 release—tracks DAU, WAP, Primary/Secondary Activation, Trial & Paid Conversion, and Technical Reliability.

| Tile # | Tile Name | Insight Type | Events / HogQL | Breakdown / Filters |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Daily Active Users (DAU) & Weekly Active Practitioners (WAP) | Trends (Dual Series) | Series A: `app_opened` (Unique Users)<br>Series B: `practice_completed` (Unique Users, `practice_mode != 'release'`) | Breakdown: `platform`, `experience_version` (`'2.0'`) |
| **1.2** | Primary Activation Rate (24h) | Funnel | 1. `onboarding_started`<br>2. `intention_submitted`<br>3. `first_anchor_created`<br>4. `practice_started`<br>5. `practice_completed` | Conversion Window: `24 Hours`<br>Breakdown: `platform`, `account_state` |
| **1.3** | Secondary Activation Rate (2+ Practice Days in 7d) | HogQL Number / Trend | See HogQL Query 1.3 below | Cohort: Users with `onboarding_started` in last 14d |
| **1.4** | D1 / D3 / D7 / D14 Return-to-Practice Retention | Retention | Cohort: `first_anchor_created`<br>Return: `practice_completed` | Interval: `Day` (D1, D3, D7, D14)<br>Breakdown: `subscription_tier` |
| **1.5** | Paywall -> Trial -> Paid Conversion Summary | Funnel | 1. `paywall_viewed`<br>2. `paywall_page_viewed` (`step = 2`)<br>3. `purchase_started`<br>4. `trial_started` OR `paywall_converted` (`outcome = 'purchased'`) | Conversion Window: `7 Days`<br>Breakdown: `context` |
| **1.6** | Technical Failure & Crash-Free Operations Rate | Trends | Series A: `anchor_generation_failed`<br>Series B: `vision_generation_failed`<br>Series C: `chart_generation_failed`<br>Series D: `practice_failed`<br>Series E: `api_request_failed` | Display: % of total starts per flow |

**HogQL Query 1.3 — Secondary Activation Rate (2+ Distinct Practice Days in First 7 Days)**:
```sql
WITH cohort AS (
  SELECT
    person_id,
    min(timestamp) AS first_seen_at
  FROM events
  WHERE event = 'onboarding_started'
    AND timestamp >= now() - INTERVAL 14 DAY
    AND timestamp <= now() - INTERVAL 7 DAY
  GROUP BY person_id
),
practice_days AS (
  SELECT
    c.person_id,
    count(DISTINCT e.properties.local_date_key) AS active_days_7d
  FROM cohort c
  LEFT JOIN events e
    ON e.person_id = c.person_id
    AND e.event = 'practice_completed'
    AND e.timestamp >= c.first_seen_at
    AND e.timestamp <= c.first_seen_at + INTERVAL 7 DAY
  GROUP BY c.person_id
)
SELECT
  count() AS cohort_size,
  countIf(active_days_7d >= 2) AS activated_secondary_users,
  round(countIf(active_days_7d >= 2) * 100.0 / nullIf(count(), 0), 2) AS secondary_activation_pct
FROM practice_days
```

---

### Dashboard 2: Onboarding & First Anchor (`anchor-2-onboarding-first-anchor`)

**Purpose**: Answers Questions #1 ("Where do users abandon onboarding?") and #2 ("How many users successfully create their first Anchor?").

| Tile # | Tile Name | Insight Type | Events / HogQL | Breakdown / Filters |
| :--- | :--- | :--- | :--- | :--- |
| **2.1** | Step-by-Step Onboarding Funnel | Funnel | 1. `onboarding_started`<br>2. `onboarding_step_viewed` (`step_id = 'focus_area'`)<br>3. `intention_submitted`<br>4. `anchor_generation_started`<br>5. `anchor_generation_completed`<br>6. `anchor_variations_presented`<br>7. `anchor_selected`<br>8. `first_anchor_created` | Conversion Window: `1 Hour`<br>Breakdown: `platform` |
| **2.2** | Onboarding Abandonment by Step | Trends (Bar) | `onboarding_abandoned` | Breakdown: `step_id`, `exit_reason` |
| **2.3** | AI Anchor Generation Latency (P50 / P90 / P99) & Retry Rate | Trends | `anchor_generation_completed` (`math: p50, p90, p99` on `duration_ms`) | Breakdown: `style_choice`, `attempt` |
| **2.4** | AI Generation Failure Rate & Two-Variation Delivery | Trends | Series A: `anchor_generation_completed` (`received_two_variations = true`)<br>Series B: `anchor_generation_completed` (`received_two_variations = false`)<br>Series C: `anchor_generation_failed` | Breakdown: `failure_category` |
| **2.5** | Account Save Prompt: Created vs. Skipped (Guest) | Funnel / Pie | 1. `account_save_prompt_viewed`<br>2a. `account_created` (`source = 'onboarding_save'`)<br>2b. `account_save_skipped` | Breakdown: `method` (`apple`, `google`, `email`, `guest`) |
| **2.6** | Guest-to-Registered Deferred Conversion | Funnel | 1. `account_save_skipped`<br>2. `account_created` | Conversion Window: `14 Days` |

---

### Dashboard 3: Practice & Retention (`anchor-2-practice-retention`)

**Purpose**: Answers Questions #3 ("What prevents users from completing their first Practice?"), #4 ("Which features encourage users to return?"), #9 ("Free vs Trial vs Pro engagement"), and #10 ("Retained vs Churned users").

| Tile # | Tile Name | Insight Type | Events / HogQL | Breakdown / Filters |
| :--- | :--- | :--- | :--- | :--- |
| **3.1** | First Anchor -> First Practice Completion Funnel | Funnel | 1. `first_anchor_created`<br>2. `practice_mode_viewed`<br>3. `practice_started`<br>4. `practice_completed` | Conversion Window: `24 Hours`<br>Breakdown: `practice_mode` |
| **3.2** | Practice Completion vs. Abandonment vs. Failure by Mode | Trends (Stacked Bar) | Series A: `practice_completed`<br>Series B: `practice_abandoned`<br>Series C: `practice_failed` | Breakdown: `practice_mode` (`focus`, `deep_prime`, `visualize`), `exit_reason` |
| **3.3** | Practice Engagement by Subscription Tier | Trends | `practice_completed` (Events per Active User) | Breakdown: `subscription_tier` (`free`, `trial`, `pro`, `expired`) |
| **3.4** | Thread Strength Progression & Milestones Earned | Trends | Series A: `thread_strength_changed` (`avg(strength_delta)`)<br>Series B: `milestone_earned` (Total count) | Breakdown: `milestone_type` |
| **3.5** | Teaching Prompts & Reminder Impact on Return Practice | Funnel | 1. `teaching_shown` / `reminder_enabled` / `notification_opened`<br>2. `practice_completed` | Conversion Window: `24 Hours`<br>Breakdown: `teaching_id`, `category` |
| **3.6** | Anchor Release Outcomes (`complete` vs `let_go` vs `evolve`) | Trends (Pie) | `release_completed` | Breakdown: `reason`, `has_successor` |

---

### Dashboard 4: Vision & Chart Adoption (`anchor-2-vision-chart-adoption`)

**Purpose**: Answers Question #5 ("Where do users struggle with Vision and Chart?").

| Tile # | Tile Name | Insight Type | Events / HogQL | Breakdown / Filters |
| :--- | :--- | :--- | :--- | :--- |
| **4.1** | Vision Creation & Board Save Funnel | Funnel | 1. `vision_opened`<br>2. `vision_generation_started` OR `vision_photo_added`<br>3. `vision_generation_completed`<br>4. `vision_image_selected`<br>5. `vision_board_saved` | Conversion Window: `1 Day`<br>Breakdown: `path` (`words`, `photo`, `own_photo`) |
| **4.2** | Vision AI Generation Latency & Failure Breakdown | Trends | Series A: `vision_generation_completed` (`p50/p90 duration_ms`)<br>Series B: `vision_generation_failed` | Breakdown: `error_code` |
| **4.3** | Visualize Session Completion vs. Early Exit by Duration Preset | Funnel | 1. `visualize_started`<br>2. `visualize_completed` (vs `visualize_abandoned`) | Breakdown: `duration_seconds` (`60`, `180`, `600`) |
| **4.4** | Chart Planning -> Approval -> Real-World Move Funnel | Funnel | 1. `chart_opened`<br>2. `chart_planning_started`<br>3. `chart_generated`<br>4. `chart_approved`<br>5. `one_move_opened`<br>6. `one_move_completed`<br>7. `waypoint_reached` | Conversion Window: `14 Days`<br>Breakdown: `hasVision` |
| **4.5** | Chart Generation Failures & Route Adjustment Reasons | Trends | Series A: `chart_generation_failed` (by `kind`)<br>Series B: `chart_adjustment_requested` (by `reason`, `stage`) | Breakdown: `kind` / `reason` |
| **4.6** | Ask Chart Usage & Proposal Application | Funnel | 1. `ask_chart_opened`<br>2. `ask_chart_message_sent`<br>3. `chat_proposal_shown`<br>4. `chart_adjustment_requested` / `chart_move_created` | Breakdown: `skill` (`FREE`, `BREAK_DOWN_MOVE`, `UNSTICK`, `ADJUST_ROUTE`) |

---

### Dashboard 5: Monetization & Paywall (`anchor-2-monetization-paywall`)

**Purpose**: Answers Question #6 ("Which premium features drive trial and subscription conversion?").

| Tile # | Tile Name | Insight Type | Events / HogQL | Breakdown / Filters |
| :--- | :--- | :--- | :--- | :--- |
| **5.1** | Two-Step Paywall Conversion Funnel by Trigger Context | Funnel | 1. `premium_feature_attempted`<br>2. `paywall_viewed`<br>3. `paywall_page_viewed` (`step = 2`)<br>4. `paywall_cta_tapped`<br>5. `purchase_started`<br>6. `trial_started` OR `paywall_converted` (`outcome = 'purchased'`) | Breakdown: `context` (`SECOND_ANCHOR`, `VISION`, `DEEP_PRIME`, `VISUALIZE`, `CHART`, `GENERAL_UPGRADE`, `TRIAL_ENDED`) |
| **5.2** | Plan Selection & Conversion Share (`annual` vs `weekly` vs `monthly` vs `lifetime`) | Trends (Bar) | Series A: `paywall_plan_selected`<br>Series B: `paywall_converted` | Breakdown: `plan`, `outcome` |
| **5.3** | Store Checkout Friction: Cancelled vs. Failed vs. Succeeded | Trends | Series A: `purchase_started`<br>Series B: `purchase_cancelled`<br>Series C: `purchase_failed`<br>Series D: `paywall_converted` | Breakdown: `plan`, `error_code` |
| **5.4** | Paywall Dismissal by Step (Step 1 Offer vs Step 2 Plans) | Trends | `paywall_dismissed` | Breakdown: `step` (`1` vs `2`), `context` |
| **5.5** | Restore Purchases Funnel | Trends | `restore_attempted` | Breakdown: `context` |
| **5.6** | Authoritative Trial-to-Paid Conversion (RevenueCat + Client) | HogQL / Funnel | `trial_started` -> RevenueCat Renewal / `trial_converted` | Conversion Window: `10 Days` |
