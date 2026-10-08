# Codex Prompt — Vision Fix Pass 2 + OpenAI as Primary Image Provider

**Context:** On-device test, Oct 7, 2026, ~8:00 PM CT. Four problems: (1) the Vision never saves, (2) the prints flicker while developing, (3) there's no sound in the ceremony, (4) the image quality is poor. Each diagnosis below comes from Railway production logs and the local code.
**Scope:** `backend/` and `anchor/mobile/src`.

---

## 0. Ship the backend first (this alone fixes the save)

**Evidence:** Railway production logs, 2026-10-08 01:01 UTC. Every `POST /api/v2/anchors/:id/vision` at Seal returned **400 `VALIDATION_ERROR`** (5 attempts: 01:01:01, :05, :06, :07, :08). The description-only `POST` at 00:59:48 returned 201.

**Cause:** the `caption` field from the ceremony prompt exists only in the local working tree. `git diff HEAD` shows `backend/prisma/schema.prisma` (+1) and `backend/src/domain/v2/vision.ts` (+2) uncommitted. Production (deployment `448a7d6f`, Oct 7 22:54 UTC) runs the old `CreateVisionSceneSchema`, which is `.strict()`, so it rejects any scene containing `caption`.

**Do:**
1. Commit the backend caption work: the schema, the migration `20261007000000_add_vision_scene_caption` plus its ROLLBACK file, `domain/v2/vision.ts` and `VisionService.ts`.
2. Push and deploy. Confirm in the Railway deploy logs that `prisma migrate deploy` applied `add_vision_scene_caption`.
3. Verify against production: a `POST /vision` whose `scenes[0]` includes `caption` returns 201.

**Don't** work around it by stripping `caption` on the client.

---

## 1. Flicker while developing (mobile)

**Evidence:** after the first candidate exists, every 2s poll (`GET …/scene-generation/:jobId`) returns **200 with a freshly signed R2 URL** (the deploy log shows `[Storage] R2 config` on every poll from 01:00:19). `VisionCeremony` passes `state.slots[i].imageUrl` straight into `VisionPrint`. `VisionPrint`'s `useEffect([uri])` resets `ink = 1`, `blur = 1` and `scale = 1.06` whenever `uri` changes, and `<Image source={{ uri }}>` reloads. So the print snaps back to dark and re-develops every 2 seconds. That's the flicker.

**Fix:**

