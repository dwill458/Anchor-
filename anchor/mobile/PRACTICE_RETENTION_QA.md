# Practice Retention Loop QA Checklist (Zen Architect)

## 1) Practice Screen
- [ ] **Cards**: Shows 3 cards with correct copy + buttons:
  - Resume Ritual → “Pick up your thread.” / “Reconnect”
  - Stabilize (30s) → “Breathe. Return. Seal the state.” / “Stabilize”
  - Expand Your Sanctuary → “Unlock deeper rituals, pattern tracking, and longer sessions.” / “Evolve”
- [ ] **Sanctuary Candle**:
  - Lit when user stabilized today
  - Dim when user has not stabilized today
  - Adds subtle halo layer when streak ≥ 7 days
- [ ] **Neutral reminder**: When candle is dim, shows: “Keep the flame lit with a 30s return.”

## 2) Stabilize (30s) Ritual
- [ ] **Timing**: Runs exactly 30s total
  - 0–5s Arrive: breath cue + “Return to center.”
  - 5–20s Hold: sigil visible + lock ring closes smoothly
  - 20–30s Seal: subtle pulse + “State locked.” + light haptic
- [ ] **Completion**: Shows completion state + “Calm +1” + “Done” returns to Practice
- [ ] **Phase transitions**: Smooth fade/slide transitions between phases
- [ ] **Reduce motion**: Animations simplify when Reduce Motion is enabled

## 3) Streak Rules
- [ ] **1/day counts**: First stabilize of the day increments streak and total
- [ ] **Same day repeat**: Additional stabilizes the same day increment total but not streak
- [ ] **Missed day**: If a day is missed, streak resets on next stabilize (no shame messaging)

## 4) Persistence & Sync
- [ ] **Local persistence**: After app restart, these persist:
  - `stabilizesTotal`
  - `stabilizeStreakDays`
  - `lastStabilizeAt`
- [ ] **Backend sync (non-mock auth)**: `POST /api/practice/stabilize` updates user stats
- [ ] **Mock auth mode**: Stabilize still updates locally without backend calls

## 5) Evolve Screen
- [ ] **Entry**: “Evolve” opens from Practice (“Evolve” button)
- [ ] **Paths**: Lists 4 paths with icon + description:
  - Grounding, Focus, Release, Integration
- [ ] **Free growth actions**:
  - Grounding: “Stabilize (30s)” works
  - Focus: “Reconnect” works
- [ ] **Locked/Coming soon items**: Present but clearly disabled (no hard paywall feel)

