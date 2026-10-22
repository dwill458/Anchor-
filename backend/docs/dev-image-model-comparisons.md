# Developer image model comparisons

Development builds show a **Dev model** picker on Anchor creation's Choose a Style step and Vision creation's description screen (including adding a described scene). The choices are session-only and independent for Anchor and Vision. Auto uses the existing production routing. A selection affects the next generation request; it does not modify a job already running.

| Choice | Exact model ID | Provider |
| --- | --- | --- |
| Nano Banana 2 | `gemini-3.1-flash-image` | Google |
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | Google |
| Nano Banana Pro | `gemini-3-pro-image` | Google |
| OpenAI Flare | `gpt-image-2.5-flare` | OpenAI |
| OpenAI Sunburst | `gpt-image-2.5-sunburst` | OpenAI |

`POST /api/ai/enhance`, `POST /api/v2/anchors/:anchorId/vision/generation`, and `POST /api/v2/anchors/:anchorId/vision/scene-generation` accept optional `devImageModel`, restricted to these five IDs. The server requires the existing AI developer identity check (verified email in `AI_DEV_ALLOWLIST`, including the existing default developer account, or the development master identity). Ordinary users and anonymous onboarding requests cannot override models. Existing ownership, entitlements, rate limits and generation limits still apply. Provider API keys stay on the backend.

A pinned request ignores automatic model/tier selection and never falls back to another provider. Anchor comparisons bypass saved variation reuse and partition any resulting pool records by model. The original Anchor PNG is attached to both providers. Vision keeps its private appearance/world/start references and records the selection in a backwards-compatible `{ devImageModel, scenes }` envelope in the existing job plan JSON, preserving it through retries and process restarts. Auto jobs retain the existing plan array. Generated Vision asset metadata also records pinned models.

Install the updated backend before testing the picker against a remote API. No database migration is required. Production mobile builds hide the controls and omit overrides even if a session store contains a selection.

Compare identical sigils, intentions and styles for geometry fidelity, artwork quality, time to both candidates, and failures. New model availability alone does not establish visual parity. Google documents Nano Banana 2.1 and `generateContent` support at https://ai.google.dev/gemini-api/docs/generate-content/image-generation.
