# Chart Workstream G rollout controls

Chart remains dark by default. Releasing a client build does not authorize a
Chart request; the server resolves every capability for the authenticated
account and mobile treats absent capabilities as denied.

The server requires `ENABLE_CHART=true` and a deterministic account assignment
below `CHART_ROLLOUT_PERCENT` (default `0`). `CHART_KILL_SWITCH=true` overrides
all Chart flags and rollout assignment immediately. Never supply or accept a
device ID or client-side rollout bucket.

Writes additionally require `ENABLE_CHART_WRITE=true`; reflections require
`ENABLE_CHART_REFLECTIONS=true`. Planner generation additionally needs
`ENABLE_CHART_AI_PLANNER=true`, a valid server-only `GOOGLE_API_KEY`, valid
planner cap configuration, an eligible entitlement, and quota remaining.
Missing configuration fails closed without fallback, persistence, or quota
consumption. Existing owned proposals remain retrievable and eligible ones can
be accepted after entitlement loss.

The frozen planner limits are trial `3` lifetime, Pro `10` per rolling UTC day,
and free/expired `0`. Do not enable Chart or the planner as part of deploying
this workstream.
