# Anchor 2.0 — Multi-Provider Image Generation Architecture

This document describes the unified multi-provider image-generation architecture for Anchor 2.0.

Anchor generates two distinct types of imagery:
1. **Anchor artwork:** Fixed geometric sigil structure styled with artistic materials, textures, and lighting (1:1 aspect ratio).
2. **Vision imagery:** Emotionally specific, believable future-state scenes consumed primarily in a full-screen mobile portrait interface (9:16 aspect ratio).

Neither workload assumes that a single model or provider is optimal for both. The backend abstraction decouples Anchor's product logic from underlying AI providers, allowing models and providers to be changed without touching React Native client code or rewriting endpoints.

---

## 1. Architectural Overview

```
                               ANCHOR
                                  │
                                  ▼
                        ImageGenerationService
                                  │
               ┌──────────────────┴──────────────────┐
               ▼                                     ▼
             Gemini                                OpenAI
               │                                     │
       ┌───────┴───────┐                             │
       ▼               ▼                             ▼
 Nano Banana 2   Nano Banana Pro                 GPT Image
(Flash 3.1)       (Pro 3 Preview)            (2.5 Flare / Sunburst)
```

The application interacts exclusively with `ImageGenerationService` by specifying the generation **purpose** (`type: 'anchor' | 'vision'`) rather than calling Gemini or OpenAI directly.

### Core Component Structure

- **`ImageGenerationService`** (`backend/src/services/image/ImageGenerationService.ts`):
  Central orchestrator responsible for routing, fallback coordination, in-flight deduplication, deterministic A/B testing, timeout enforcement, and attempt telemetry.
- **`ImageProviderAdapter`** (`backend/src/services/image/types.ts`):
  Common interface implemented by each provider adapter:
  - `name: string`
  - `isAvailable(): boolean`
  - `generate(request: GenerateImageRequest, attemptNumber: number): Promise<{ images, model, estimatedCost }>`
- **`GeminiImageProviderAdapter`** (`backend/src/services/image/adapters/GeminiImageProviderAdapter.ts`):
  Google GenAI SDK adapter supporting Nano Banana 2 (`gemini-3.1-flash-image-preview` / `gemini-3.1-flash-image`) and Nano Banana Pro (`gemini-3-pro-image-preview`).
- **`OpenAIImageProviderAdapter`** (`backend/src/services/image/adapters/OpenAIImageProviderAdapter.ts`):
  Native HTTP adapter supporting OpenAI GPT-Image series (`gpt-image-2.5-flare` and `gpt-image-2.5-sunburst`), handling mobile portrait (`1024x1792`) and square (`1024x1024`) generation with b64_json decoding.

---

## 2. Provider Routing Strategy

| Purpose | Default Primary Provider | Default Fallback Provider | Rationale |
|---|---|---|---|
| **Anchor Artwork** (Initial Creation) | `gemini` (Nano Banana 2 / Flash) | `openai` (GPT-Image 2.5 Flare) | Economic efficiency ($0.005/image) with strict structural geometry preservation. |
| **Anchor Artwork** (Regeneration) | `gemini` (Nano Banana Pro) | `openai` (GPT-Image 2.5 Sunburst) | Higher fidelity reserved for user-initiated regeneration (`generationAttempt >= 2`). |
| **Vision Imagery** | `openai` (GPT-Image 2.5 Flare) | `gemini` (Nano Banana 2 / `gemini-3.1-flash-image`) | Superior prompt adherence, human rendering, documentary lighting, and emotional realism. |

Both primary and fallback providers are configurable via environment variables without code modification.

---

## 3. Fallback Rules & Error Handling

Fallback is **deliberate and controlled**. Not all failures trigger provider fallback:

### Failures that Trigger Automatic Fallback
- **Provider Outage / 5xx:** Upstream 500, 502, 503, or 504 status codes.
- **Timeouts:** API call exceeds client-side or gateway timeout thresholds.
- **Rate Limits (429 / Quota):** Upstream capacity saturation.
- **Network Errors:** `ECONNREFUSED`, `ENOTFOUND`, fetch disconnects.
- **Malformed Provider Responses:** Empty image payload, corrupted base64 data.

### Failures that DO NOT Fallback (Immediate Clean Failure)
- **Safety Filter Rejections (`SAFETY_FILTER`):** If a prompt violates content policies on provider A, routing it to provider B is prohibited to prevent policy abuse and loop churn.
- **Invalid Client Input (`INVALID_REQUEST`):** Malformed parameters, invalid aspect ratios, or prompt length violations.
- **Authentication Configuration Error (`AUTHENTICATION`):** Missing or invalid server credentials.

### Infinite Loop Prevention
- Maximum attempt count is strictly capped at **2** (Primary &rarr; Fallback).
- Providers are never re-queried in an infinite cycle.

---

## 4. Cost Protection & Anti-Double-Spend

Image generation carries direct marginal infrastructure cost. Anchor employs strict cost safeguards:

1. **In-Flight Request Deduplication:**
   `ImageGenerationService` tracks executing generation tasks keyed by `${purpose}:${userId}:${generationRequestId}`. Concurrent taps or rapid client retries attach to the in-flight Promise rather than firing duplicate paid requests.
2. **Deterministic Regeneration Gating:**
   Nano Banana Pro ($0.04/image) is strictly gated to `generationAttempt >= 2` (or explicit `pro_upgrade`). The initial anchor always uses Nano Banana 2 ($0.005/image).
3. **RevenueCat / Entitlement Enforcement:**
   `getMonetizationAccess(userId)` / `hasProAccess` verification occurs before any Vision generation job or candidate creation is queued.
