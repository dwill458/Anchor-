# Ask Chart — audit and implementation plan

Branch: `feat/vision-conversational-creation-20261020` (cut from it or a child). Date: 2026-10-21.

## 1. Audit: what exists

**Mobile (`anchor/mobile/src`, Expo 58 / RN 0.88 / Reanimated 4.7.1 / Skia 2.14 / TS strict)**

| Area | Where | State |
|---|---|---|
| Creation flow | `components/v2/chart/ChartCreationFlow.tsx` (1196 lines) | Phases `intro → context → generating → followup → review ⇄ adjusting → revealed`. Intro is `ChartIntroOpening`; `onContinue` goes to `context`. |
| Starting-photo screen | `ChartContextStep.tsx` (photo step), `ChartRealityInput.tsx` (text fallback), follow-up sheet in the flow | **This is the screen the brief removes.** Replace with the cream conversation. |
| Review + adjust | `panel/ChartCreamPanel`, `ChartRouteEditor`, `ChartAdjustPanel` | Cream review already exists (one-move card + route editor). Reusable. |
| Reveal | `ChartGenerationStage`, `save()` → `revealed` → `exploreChart` | The locked map + fog reveal. Untouched. |
| Navy sheet | `sheet/ChartSheet.tsx` (detents, gestures), `sheet/ChartSheetContent.tsx`, `ChartWaypointContent.tsx` (1268 lines), `ChartOneMoveRow` | No "Help me move forward" exists today. Content is composed in `ChartWaypointContent` via `renderTiers`. |
| Navigation | `screens/v2/chart/V2ChartScreen.tsx`; `navigation('V2Practice', {returnRoute:'V2Chart'})`, `V2ChartAdjust`, `V2ChartJourney`, `V2Vision` | Practice already has a `returnRoute`. |
| Voice | `hooks/v2/vision/{speechRecognition,useVisionDictation,visionDictation}.ts`, `expo-speech-recognition` guarded import | **On-device STT exists** (Vision). Reuse; no backend STT needed. No waveform/level UI yet. |
| Images | `hooks/v2/vision/visionPhotoInput.ts` (`pickVisionPhoto`, `uploadVisionPhoto`), `chartReferences.ts` → `POST /api/v2/assets/upload` | Camera/library/upload exist. Photos reach the planner by asset id. |
| Anchor avatar | `components/v2/anchor/AnchorMark.tsx`, `CircularAnchorRenderer.tsx` | Real user SVG renderer exists. |
| Motion | `chartMotion.ts` (`CHART_EASING`, `chartTiming`), `ChartKeyboardFrame` | Reuse timings/easing. |

**Backend (`backend/src`)**

| Area | Where | State |
|---|---|---|
| Routes | `api/routes/v2/chartRoutes.ts` | `GET chart`, `POST chart/plan` (returns `needs_context` follow-up or a proposal), `plan/adjust`, `POST chart`, `PUT charts/:id/route` (versioned, idempotent), `moves` CRUD + complete/dismiss, `suggest-moves`, progress. Pro gate on creation. Rate limiters present. |
| Planner | `services/chart/ChartPlannerService.ts`, `chartPlanPrompt.ts`, `chartPlanSchema.ts`, `chartPlanValidation.ts`, `chartTemplateRoute.ts` | Provider chain with deterministic template fallback; proposals persisted in `AIPlanProposal`; results report `generation.source / fallbackUsed`. |
| Providers | `chartModelProviders.ts` | OpenAI primary (`gpt-4.1-mini`) if `OPENAI_API_KEY`, else Gemini (`gemini-3.5-flash-lite`). `generateJson` only: **no streaming, no multi-turn, no tool/function calling**. Both accept images. |
| Data | `prisma/schema.prisma`: `Course`, `Waypoint`, `Move` (AI moves are `SUGGESTED` until accepted), `AIPlanProposal`, `CourseEvent` | Server-authoritative progress already. **No conversation, message, memory or coaching-preference tables.** `CourseEventType` already has `ROUTE_ADJUSTED`. |

## 2. Gaps against the brief

1. No multi-turn conversation endpoint, no persistence, no streaming, no memory/preferences, no `chart-agent.md`.
2. Current "conversation" is one optional follow-up question, not adaptive.
3. No coaching skills (break down, plan week, stuck, …) as structured workflows.
4. No Route Updated screen; no Ask Chart entry from the navy sheet; sheet hierarchy not as specified.
5. No waveform/level UI for dictation; no streaming renderer.
6. Provider config is `-mini` / `flash-lite`: likely a cause of generic output, but must be **measured** on representative goals before changing.

