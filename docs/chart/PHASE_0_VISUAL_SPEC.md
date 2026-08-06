# Chart Phase 0 Visual Specification

Status: Phase 0 reference capture and contract freeze  
Captured: 2026-08-04  
Scope: documentation and visual-analysis assets only. No production code, API, migration, navigation, store, or component behavior was changed.

## Source and capture provenance

The primary visual source is [`Chart (Standalone) (1).html`](E:/downloads/Chart%20(Standalone)%20(1).html). The supplied pasted brief and [`PHASE_0_CONTRACT_FREEZE.md`](PHASE_0_CONTRACT_FREEZE.md) are the authority for corrections where the HTML prototype conflicts with the frozen product contract.

The prototype was rendered locally with headless Chrome because the in-app browser surface was unavailable in this environment. Every capture is a 1024 × 1000 editor screenshot containing the prototype's state chooser and one 390 × 844 simulated iOS device. The simulated device is not evidence of responsive behavior at other sizes.

Reference captures:

- [Chart home](phase-0-references/chart-home-1024x1000.png)
- [Current waypoint sheet](phase-0-references/waypoint-current-sheet-1024x1000.png)
- [Upcoming waypoint sheet](phase-0-references/waypoint-upcoming-sheet-1024x1000.png)
- [Course details sheet](phase-0-references/course-details-sheet-1024x1000.png)
- [Course switcher sheet](phase-0-references/course-switcher-sheet-1024x1000.png)
- [Reflection sheet](phase-0-references/reflection-sheet-1024x1000.png)
- [Waypoint reached ceremony](phase-0-references/waypoint-reached-ceremony-1024x1000.png)
- [Empty Chart](phase-0-references/empty-chart-1024x1000.png)
- [Plotting at 1600 ms](phase-0-references/plotting-1600ms-1024x1000.png)
- [Proposed course](phase-0-references/proposed-course-1024x1000.png)
- [Destination reached](phase-0-references/destination-reached-1024x1000.png)

Evidence labels used below:

| Label | Meaning |
|---|---|
| Observed | Directly visible or directly measurable in the supplied HTML. |
| Repository | Present in the current mobile/backend integration. |
| Contract | Frozen by the pasted brief and contract-freeze document. |
| Unknown | Not observable from the source capture; must be decided or measured in Phase 1. |

## Device frame, viewport, and safe area

| Item | Frozen value or observation |
|---|---|
| Prototype canvas | `html`, `body`, and `#root` are 100% width/height; page background `#080B0F`; centered flex layout; overflow hidden. |
| Simulated phone | 390 × 844 CSS px, dark iOS frame. |
| App content | Full-screen inner surface; `paddingTop: 54px`; background `#0F1419`; overflow hidden. |
| Frame | 48px radius; dark frame `#000`; shadow `0 40px 80px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.12)`. |
| Dynamic Island | Absolute top 11px, centered, 126 × 37px, radius 24px. |
| Status bar | Absolute top area; prototype uses 9px/11px status text and a simulated time, signal, Wi-Fi, and battery. |
| Home indicator | Bottom-centered 139 × 5px pill; bottom 34px; frame has 8px bottom padding. |
| Viewport meta | `width=device-width, initial-scale=1.0`. |
| Safe-area behavior | Top/bottom insets are represented only by the fixed mock device. Real RN safe-area behavior for notches, Dynamic Island variants, keyboard, and landscape is Unknown. |
| Responsive behavior | Unknown. Only the 390 × 844 surface was observed. |

## Visual tokens

These values are copied from the prototype's `C` token object. They are reference values, not a request to add a second production theme.

| Token | Value |
|---|---|
| Background | `#0F1419` |
| Deep background | `#0A0E13` |
| Gold | `#D4AF37` |
| Bright gold | `#F0CB6A` |
| Gold dim | `rgba(212,175,55,0.14)` |
| Gold line | `rgba(212,175,55,0.24)` |
| Gold faint | `rgba(212,175,55,0.10)` |
| Bone | `#F5F0E8` |
| Bone soft | `rgba(245,240,232,0.62)` |
| Bone faint | `rgba(245,240,232,0.32)` |
| Purple | `#3E2C5B` |
| Lavender | `#9B82D4` |
| Lavender soft | `rgba(186,172,214,0.55)` |
| Card background | `linear-gradient(165deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.008) 100%)` |
| Card border | `rgba(255,255,255,0.065)` |
| App/page background | `#080B0F` |