4. **Per-Scene Retry Limit:**
   Vision sets are restricted to a maximum of 3 sets per anchor, with a maximum of 2 retries per set.

---

## 5. Vision Composition & Prompt Architecture

Vision images represent a person's desired future state and are viewed in full-screen vertical formats:
- **Mobile Portrait Composition:** Requests portrait output (`1024x1792` for OpenAI, `9:16` for Gemini).
- **Central Safe Area:** Main focal subject (person, hands, or key object) is placed within the central 70% width and 30%–70% height band.
- **Breathing Room:** Edges contain environment (sky, ceiling, table surface) that can be safely cropped across different mobile screen aspect ratios.
- **Anti-Stock Imagery Rules:**
  - No generic motivational stock clichés (e.g. Businessman on mountain peak, luxury cars, stacks of cash).
  - Editorial documentary photography with natural, available lighting and believable lived-in spaces.
  - Strict prohibition against generated typography, fake quotes, logos, UI controls, or watermarks.

---

## 6. Environment Variables & Model Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VISION_PRIMARY_PROVIDER` | `openai` | Primary provider for Vision imagery (`openai` or `gemini`). |
| `VISION_FALLBACK_PROVIDER` | `gemini` | Fallback provider for Vision imagery (`gemini` or `openai`). |
| `ANCHOR_PRIMARY_PROVIDER` | `gemini` | Primary provider for Anchor artwork (`gemini` or `openai`). |
| `ANCHOR_FALLBACK_PROVIDER` | `openai` | Fallback provider for Anchor artwork (`openai` or `gemini`). |
| `OPENAI_API_KEY` | *(Required for OpenAI)* | Server-side OpenAI API credential (never sent to client). |
| `OPENAI_VISION_MODEL` | `gpt-image-2.5-flare` | OpenAI model for Vision generation. |
| `OPENAI_ANCHOR_MODEL` | `gpt-image-2.5-flare` | OpenAI model for standard Anchor generation. |
| `OPENAI_ANCHOR_PREMIUM_MODEL` | `gpt-image-2.5-sunburst` | OpenAI model for premium Anchor regeneration. |
| `GEMINI_VISION_MODEL` | `gemini-3.1-flash-image` | Gemini model for Vision generation. |
| `GEMINI_ANCHOR_MODEL` | `gemini-3.1-flash-image-preview` | Gemini model for standard Anchor artwork (Nano Banana 2). |
| `GEMINI_ANCHOR_PREMIUM_MODEL` | `gemini-3-pro-image-preview` | Gemini model for Anchor regeneration (Nano Banana Pro). |
| `GEMINI_SCENE_PLANNER_MODEL` | `gemini-3.6-flash` | Text model used for planning the 8 Vision contact sheet scenes. |
| `VISION_AB_TEST_ENABLED` | `false` | When `true`, deterministically routes 50% of users to OpenAI and 50% to Gemini. |

---

## 7. Timeout & Retry Policy

| Layer | Timeout | Retry Policy |
|---|---|---|
| **Anchor Route (`/api/ai/enhance`)** | 180,000ms (3 min) | Express wrapper aborts hanging requests with HTTP 504. |
| **OpenAI Image API Call** | 90,000ms (Vision) / 60,000ms (Anchor) | 1 retry with exponential backoff on 429, then fallback to Gemini. |
| **Gemini Image API Call** | 90,000ms (Vision) / 60,000ms (Anchor) | Up to 3 internal retries with backoff on rate limit/network errors. |
| **Vision Job Stale Threshold** | 20 minutes (`STALE_AFTER_MS`) | Auto-marks interrupted server jobs as `FAILED` to allow user retry. |

---

## 8. Telemetry & Generation Metadata

Every generation produces internal structured telemetry records:
- `generationRequestId`: Distributed trace UUID.
- `type`: `'anchor'` or `'vision'`.
- `provider`: Primary provider utilized.
- `model`: Exact model ID invoked.
- `totalTimeSeconds`: Overall end-to-end execution duration.
- `costUSD`: Estimated marginal provider cost.
- `fallbackUsed`: Boolean indicating whether fallback was triggered.
- `sourceProvider`: Primary provider that initiated the request.
- `attempts`: Array of attempt logs with:
  - `attemptNumber`: 1 or 2
  - `provider`: Name of provider
  - `latencyMs`: Duration of attempt
  - `success`: Boolean status
  - `failureReason`: Error classification if failed

All provider secrets and raw payload dumps are excluded from analytics and client-facing responses.

---

## 9. How To Add Another Image Provider

Adding a new provider (e.g. AWS Bedrock, Flux, Midjourney API) requires only two steps:

1. **Implement `ImageProviderAdapter`** in `backend/src/services/image/adapters/YourProviderAdapter.ts`:
   ```typescript
   import { ImageProviderAdapter, GenerateImageRequest, GeneratedImageVariation } from '../types';

   export class YourProviderAdapter implements ImageProviderAdapter {
     readonly name = 'yourprovider';

     isAvailable(): boolean {
       return Boolean(process.env.YOUR_PROVIDER_API_KEY);
     }

     async generate(request: GenerateImageRequest, attemptNumber: number): Promise<{
       images: GeneratedImageVariation[];
       model: string;
       estimatedCost: number;
     }> {
       // 1. Format dimensions & prompt based on request.type ('anchor' vs 'vision')
       // 2. Execute upstream API call with AbortSignal timeout
       // 3. Return image buffers and cost
     }
   }
   ```

2. **Register the Adapter** in `backend/src/services/image/ImageGenerationService.ts`:
   ```typescript
   this.registerAdapter(new YourProviderAdapter());
   ```

No changes to React Native UI, Express routing, or database schemas are needed.
