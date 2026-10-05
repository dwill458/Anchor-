# Motion polish — device checklist (S24)

Tests and the type-check cannot judge feel. Run these on a device build; each line says what should happen.
Plan: `2026-10-05-motion-polish.md`. Spec: `../specs/2026-10-05-motion-polish-design.md`.

## Touch response
- [ ] **V2Button** (Chart Adjust "Apply", Paywall/Practice CTAs): the button sinks a hair under the finger and settles back. No opacity flash.
- [ ] **V2IconButton** (back arrows in creation/Home header): same sink, with the grouped tint fading in, not snapping.
- [ ] **V2ListRow** with an action: a soft wash fades in behind the row and the chevron leans right ~2px. A row with no action does nothing.
- [ ] **Library tiles**: each Anchor sinks slightly when pressed.
- [ ] **Paywall plan radios** (Trial-ended screen): the plan row sinks when pressed.
- [ ] **Loading button** (any `loading` V2Button): the label fades out as the spinner fades in; it is not pressable meanwhile.

## Arrivals (once, in reading order)
- [ ] **Library**: top bar, then filter, then tiles rise in turn (never longer than ~6 steps of 60ms, even with many Anchors).
- [ ] **Weekly Insight**: date, headline, visual, evidence, interpretation, then next/feedback/disclosure arrive in order.
- [ ] **Paywall** (contextual sheet and Trial-ended): artifact/headline, benefits, trial timeline, offer arrive in order. The CTA and footer stay still.
- [ ] **Chart Adjust**: heading, then the panel.
- [ ] **No replay**: go back to each screen from a pushed screen, pull to refresh, open Weekly Insight's disclosure, select a plan. Nothing re-staggers.

## Swaps in place
- [ ] **Library filter** (All / Active / Released): the pill slides on a spring; the grid cross-fades; tiles do not rise again.
- [ ] **Weekly Insight → history → pick a snapshot**: the content cross-fades; sections do not re-stagger.
- [ ] **Chart Adjust "Edit the route yourself" and back**: the body cross-fades; no stagger.

## Feedback states
- [ ] An empty Library filter, an inline error and a loading indicator arrive with a fade and a small rise.
- [ ] `V2Skeleton` (System Gallery) breathes slowly rather than sitting flat.

## Reduce Motion
- [ ] Settings → Reduce Motion **On**: no rising, no scaling; presses dim instead of sink; arrivals are short fades; the segmented pill moves quickly with no spring.
- [ ] Settings → **Off** while the OS "Remove animations" is on (Android): motion still runs, because the in-app setting decides.
- [ ] Android animator duration scale 0 with the in-app setting **Off**: arrivals still play (shared layer opts out of Reanimated's implicit check).

## Not covered this round
- **Progress screen**: skipped, it is mid-redesign in the working tree. Wrap its hero, evidence summary and timeline in `Reveal` (orders 0–3) once that lands.
- Practice hub/Prepare, Chart Journey, Home, Anchor Details, creation, Visualize: left alone on purpose (own choreography).