### Typography

| Role | Family | Size / weight | Tracking / other |
|---|---|---|---|
| Display heading | Cinzel | 21px / 700 for `CHART`; 19px / 600 for course title | `0.14em` for wordmark; title line-height `1.32` |
| Kicker | Cinzel | 9.5px / 600 | Uppercase, `0.22em`, gold at 62% |
| Body | Inter | 11.5–13px / 300–500 | Bone or bone-soft; line-height varies by block |
| Button | Cinzel | 11–12px / 600–700 | Uppercase, `0.16em` |
| Quote | Cormorant Garamond | 17px / 400–500 | Italic in reflection/log surfaces |
| Log metadata | Inter | 9px / 600 | Uppercase, wide tracking |
| State menu | Inter | 11px | Prototype-only editor control; not production UI |
| Font faces | Cinzel, Cormorant Garamond, Inter | 400/500/600/700 as used | All are declared by the HTML prototype |

## Geometry and shared components

| Primitive | Exact observed geometry and treatment |
|---|---|
| Hairline | 1px; linear gold gradient. |
| Panel | Card gradient above; 1px card border; 16px radius; overflow hidden. |
| Ghost button | Inline flex; 6px gap; 8px vertical padding; Inter 11.5px / 500; bone-soft text. |
| Primary gold button | Full width; 50px high; 13px radius; gradient bright-gold → gold; text `#14100A`; shadow `0 6px 26px rgba(212,175,55,0.22)`. |
| Secondary line button | Full width; 46px high; 13px radius; transparent; 1px gold-line border; gold Cinzel text. |
| Course header | 10px 20px 0 padding; wordmark `CHART`; subtitle 4px below; circular bell/menu buttons 34 × 34px, 1px gold-faint border. |
| Current waypoint marker | 38 × 38px; lavender outer ring; 1.5px gold inner ring; purple gradient; 5px bright-gold center; 5.5s breathing glow. |
| Reached waypoint marker | 23px gold radial circle with an 11px check. |
| Plotted waypoint marker | 18px gold radial circle with an 8px check. |
| Upcoming waypoint marker | 17px hollow circle. |
| Destination marker | 38px outer ring; inset glow; 17px rotated square with 1.4px gold border; 9px star. This is a course endpoint visual, not a frozen `WaypointState`. |
| Anchor art | 96 × 96px default; glow inset -14px; ring inset -8px; gold-line ring inset -1px; image slot inset 3px. The capture shows the placeholder because the source asset slot is absent. |
| Bottom navigation | Top border 1px `rgba(255,255,255,.055)`; gradient background; 12px backdrop blur; 24px bottom padding; active top line 28 × 2px gold with glow; icon 19px; label 8px Cinzel / 600 / `0.16em`. |
| Bottom sheet | Overlay `rgba(4,6,9,.72)` + 2px blur; sheet gradient `#141A21` → `#0D1218`; 1px gold-faint top border; 22px top corners; handle 34 × 3px, 11px from top; shadow `0 -20px 60px rgba(0,0,0,.6)`. |
| Touch targets | Prototype buttons are visually sized but does not establish a 44 × 44px accessibility contract. Current RN map tests require 44 × 44px waypoint hit targets. |

## Chart model visual mapping

The current destination is a property of `Course`. `Course.currentWaypointId` is the only authority for the current waypoint. Waypoint state is derived from the course pointer and waypoint history; it is not a second persisted source of truth.

| Frozen model value | Visual treatment | Controls / meaning |
|---|---|---|
| `DRAFT` | Empty/setup or editor treatment | Create/edit/publish subject to online/read-only rules. |
| `ACTIVE` | Chart home with route and current marker | Read cached course; mutations require online server authority. |
| `COMPLETED` | Destination culmination and completed journey | Read-only journey; completion must already be server-confirmed. |
| `ARCHIVED` | Read-only chart/detail treatment | Restore is an online mutation; no practice or course mutation while archived. |
| `UPCOMING` | Hollow node | Inspect/edit only where allowed; no “Make This Current” action. |
| `CURRENT` | Dominant lavender/gold breathing node | Practice, log, and completion action if online and permitted. A current waypoint with `anchorLink === null` has never been anchored (decision D10): it is still `CURRENT`, reach and skip stay available, and only practice is withheld. Its copy and treatment are D5. |
| `REACHED` | Gold checked node | History/log; cannot become current again. |
| `BLOCKED` | Existing RN map blocked treatment; prototype has no equivalent | An Anchor link that existed has stopped being usable. Show reason and resolution, do not advance automatically. Never used for "not set up yet" — see [`PHASE_0_D10_DECISION.md`](PHASE_0_D10_DECISION.md). |
| `SKIPPED` | History/terminal treatment; prototype has no equivalent | No current transition back to this waypoint. |
| `CANCELLED` | History/terminal treatment; copy “Waypoint removed from the course”; prototype has no equivalent | Owner cancellation is once-only for an upcoming, non-current, non-terminal waypoint. |
| Course destination | Endpoint star/marker plus destination copy | Not a waypoint state and not a waypoint-local status tag. |