## 3. Locked, do not touch

`ChartGenerationStage`, `map/*` (fog, route geometry, shaders, camera), `ChartMapLand`, `ChartStaticMap`, Vision polaroid placement, `ChartIntroOpening`. Only integration points (phase wiring in `ChartCreationFlow`, sheet content composition) change. Parity guard: existing `map/__tests__`, `ChartActiveViewReveal`, `ChartCreationFlowIntroPreparation`, `ChartSheet` tests run before and after every phase.

## 4. Design decisions

- **Reuse the existing proposal pipeline.** Ask Chart never writes Chart rows. The conversation produces an `AIPlanProposal` (create/adjust) or a *move proposal*; the user approves in the UI; the client calls the existing validated endpoints (`POST chart`, `PUT route`, `POST moves`). Route Updated plays only after that call returns 2xx.
- **New backend module `services/chart/ask/`**: `AskChartService` (turn orchestration), `chart-agent.md` (versioned identity file, loaded and hashed at boot, version logged per turn), `askChartTools.ts` (read-only context assemblers + proposal builders, zod-validated), `askChartSkills.ts` (one structured workflow per skill), `askChartMemory.ts`.
- **Provider layer**: extend `ChartModelProvider` with `generateJson` (kept) and `streamText` (new, optional per provider). Model per task via env (`CHART_ASK_MODEL`, `CHART_ASK_FALLBACK_MODEL`, plus a heavier `CHART_ASK_PLAN_MODEL` for route generation only). Log provider/model/fallback/latency per turn. Never label a template result as personalised.
- **Streaming transport**: SSE over `POST /api/v2/charts/:id/ask` (and `/anchors/:id/chart/ask` pre-creation). Client falls back to non-streamed JSON if SSE is unavailable.
- **Data model (new migration)**: `ChartConversation` (userId, anchorId, courseId?, status), `ChartMessage` (role, text, attachmentMeta, proposal JSON, idempotencyKey), `ChartCoachProfile` (userId, style) and `ChartMemory` (userId, anchorId, key, value, source, deletable). Images are processed in-request and **not stored**; only a `hadImage` flag is kept.
- **Mobile**: `components/v2/chart/ask/*` (AskChartScreen content, MessageList on `FlashList`-or-FlatList inverted per what is installed, Composer, VoiceRecorder with `expo-audio` metering or the speech-recognition volume event, AttachmentSheet, ProposalCard, RoutePreview, ThinkingAvatar, RouteUpdated). Category accent via `getCategoryColor` / `panelAccent`. Same component hosts creation and ongoing modes.
- **Entry**: in creation, `intro.onContinue → phase 'ask'` (replaces `context`/`followup`/text fallback; manual-outline fallback stays). Ongoing: new `V2ChartAsk` route opened from a "Help me move forward" row in the navy sheet.

## 5. Phases and exit criteria

1. **Baseline + guards** — run existing chart/map/sheet test suites; record pass/fail; snapshot references. *Exit:* recorded green/red baseline.
2. **Backend foundation** — migration (not applied to production by me), models, memory, `chart-agent.md`, provider streaming, `AskChartService`, skills, proposals, routes, rate limits, tests. *Exit:* jest green; golden-conversation eval script run against a real key if available.
3. **Shared cream conversation UI + creation wiring** — screens, composer, keyboard, avatar, suggestions, error/retry/idempotency. *Exit:* component tests; tsc clean.
4. **Media** — dictation with waveform, attachment sheet, preview/upload/retry, AI-requested photo prompt.
5. **Route review + Route Updated** — reuse cream review; new Route Updated screen gated on persisted success; reduced-motion path.
6. **Navy sheet** — hierarchy per brief, Anchor tap → Anchor Details, Focus → existing Practice with return-state restore, Help me move forward.
7. **Motion + perf pass** — tune on device; low-power degrade.
8. **Regression + device QA** — tests, release-like build, measurements. Anything not measured on a device is reported as unverified.

## 6. Blocking decisions (asked of the owner)

- Production is the only Railway environment (no staging). The new tables need a Prisma migration; I will write it but not apply it without approval.
- Provider/model for Ask Chart.

## 7. Baseline (2026-10-21, before any Ask Chart change)

