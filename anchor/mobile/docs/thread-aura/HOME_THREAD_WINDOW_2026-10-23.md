# Home Thread Strength window repair — 2026-10-23

Requirement: medium/high phones prepare five complete hero readings together
(current, previous two, next two). Low tier retains its three-card budget.

## Evidence and cause

- User recordings showed an incoming Anchor resting at 0% before its V2 reading
  appeared roughly a second later. The 16:59 recording includes 0% → 10% and
  0% → 30% transitions.
- Rendering mounted five cards on medium/high, but warming requested three
  immediately and only next+2 after 400 ms. Previous−2 was never warmed.
- Warming followed the deferred shared selection, rather than the visual center.
- Prefetched recommendation results did not notify the mounted neighbor readings;
  those cards continued to use the Anchor record until selected.
- Neighbor percentage SVGs were withheld until a card became the center.
- A selected-screen abort could cancel a transport promise shared with prefetch.

## Final implementation

- Warm the exact five-card visual window immediately on medium/high; three on low.
- Restore encrypted recommendation snapshots concurrently with server reads.
- Publish changed cache readings to Home so all mounted scores, weekly deltas and
  auras consume the same account-scoped V2 result before selection commits.
- Mount all five percentage drawings on medium/high. Preserve the low-tier budget.
- Keep shared transport requests alive when one screen stops waiting, while still
  honoring that caller's AbortSignal.
- Key warming by account, window IDs and artwork URLs so cache publications do not
  repeatedly cancel/restart the window.

The earlier server resolver, auth merge and Anchor-vault mutation experiments from
this chat were removed. This repair needs only the app bundle and retains the
existing encrypted presentation cache; it does not rewrite score data in the vault.

## Verification

- Regression reproduced before the window repair: high/medium expected five
  immediate requests but received three; cache-only rerenders restarted warming.
- Shared-read regression reproduced before the transport repair: aborting one
  caller canceled the request another caller was awaiting.
- Final focused run: **10 suites, 133 tests passed**, covering five-window loading,
  low tier, wraparound, small vaults, visual-center timing, cache publication,
  encrypted/network ordering, shared cancellation, percentage mounting, Home
  selection, and render budgets.
- TypeScript: 22 repository diagnostics outside the touched files; no diagnostics
  in this change. Repository-wide typecheck is not clean.
- Physical S24 Ultra (SM-S928U1), authenticated Expo 58 QA app connected to the
  workspace Metro: recorded forward/back swipes through Home positions 5–7.
  Incoming 23%, 21% and 68% readings were visible as the cards arrived and stayed
  unchanged after settling. Arrival crops inspected at 100 ms intervals show the
  incoming 23% already present while its row fades into view.
- This physical sample validates those transitions. It does not establish every
  Anchor, cold empty-cache startup, arbitrary network latency, or iOS acceptance.

Host evidence:
`.codex-remote-attachments/01a16ab2-b94f-7a13-8b06-6be0dcf20e14/qa-five-window-20261023/`
(repository root): `s24-swipes-after.mp4`, `s24-arrival-frames.png`, and
`s24-swipes-contact.png`.