The prototype's `destination` status tag on the final route item and its “MAKE THIS CURRENT” control are therefore reference observations only; both are corrected by the frozen contract.

### Anchored versus un-anchored current waypoint

Decision D10 introduced no new `WaypointState`. The three cases a surface must
tell apart are already carried by the frozen `WaypointSummary` fields:

| Situation | `state` | `blockedReason` | `anchorLink` |
|---|---|---|---|
| Anchored and healthy | `CURRENT` | `null` | link, `anchorAvailable: true` |
| Never anchored | `CURRENT` | `null` | `null` |
| Anchor unlinked, burned, or archived | `BLOCKED` | set | closed link, snapshot retained |

The [current waypoint sheet](phase-0-references/waypoint-current-sheet-1024x1000.png)
evidences only the first row: `LINKED ANCHOR`, three practice modes, and
`MARK REACHED`. The [upcoming waypoint sheet](phase-0-references/waypoint-upcoming-sheet-1024x1000.png)
shows an un-anchored waypoint with no Anchor section at all, which is why an
Anchor is not a precondition for becoming current. The second and third rows
have no visual evidence and are D5.

## Screen and route inventory

| Prototype view/state | Observed structure and copy | Current RN route / disposition |
|---|---|---|
| Chart home | `CHART`; “Know where you’re going.”; active course; route; “2 of 5 waypoints reached”; current waypoint; linked Anchor; practice cards; Course Log; Course Guidance. | `ChartHome`; active route/list/map integration exists. Practice action is still a placeholder. |
| Empty Chart | “Where are you going?”; “Set a destination. Anchor will help you plot the way there.”; `PLOT YOUR COURSE`; `Build it myself`; bottom nav visible. | `ChartHome` empty state → `CourseSetup`. |
| Active Course | Sample destination “Anchor has ten thousand users”; current `1K USERS`; reached and upcoming route nodes. | `ChartHome` with `CourseStatus.ACTIVE`. |
| Waypoint detail | Current detail has three practice modes, linked Anchor, log, `MARK REACHED`; upcoming detail has `MAKE THIS CURRENT`, `EDIT WAYPOINT`. | `WaypointDetail` form sheet. Remove `MAKE THIS CURRENT`; wire actions to the server contract in Phase 1. |
| Course management | “Course details”; `Edit course`, `Add waypoint`, `Reorder waypoints`, `Replan with AI`, `Change destination`, `Archive course`. | `CourseDetails` form sheet plus `CourseEditor`; action availability is more restrictive in the frozen contract. |
| Setup/editor | Proposed setup/editor flow; destination and ordered waypoint cards. | `CourseSetup` and `CourseEditor`; setup is manual in current RN shell. |
| AI plan review | `YOUR COURSE`; proposed milestones; `USE THIS COURSE`, `EDIT`, `REPLAN`. | `AIPlanReview` is currently a registered placeholder route. Keep behind its flag until its behavior is defined. |
| Reflection composer | “HOW DO YOU FEEL NOW?”; mood pills; freeform text; `SAVE REFLECTION`; `Skip`. | `ReflectionComposer`; use the unified private reflection/draft contract. |
| Course Log | Dated reflection, waypoint, and focus entries; `VIEW FULL LOG`. | `CourseLog`; backend log is a hybrid canonical entity/event projection. |
| Waypoint reached ceremony | “You reached a waypoint”; `1K USERS`; “Before you continue…”; two optional prompts; `CONTINUE COURSE`; `Skip reflection`. | `CourseCompletion` is the server-confirmed course completion surface today. The waypoint ceremony needs a distinct Phase 1 route/state if retained. |
| Completed / archived | Destination reached, journey summary, completed route; archive is not visibly prototyped. | `CompletedJourney`, `CourseCompletion`, and archived `ChartHome`/`CourseDetails`. |
| Loading | Not present in the HTML prototype. | Repository has `Loading Chart`; fixture required. |
| Error | Not present in the HTML prototype. | Repository has typed error copies and retry; fixture required. |
| Offline / stale | Not present in the HTML prototype. | Repository supports cached reads, stale metadata, and read-only mutation gating; fixture required. |
| Blocked / skipped / cancelled | Not present in the HTML prototype. | Contract/backend support exists; visual states need Phase 1 implementation and screenshots. |
| Entitlement / migration / repair | Not present in the HTML prototype. | Repository has entitlement and migration/read-only handling; repair behavior needs explicit UX. |