- Mobile `src/components/v2/chart` + `src/screens/v2/chart`: **56 suites / 596 tests pass**, 1 snapshot.
- Backend `src/services/chart` + `chartRoutes.test.ts`: 79 pass, 21 skipped, **1 fail**.
  The failure is `aiPlannerVisionGeneration.test.ts` ("text-only goal without Vision"). It is a live-provider test, and the real model output was rejected with `chart_plan_invalid:unsupported_baseline`. This predates my work. It shows the current planner model sometimes breaks its own schema rules, which is relevant to the model decision.
- Decisions: migration written but not applied; model chosen after measurement.

## 8. Phase 2 (backend) status — 2026-10-21

Built in `backend/src/services/chart/ask/` plus `api/routes/v2/askChartRoutes.ts`. Not committed; migration not applied.

- **Migration** `prisma/migrations/20261021200000_ask_chart` (+ `ROLLBACK_…sql`): `chart_conversations`, `chart_messages`, `chart_coach_profiles`, `chart_memories`. Additive only; SQL verified identical to `prisma migrate diff`. **Apply to production yourself** (`prisma migrate deploy` runs on Railway start/pre-deploy).
- **Agent file** `ask/chart-agent.md` (v1.0.0): core identity, three styles, nine skills. Loaded and hashed by `chartAgent.ts`; version and hash are stored on every assistant message. `npm run build` now copies it to `dist/` via `scripts/copy-assets.js`.
- **Providers**: multi-turn `history`, `streamJson` (OpenAI SSE, Gemini stream), gpt-5/o-series temperature guard, `resolveAskChartConfig`.
- **Models (measured)**: `scripts/evaluate-ask-chart.ts`, 8 models, results in `benchmark-results/ask-chart/`. Defaults: `gpt-5.4-mini` primary (~2.3 s/turn, 53 streamed updates, first text 1.4 s), `gemini-3.5-flash` fallback. Override with `CHART_ASK_OPENAI_MODEL`, `CHART_ASK_GEMINI_MODEL`, `CHART_ASK_PROVIDER_ORDER`.
- **API** (all under `/api/v2`): `POST /anchors/:id/chart/ask` (JSON or SSE `delta|stage|done|error`), `GET|DELETE /anchors/:id/chart/ask`, `GET /anchors/:id/chart/ask/profile`, `PUT|DELETE …/ask/memory[/:key]`, `PUT /chart-coach/style`, `POST /charts/:courseId/ask/:messageId/{approve|dismiss|route-applied}`.
- **Tests**: 57 new backend tests (pure, provider, service, routes) pass; existing chart suites still pass.

## 9. Phase 3 (cream conversation + creation wiring) status — 2026-10-21

Not committed. **Not yet seen on a device or emulator** — everything below is verified by tests and the type checker only.

- **Server additions**: `opening` turn (greeting with no user message; replay-safe), reply keyed to its message so two attempts at one message can only save one answer (unique key + P2002 recovery), agent file v1.1.0 (opening rule).
- **Client API** `services/v2/askChartApi.ts`: SSE parser, streaming turn over `expo/fetch`, automatic plain-request fallback with the same idempotency key, classified errors.
- **State** `hooks/v2/chart/askChartState.ts` (pure reducer) + `useAskChart.ts`: ordered one-at-a-time sends, optimistic messages with stable keys, per-message retry that reuses its key, queue pauses behind a failure, cancel, greet-once, restore, auto-retry on foreground.
- **UI** `components/v2/chart/ask/`: `AskChartView` (shared), `AskMessageRow`, `AskSuggestions`, `AskComposer`, `AskAnchorAvatar` (+ breathing thinking halo), `askChartTheme` (category-derived colours; contrast tested for all categories), `ChartCreationAsk`.
- **Creation flow**: `intro → ask → generating → review → …`. The starting-photo screen, written-question screen and follow-up sheet are removed (`ChartContextStep`, `ChartRealityInput`, `ChartReferenceTray` deleted). Entrance cross-fades into the conversation (190 ms out, 230 ms in, instant under reduced motion). Plans go through the existing `POST /chart/plan`; review, save and the map reveal are the existing code. "Draft my route now" gives an early draft.
- **Ongoing**: `V2ChartAskScreen` registered as `V2ChartAsk` (accepts a seeded `prompt`). Nothing links to it yet (Phase 6).
- **Not in this phase**: microphone and attach buttons (Phase 4), proposal cards and Route Updated (Phase 5), sheet entry and coaching-style/memory UI (Phase 5/6).

## 10. Phase 4 (voice and photos) status — 2026-10-21

Not committed. **Not yet exercised on a device**: the microphone, camera, system photo picker, waveform motion and the attach sheet are verified by tests with mocked native modules only.