| # | File | Change |
|---|------|--------|
| 1a | `ceremony/VisionCeremony.tsx` | Keep a `stableUrls` ref, a `Map<candidateId, string>`: the first `imageUrl` seen for a candidate wins and is never replaced for the life of the ceremony. Pass `stableUrls.get(slot.id) ?? slot.imageUrl` to `VisionPrint`. Key prints and the `developed` set by **candidate id / assetId**, never by URL. Apply the same rule to the URL handed to `arrival.begin` and to `savedImageUrl` (use the save response's URL once, then hold it). |
| 1b | `ceremony/VisionPrint.tsx` | Add a `revealKey: string` prop (candidate id or local photo key). Reset the reveal only when `revealKey` changes, not `uri`. If `uri` changes while `revealKey` is unchanged and the print has already developed, swap the source silently, with no ink/blur reset and no sound. |
| 1c | `ceremony/VisionPrint.tsx` (sheen) | Replace the hard 2.4s sweep with a slower, softer pass: a 4.8s loop, gradient peak opacity `#FFFFFF14` (was `24`), 900ms ease-in-out, then a 3.9s rest. Start it once per `revealKey`; don't restart it on re-render. |
| 1d | `useV2VisionSceneGeneration.ts` | Stop polling once both candidates are `SUCCEEDED` (or the job is terminal). The log shows polling continuing after the second image was done. |

Test: a job whose candidate URL changes on each poll renders exactly one reveal per candidate, and `revealSettle` plays once per candidate.

---

## 2. No sound (mobile)

**Cause:** `SoundPool.play` only plays sounds that have been prewarmed. The creation flow, Chart and Release all call `SoundPool.prewarm([...])` on mount (e.g. `AnchorCreationFlowScreen.tsx:225/236/239`); the Vision ceremony never does. A cold `play()` creates a temporary player. Short cues (`formTick`, `uiTap`) often finish or get stopped before playback is reached, and the looped `sealRise` / `formBed` start late or not at all. Every play is also gated on `useSettingsStore.soundEffectsEnabled`.

**Fix:**

| # | File | Change |
|---|------|--------|
| 2a | `ceremony/VisionCeremony.tsx` | On mount: `SoundPool.prewarm(['creation:uiTap','creation:anchorPulse','creation:formTick','creation:distillTick','creation:revealSettle','creation:formBed'])`. On entering Keep: prewarm `['creation:sealRise','creation:seal','creation:visionPin']`. On unmount: `SoundPool.releaseIdle([...those keys])`. |
| 2b | `ceremony/VisionEntrance.tsx` | No changes beyond 2a; it relies on the ceremony's prewarm. |
| 2c | Dev check | With `sfxLog` on, run the ceremony once and paste the `play key=creation:…` lines into the report. Every cue must show `playReached=true`, with no `drop=`. If you see `drop=gate-off`, the device setting is off; report that rather than "fixing" it. |

---

## 3. Image provider: OpenAI primary, Gemini fallback (backend)

The routing already exists: `services/image/ImageGenerationService.ts` reads `VISION_PRIMARY_PROVIDER` / `VISION_FALLBACK_PROVIDER`, and `adapters/OpenAIImageProviderAdapter.ts` is implemented (generations + edits with references). Production has `OPENAI_API_KEY` set and `VISION_PRIMARY_PROVIDER` set, and the logs show `gemini-3.1-flash-image` serving. Mostly config, plus two fixes:

| # | File | Change |
|---|------|--------|
| 3a | `OpenAIImageProviderAdapter.resolveSize` | Vision currently requests **`1024x1792`**, which is a DALL·E 3 size. GPT-Image models use their own size set (portrait has been `1024x1536`). Check the sizes `gpt-image-2.5-*` accepts against OpenAI's API docs, and use the supported portrait size closest to 4:5 / 2:3 for `type === 'vision'`. An invalid size fails every OpenAI call, and each failure silently falls back to Gemini. |
| 3b | `OpenAIImageProviderAdapter.resolveModel` | Vision default stays `gpt-image-2.5-flare`. If `request.referenceImages` includes an appearance (identity) reference ("Make it look like you"), use `OPENAI_VISION_REFERENCE_MODEL` (default **`gpt-image-2.5-sunburst`**), which OpenAI positions for reference preservation and editing. Log which model ran. Keep `estimatedCostPerImage` honest, or mark it `// TODO(pricing)` if it's unknown. |
| 3c | `VisionGenerationService.ts` (~L565) | The two candidates render **one after the other** (production: ~29s for #1, then ~9s for #2; the ceremony waited ~40s). Render both candidates concurrently (`Promise.allSettled` over the plan), keeping the per-candidate status writes, the retry-count guard and PARTIAL semantics. Each candidate still goes through `imageGenerationService.generate` with its own fallback. |
| 3d | Tests | `ImageGenerationService.test.ts`: with `VISION_PRIMARY_PROVIDER=openai`, `VISION_FALLBACK_PROVIDER=gemini`, an OpenAI failure falls back to Gemini and logs `fallbackUsed: true`. `OpenAIImageProviderAdapter.test.ts`: the vision size is a supported GPT-Image size, and an identity reference selects the reference model. `VisionGenerationService` test: both candidates start before either finishes. |

**Railway variables (set after OpenAI credits are loaded, then redeploy):**

```
VISION_PRIMARY_PROVIDER=openai
VISION_FALLBACK_PROVIDER=gemini
OPENAI_VISION_MODEL=gpt-image-2.5-flare
OPENAI_VISION_REFERENCE_MODEL=gpt-image-2.5-sunburst
```

Leave `VISION_AB_TEST_ENABLED` unset. Anchor generation (`ANCHOR_*_PROVIDER`) is out of scope; don't change it.

---

## 4. Acceptance criteria

- [ ] The backend caption work is committed and deployed, and the migration is applied in production. A Vision saves at Seal, and the board shows the image with its caption on Home and on the Vision screen.
- [ ] No print resets or re-develops after its first reveal, even though the URL changes on every poll. Polling stops once both candidates are done.
- [ ] Every ceremony cue logs `playReached=true` on device (log lines included in the report).
- [ ] Generation runs on `gpt-image-2.5-*`, and the `[OpenAIImageProviderAdapter] Generating … with gpt-image-2.5-…` line appears in Railway logs. A forced OpenAI failure falls back to Gemini.
- [ ] Both candidates render concurrently; the time from Create to Choose drops to roughly one image's generation time.
- [ ] `npx tsc --noEmit` (mobile and backend) and the vision/image Jest suites pass; real output is included.