## Active Chart layout measurements

The active sample uses a 680 × 196 logical map design space inside a horizontally scrollable container. The visible route points are:

| Waypoint | State | Map x | Map y | Sample copy |
|---|---|---:|---:|---|
| `START` | Plotted | 62 | 138 | “The chart was plotted. One idea, no audience.” |
| `100 USERS` | Reached | 196 | 108 | “Find the first rooms where strangers understand the product without explanation.” |
| `1K USERS` | Current | 342 | 122 | “Build enough awareness and value that the first thousand people choose to make Anchor part of their practice.” |
| `5K USERS` | Upcoming | 486 | 82 | “Turn early advocates into a channel that repeats without you.” |
| `10K USERS` | Course destination | 618 | 54 | “Ten thousand people keeping a thread.” |

The map centers the current node with `scrollLeft = current.x - clientWidth / 2`. The prototype's segment variants are solid gold/lavender gradients, reached/current/upcoming dashed segments, and a moving gleam path. The route is decorative in the current RN accessibility model; the linear waypoint list is the semantic fallback.

## Copy and content inventory

| Surface | Exact observed copy |
|---|---|
| Header | `CHART` / “Know where you’re going.” |
| Current course | `CURRENT COURSE` / “Active destination” |
| Progress | “2 of 5 waypoints reached” |
| Current waypoint | `CURRENT WAYPOINT` / `1K USERS CURRENT` / “Current since Jul 18 · 3 anchored sessions this week” |
| Linked Anchor | `LINKED ANCHOR` / “Anchor has ten thousand users” / `LINKED TO 1K USERS` / `View Anchor` / `Change Anchor` |
| Practice | `PRACTICE THIS WAYPOINT` / `Last practice · Yesterday · Thread strong` |
| Modes | `FOCUS` “Lock onto the Anchor”; `VISUALIZE` “See the outcome clearly”; `DEEP PRIME` “Go deeper” |
| Log | `COURSE LOG` / `Add Reflection` / `View full log →` |
| Guidance | `COURSE GUIDANCE` / “You’ve mentioned creator outreach in three reflections this month.” / `Explore pattern →` |
| Empty | “Where are you going?” / “Set a destination. Anchor will help you plot the way there.” / `PLOT YOUR COURSE` / `Build it myself` |
| Plotting | `PLOTTING YOUR COURSE` / “Reading your Anchors and reflections…” |
| Proposed | `YOUR COURSE` / `PROPOSED` / `USE THIS COURSE` / `EDIT` / `REPLAN` |
| Reached ceremony | “You reached a waypoint” / “Before you continue…” / `CONTINUE COURSE` / `Skip reflection` |

## Interaction contract matrix