- **Photos, server**: `POST /api/v2/anchors/:id/chart/ask/photo`. Re-encodes to JPEG (EXIF/location dropped, long edge 1600), stores privately tagged `purpose: ask-chart`, deletes after 24 h (lazy per-user purge on upload, `purgeChartData` job, and immediately when a conversation is cleared). Never touches Vision-referenced assets. Own 8 MB body limit.
- **Photos, app**: camera or library, resize/compress on device (`expo-image-manipulator`), upload with real progress, retry a failure, remove, preview full screen, max 3 per message, send held until every photo is ready, thumbnails in the sent message. In-screen attach sheet (no Modal; back and outside-tap close it).
- **AI-requested photo**: the assistant's `requestPhoto` shows Take photo / Choose photo / Continue without a photo under that message only, and goes away when answered, waved off or a photo is attached. Never required.
- **Voice**: `expo-speech-recognition` (the Vision dictation stack). Mic shown only where recognition is available. Record → animated recorder with duration and a 28-bar waveform fed by the recogniser's volume events (calm idle motion if the device reports no level) → ✓ puts the words in the composer to edit, ✗ discards. Never auto-sends. Heard words survive errors, backgrounding and the 2-minute cap; one-time disclosure; permission denial explained with Settings.
- **Live multimodal check** (`scripts/evaluate-ask-chart.ts --image-check --run`): gpt-5.4-mini and gemini-3.5-flash both read a number off a generated photo and, asked if the car was safe/structurally sound, refused to judge from a photo and pointed to a mechanic.
- **Tests added**: 20 backend (photos, route), ~60 mobile (dictation, attachments, recorder, sheet, composer integration, creation screen).

## 11. Phase 5 (proposals, Route Updated, settings) and Phase 6 (navy sheet) status — 2026-10-21

Not committed. Verified by tests and the type checker only; nothing has run on a device.

- **Proposal cards** (`AskProposalCard`, `useAskProposals`): suggested moves are approved with "Add to my Chart" (server applies what it stored, then the saved Chart is published to the shared cache, then Route Updated opens) or dismissed. A stale or failed save shows nothing as saved. Suggested route changes open the existing Adjust Route review on that proposal (`GET /charts/:courseId/proposals/:proposalId`, `V2ChartAdjust` params `proposalId`, `askMessageId`); the message is marked applied only after the server records the proposal as accepted.
- **Route Updated** (`ChartRouteUpdated`, `V2ChartRouteUpdated`): real Anchor, category ring, pulse into a check, then copy built from what was actually saved. About 1 s, controls live from frame one, reduced-motion path, one success haptic. Shown after approved move additions and after any applied route revision (Ask Chart or Adjust Route); not after a no-op apply.
- **Settings** (`AskSettingsSheet`, `useAskProfile`): coaching style, review/correct/forget remembered preferences, clear conversation (deletes its photos).
- **Navy sheet (Phase 6, minimal)**: a "Help me move forward" row and the person's own Anchor (tap → existing Anchor Details) in the half tier of the sheet. The existing Practice row already launches Focus and returns through `returnRoute`.
- **Not done**: the full navy-sheet hierarchy rework (removing repeated labels, collapsible route section, reordering). It touches `ChartWaypointContent` (1,268 lines) and its gesture/scroll tiers, so it needs on-device review before it is attempted. Also not done: conversational (free-chat) revision inside the creation route review; it still uses the existing Adjust panel.

## 12. Device verification — 2026-10-22 (Moto G Play 2024, Android, dev-client build, local backend + disposable Postgres)

Verified on the device against the real model (`gpt-5.4-mini`, streamed): Chart sheet shows "Help me move forward" with the person's Anchor; Ask Chart opens with an unprompted greeting grounded in the Chart; suggestion chips send turns and stream replies (2.0–3.9 s server latency); a proposal card ("Add to my Chart") rendered; approving it saved server-side, showed Route Updated only after the save, and the Chart then read "0 of 3 moves done" (was 1). The Chart board was visually unchanged.

**Not verified on device**: microphone and waveform, camera/library photos and AI-requested photos, settings sheet, creation flow (Entrance → Ask → review), keyboard behaviour, reduced-motion path. Frame timing in this dev build during streaming: p50 17 ms, p90 30 ms (19 frames, 42% janky) — a development build over Metro, not a release measurement; no release-build 60 FPS claim is made.

Environment notes: local QA used a temporary dev-master auth override (reverted, not committed) and a short-path build copy because of Windows path-length limits in Reanimated's CMake build. The Ask Chart migration has not been applied to any shared database.