| User action | Prototype behavior | Frozen Phase 1 behavior |
|---|---|---|
| Tap route node | Opens a bottom sheet. | Navigate to `WaypointDetail(courseId, waypointId)`; current state is derived from the refreshed course. |
| Tap `MARK REACHED` | Opens a local reached ceremony overlay. | Online, idempotent server mutation; submit optional structured reflection in the same transaction when it is a completion reflection. Refresh the authoritative course. |
| Tap `MAKE THIS CURRENT` | Presents a line button for an upcoming waypoint. | Remove. Current is advanced only by the server's completion/skip rules and `Course.currentWaypointId`. |
| Open Chart switcher | Shows two courses, one `Paused`, plus “Plot a new course.” | Remove from V1. One live Course; no paused/multiple-live switcher. Historical completed/archived records remain accessible through their defined surfaces. |
| Tap practice mode | Prototype changes to a reflection sheet or local practice intent. | Call the sole `startPractice` boundary with `source: chart` (Phase 1 type addition), the course/waypoint context, and the selected mode. It must create/use the canonical `PracticeSession`. Entitlement denial returns to Chart with the original target intact. |
| Add/save reflection | Saves local prototype text. | Use the unified private `Reflection` entity; offline local draft remains encrypted, account-bound, idempotent, and soft-deletable. Course mutations remain disabled offline. |
| Open Course Log | Expands the sample log. | Navigate to `CourseLog`; order canonical Course events and linked canonical entities according to the hybrid log contract. |
| Edit/reorder/link Anchor | Prototype opens editor-like sheets. | Online only, expected course version and idempotency key; server response becomes the new authority. Anchor burn closes Chart links/snapshots transactionally and can block the affected current waypoint. |
| Complete course | Destination view can be reached from the prototype state chooser. | Explicit online server-authoritative completion only; idempotent and atomic with the required reflection semantics. No client-only completion or Anchor lifecycle side effect. |
| Dismiss sheet | Overlay tap/back gesture. | Respect RN stack/form-sheet dismissal; unsaved private text must remain a local draft or require explicit discard. Exact keyboard/dismiss behavior is Unknown. |
| Use/edit/replan AI course | Prototype transitions through proposed content. | AI plan review remains flag-gated until plan generation, persistence, versioning, and failure behavior are specified. |
| Plot what comes next | Destination screen returns to setup. | Route to setup only when the product contract permits a new Course; it must not silently create a second live Course. |

## Animation inventory

| Animation | Timing / easing | Reduced-motion behavior | Notes |
|---|---|---|---|
| Current marker breathe | 5.5s infinite; `ease-in-out`; scale 1 → 1.1 → 1; opacity .8 → 1. | All animation disabled. | `.wp-breathe`. |
| Current marker ring pulse | 5.5s infinite; `ease-in-out`; scale 1 → 1.06; opacity .5 → .9. | Disabled. | `.wp-ring`. |
| Route gleam | 8s infinite; `cubic-bezier(.5,0,.5,1)`; dash offset 420 → 0. | Disabled. | `.gleam`. |
| Screen/state fade | .45s; `ease`. | Disabled. | `.screen-in`. |
| Route segment draw | 1s; `cubic-bezier(.4,0,.2,1)`; dash offset 200 → 0. | Dash offset forced to 0. | `.plot-seg`. |
| Plot nodes | .7s `ease`; star 1.4s `ease`; grid 1.8s `ease`. | Opacity forced to 1. | Plotting view. |
| Plot compass | 14s infinite linear rotation. | Disabled. | Decorative. |
| Plotting completion transition | `setTimeout` at 5200ms. | Unknown; CSS animations stop but the timer remains in the prototype. | Must be made deterministic and cancellable in Phase 1. |
| Bottom sheet open/close | Overlay .28s `ease`; panel .34s `cubic-bezier(.22,1,.36,1)`. | Transitions disabled. | Prototype CSS. |
| RN route transition | Unknown from the HTML. | Use existing RN navigator/reduced-motion policy. | Current stack uses slide-from-right and form-sheet variants. |

Global prototype reduced-motion rule: `@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`, with plot segments/nodes/grid forced visible.

## Accessibility and input findings

Observed: route nodes have labels such as `${title}, ${status}`, current has `aria-current="step"`, and the prototype supplies semantic text for key buttons. The prototype does not establish a complete screen-reader order, 44px target contract, focus restoration rule, keyboard avoidance rule, or dynamic type policy.

Repository evidence: the RN map is intentionally hidden from accessibility in favor of a semantic linear list; waypoint nodes have 44px or larger hit targets; current and blocked states have text/pill affordances; reduced-motion map animation tests exist. These repository behaviors should remain the implementation baseline.

Phase 1 must additionally freeze:

- safe-area and keyboard behavior for every composer and bottom-sheet surface;
- focus placement/restoration and unsaved-draft dismissal behavior;
- dynamic type and text wrapping at minimum supported sizes;
- announcements for current, blocked, reached, skipped, cancelled, and completed transitions;
- non-color-only distinction for every map state;
- exact hit targets for header, map, sheet, bottom-nav, and log controls.

## Phase 0 visual conclusion

The HTML prototype establishes a dark, editorial, gold/lavender Chart language and a single dominant route node. It is a useful visual reference at 390 × 844, but it is not a complete interaction specification. The corrected contract in this document and the fixture matrix are the implementation authority for states and mutations; the prototype screenshots are visual evidence only.
