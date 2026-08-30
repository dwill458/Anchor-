import type { Anchor, ApiResponse } from "@/types";
import type { VisualizationScene } from "@/types/practice";
import { apiClient, ApiClientError } from "./ApiClient";
import { isBackendAnchorId } from "./BackendAnchorService";
import {
  normalizeSuggestionIndex,
  useVisualizationSceneStore,
} from "@/stores/visualizationSceneStore";
import { logger } from "@/utils/logger";

export const VISUALIZATION_SCENE_MAX_LENGTH = 180;
export const VISUALIZATION_SCENE_VERSION = "scene-v3";

const FALLBACKS: Record<string, string> = {
  career:
    "I move through an important task with steady attention, make a clear decision, and finish without rushing.",
  health:
    "I make the next supportive choice calmly and follow through with care for my body.",
  relationships:
    "I stay present in a meaningful conversation, listen fully, and respond with honesty and care.",
  creativity:
    "I begin the work without hesitation, stay with the process, and complete one clear piece of it.",
  spirituality:
    "I pause, return to what matters, and move through the moment with quiet awareness.",
  learning:
    "I meet a difficult part with curiosity, work through it steadily, and understand what comes next.",
  abundance:
    "I review what is in front of me calmly, make one grounded choice, and follow it through with care.",
  family:
    "I stay present in a shared moment, listen before reacting, and respond with warmth and steadiness.",
  adventure:
    "I meet the unfamiliar moment with open attention, choose the next useful step, and move forward confidently.",
  desire:
    "I recognize the moment to act, choose the behavior that matches my intention, and follow through steadily.",
  custom:
    "I enter a real moment that calls for this intention, choose the matching response, and follow through calmly.",
};

const intentionProofScene = (intentionText?: string): string | null => {
  const intention = intentionText?.toLowerCase() ?? '';
  if (/trust|decision|choose|choice|second-guess|confidence/.test(intention)) {
    return 'I name the choice in front of me, communicate it clearly, and move forward without second-guessing.';
  }
  if (/boundary|boundaries|say no|protect|limit/.test(intention)) {
    return 'I recognize the boundary I need, state it clearly, and stay steady when the moment asks me to bend it.';
  }
  if (/finish|follow through|discipline|consistent|habit|complete/.test(intention)) {
    return 'I begin the next useful step, stay with it when it becomes difficult, and finish what I came to do.';
  }
  if (/speak|communicat|honest|express|voice/.test(intention)) {
    return 'I say what I mean with a steady voice, stay connected to what matters, and respond with care.';
  }
  return null;
};

export function normalizeVisualizationSceneText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateVisualizationSceneText(value: string): string | null {
  const normalized = normalizeVisualizationSceneText(value);
  if (!normalized) return "Add a scene before beginning.";
  if (normalized.length > VISUALIZATION_SCENE_MAX_LENGTH) {
    return `Keep the scene to ${VISUALIZATION_SCENE_MAX_LENGTH} characters.`;
  }
  const sentenceCount = normalized
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  if (sentenceCount < 1 || sentenceCount > 2)
    return "Use one or two short sentences.";
  return null;
}

export function buildFallbackSceneSuggestions(
  anchor: Pick<Anchor, "category"> & { intentionText?: string },
): string[] {
  return [
    intentionProofScene(anchor.intentionText) ?? FALLBACKS[anchor.category] ?? FALLBACKS.custom,
    "I notice the moment this intention is needed, steady myself, and choose the response I want to make familiar.",
    "I move through a specific challenge with this intention guiding my posture, words, and next action.",
  ];
}

/**
 * Every string either side of the wire can produce deterministically.
 *
 * The backend keeps its own copy of this table and the two have drifted
 * (abundance, family, adventure, desire, and one generic variant differ), so a
 * scene saved before this release may hold either wording. Both are listed —
 * a missed entry means an anchor silently stays on canned text forever.
 */
const DETERMINISTIC_SCENE_TEXTS: ReadonlySet<string> = new Set(
  [
    // Shared by both services.
    ...Object.values(FALLBACKS),
    "I name the choice in front of me, communicate it clearly, and move forward without second-guessing.",
    "I recognize the boundary I need, state it clearly, and stay steady when the moment asks me to bend it.",
    "I begin the next useful step, stay with it when it becomes difficult, and finish what I came to do.",
    "I say what I mean with a steady voice, stay connected to what matters, and respond with care.",
    "I notice the moment this intention is needed, steady myself, and choose the response I want to make familiar.",
    "I move through a specific challenge with this intention guiding my posture, words, and next action.",
    // Backend-only wordings.
    "I review the choice in front of me, act with confidence, and use what I have with intention.",
    "I give the people in front of me my full attention and respond with patience and warmth.",
    "I take the next considered step, stay aware of my surroundings, and move with confidence.",
    "I recognize the next action that matches this intention and complete it with calm conviction.",
    "I move through a specific challenge with this intention already guiding my posture, words, and next action.",
  ].map(normalizeVisualizationSceneText),
);

/** True when the text is verbatim canned output rather than anything generated or written. */
export function isDeterministicSceneText(value: string): boolean {
  return DETERMINISTIC_SCENE_TEXTS.has(normalizeVisualizationSceneText(value));
}

/**
 * Failures worth another attempt later: the environment was wrong, not the
 * request. Everything else — the provider ran and produced nothing usable, or
 * rejected our credentials — stays terminal until SCENE_GENERATION_VERSION
 * changes, so we neither strand an anchor nor hammer a broken configuration.
 */
const RETRYABLE_UPGRADE_REASONS: ReadonlySet<VisualizationSceneFallbackReason> = new Set([
  "client_request_failed",
  "feature_disabled",
  "provider_timeout",
  "provider_rate_limited",
  "provider_unavailable",
]);

export const SCENE_UPGRADE_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Bump when the prompt, model, validation rules, or provider configuration
 * change in a way that could turn a previously terminal failure into a success.
 * Anchors whose last attempt was recorded under an older version become
 * eligible again automatically — no store migration needed.
 */
export const SCENE_GENERATION_VERSION = VISUALIZATION_SCENE_VERSION;

export function isRetryableUpgradeReason(
  reason: VisualizationSceneFallbackReason | null | undefined,
): boolean {
  return reason ? RETRYABLE_UPGRADE_REASONS.has(reason) : false;
}

interface SceneResponse {
  id: string;
  userId: string;
  anchorId: string;
  currentText: string;
  originalSuggestion: string;
  generationSource: VisualizationScene["generationSource"];
  generationVersion: string;
  clientUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Diagnostic-only. Never rendered. Mirrors the backend enum, plus the two reasons
 * only the client can observe (`feature_disabled`, `client_request_failed`).
 */
export type VisualizationSceneFallbackReason =
  | "feature_disabled"
  | "provider_not_configured"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_safety_blocked"
  | "provider_unavailable"
  | "provider_auth_error"
  | "provider_request_error"
  | "provider_unknown_error"
  /** @deprecated Emitted by backends older than the taxonomy split. Treated as terminal. */
  | "provider_error"
  | "malformed_response"
  | "insufficient_valid_scenes"
  | "client_request_failed";

export interface VisualizationSceneDiagnostics {
  source: "gemini" | "deterministic_fallback";
  fallbackReason: VisualizationSceneFallbackReason | null;
  promptVersion: string;
  model: string | null;
  latencyMs: number;
  rawCandidateCount: number;
  validCandidateCount: number;
}

interface SuggestionsResponse {
  suggestions: string[];
  source: "gemini" | "deterministic_fallback";
  version: string;
  fallbackReason?: VisualizationSceneFallbackReason | null;
  model?: string | null;
  latencyMs?: number;
  rawCandidateCount?: number;
  validCandidateCount?: number;
}

/** Low-cardinality latency bucket for analytics. */
export function visualizationLatencyBucket(latencyMs: number): string {
  if (latencyMs < 1000) return "<1s";
  if (latencyMs < 3000) return "1-3s";
  if (latencyMs < 8000) return "3-8s";
  return ">8s";
}

/**
 * A 403 FEATURE_DISABLED is a distinct diagnosis from a network failure: it means
 * ENABLE_VISUALIZE is off server-side, not that the provider misbehaved.
 */
export function classifyClientRequestFailure(
  error: unknown,
): VisualizationSceneFallbackReason {
  if (error instanceof ApiClientError && error.code === "FEATURE_DISABLED") {
    return "feature_disabled";
  }
  return "client_request_failed";
}

const toLocalScene = (
  remote: SceneResponse,
  accountId: string,
  anchorLocalId: string | null,
): VisualizationScene => ({
  id: remote.id,
  accountId,
  anchorId: remote.anchorId,
  anchorLocalId,
  currentText: remote.currentText,
  originalSuggestion: remote.originalSuggestion,
  generationSource: remote.generationSource,
  generationVersion: remote.generationVersion,
  clientUpdatedAt: remote.clientUpdatedAt,
  createdAt: remote.createdAt,
  updatedAt: remote.updatedAt,
  syncState: "synced",
});

export type GenerateResult = {
  scene: VisualizationScene;
  suggestions: string[];
  fallbackUsed: boolean;
  diagnostics: VisualizationSceneDiagnostics;
};

/**
 * `cached` means render what is stored right now. An attached `upgrade` promise
 * means a replacement batch is being fetched behind the rendered content — the
 * screen must not await it before showing the scene.
 */
export type EnsureBatchOutcome =
  | { kind: "cached"; upgrade?: Promise<GenerateResult> }
  | { kind: "generated"; result: GenerateResult };

class VisualizationSceneService {
  /**
   * One in-flight generation per anchor. A remount, a rapid double-tap, or two
   * effects racing all await the same promise instead of paying twice.
   */
  private inFlight = new Map<string, Promise<GenerateResult>>();

  async load(
    anchor: Anchor,
    accountId: string,
  ): Promise<VisualizationScene | null> {
    const store = useVisualizationSceneStore.getState();
    store.bindAccount(accountId);
    const local =
      store.scenes[anchor.id] ??
      (anchor.localId ? store.scenes[anchor.localId] : undefined);
    if (!isBackendAnchorId(anchor.id)) return local ?? null;
    try {
      const response = await apiClient.get<ApiResponse<SceneResponse | null>>(
        `/api/anchors/${anchor.id}/visualization-scene`,
      );
      if (!response.data.data) return local ?? null;
      const scene = toLocalScene(
        response.data.data,
        accountId,
        anchor.localId ?? null,
      );
      store.setScene(scene);
      return scene;
    } catch {
      return local ?? null;
    }
  }

  /** The persisted batch for an anchor, preferring the backend id key. */
  getSuggestions(anchor: Pick<Anchor, "id" | "localId">): string[] {
    const store = useVisualizationSceneStore.getState();
    return (
      store.suggestions[anchor.id] ??
      (anchor.localId ? store.suggestions[anchor.localId] : undefined) ??
      []
    );
  }

  getSelectedIndex(anchor: Pick<Anchor, "id" | "localId">): number {
    const store = useVisualizationSceneStore.getState();
    const batch = this.getSuggestions(anchor);
    const key = store.suggestions[anchor.id] !== undefined ? anchor.id : (anchor.localId ?? anchor.id);
    return normalizeSuggestionIndex(store.selectedSuggestionIndex[key], batch.length);
  }

  /**
   * Advances to the next cached suggestion with wraparound. Purely local:
   * no network, no provider request, works offline.
   */
  rotate(anchor: Pick<Anchor, "id" | "localId">): {
    text: string | null;
    index: number;
    count: number;
  } {
    const store = useVisualizationSceneStore.getState();
    const key =
      store.suggestions[anchor.id] !== undefined ? anchor.id : (anchor.localId ?? anchor.id);
    const text = store.rotateSuggestion(key);
    return {
      text,
      index: useVisualizationSceneStore.getState().selectedSuggestionIndex[key] ?? 0,
      count: this.getSuggestions(anchor).length,
    };
  }

  /**
   * Decides whether an anchor should get an attempt at a real batch.
   *
   * Anchors created before AI generation worked hold a canned scene. Without
   * this, seeding their batch from that text would strand them permanently,
   * because there is no regeneration control yet.
   *
   * Crucially this is consulted *even when a batch already exists*: a
   * deterministic batch is provisional, not a completed result.
   */
  shouldAttemptSceneUpgrade(
    anchor: Pick<Anchor, "id" | "localId">,
    scene: Pick<VisualizationScene, "currentText" | "generationSource"> | null,
    now: number = Date.now(),
  ): boolean {
    if (!scene) return false;
    // A user's own words are never replaced, whatever they happen to contain.
    if (scene.generationSource === "user_edited") return false;
    if (!isDeterministicSceneText(scene.currentText)) return false;

    const store = useVisualizationSceneStore.getState();
    const key = this.batchKey(anchor);

    // A real batch is a completed result; nothing to upgrade.
    if (store.batchSource[key] === "gemini") return false;

    const attempt = store.upgradeAttempts[key];
    if (!attempt) return true;
    // Bumping SCENE_GENERATION_VERSION makes prior terminal failures eligible
    // again — recovery without resetting every user's history via a migration.
    if (attempt.generationVersion !== SCENE_GENERATION_VERSION) return true;
    // The provider answered and still produced nothing usable, or rejected our
    // credentials. Retrying costs money and changes nothing until the version
    // moves. Only environmental failures get another turn.
    if (!attempt.retryable) return false;
    return (
      now - new Date(attempt.attemptedAt).getTime() >=
      SCENE_UPGRADE_RETRY_COOLDOWN_MS
    );
  }

  /** Prefers whichever id the batch is actually stored under. */
  private batchKey(anchor: Pick<Anchor, "id" | "localId">): string {
    const store = useVisualizationSceneStore.getState();
    return store.suggestions[anchor.id] !== undefined
      ? anchor.id
      : (anchor.localId ?? anchor.id);
  }

  private async runUpgrade(
    anchor: Anchor,
    accountId: string,
  ): Promise<GenerateResult> {
    const result = await this.generate(anchor, accountId);
    const reason = result.diagnostics.fallbackReason;
    useVisualizationSceneStore.getState().recordUpgradeAttempt(anchor.id, {
      retryable: result.fallbackUsed ? isRetryableUpgradeReason(reason) : false,
      reason: result.fallbackUsed ? (reason ?? null) : null,
      generationVersion: SCENE_GENERATION_VERSION,
    });
    return result;
  }

  /**
   * Resolves what the preparation screen should render, and whether a
   * non-blocking upgrade is running behind it.
   *
   * Ordering matters: the cache check must distinguish a completed batch from a
   * provisional deterministic one, or the retry ledger is never consulted and
   * a transient failure strands the anchor forever.
   */
  async ensureBatch(
    anchor: Anchor,
    accountId: string,
    scene?: VisualizationScene | null,
  ): Promise<EnsureBatchOutcome> {
    const hasBatch = this.getSuggestions(anchor).length > 0;
    const eligible = this.shouldAttemptSceneUpgrade(anchor, scene ?? null);

    if (hasBatch) {
      // Render the cached batch immediately either way; only start work behind it.
      return eligible
        ? { kind: "cached", upgrade: this.runUpgrade(anchor, accountId) }
        : { kind: "cached" };
    }

    const seedText = scene?.currentText;
    if (seedText) {
      // Seed first so the screen has something to show, then upgrade behind it.
      const seeded = Array.from(
        new Set([seedText, ...buildFallbackSceneSuggestions(anchor)]),
      ).slice(0, 3);
      useVisualizationSceneStore
        .getState()
        .setSuggestions(anchor.id, seeded, "seeded_legacy");
      return eligible
        ? { kind: "cached", upgrade: this.runUpgrade(anchor, accountId) }
        : { kind: "cached" };
    }

    // Nothing to render, so this one blocks.
    return { kind: "generated", result: await this.generate(anchor, accountId) };
  }

  async generate(anchor: Anchor, accountId: string): Promise<GenerateResult> {
    const pending = this.inFlight.get(anchor.id);
    if (pending) return pending;

    const request = this.runGenerate(anchor, accountId).finally(() => {
      this.inFlight.delete(anchor.id);
    });
    this.inFlight.set(anchor.id, request);
    return request;
  }

  private async runGenerate(
    anchor: Anchor,
    accountId: string,
  ): Promise<GenerateResult> {
    const startedAt = Date.now();
    let suggestions = buildFallbackSceneSuggestions(anchor);
    let source: VisualizationScene["generationSource"] =
      "deterministic_fallback";
    let version = VISUALIZATION_SCENE_VERSION;
    let fallbackUsed = true;
    // A local-only anchor was never eligible for provider generation.
    let fallbackReason: VisualizationSceneFallbackReason | null =
      "client_request_failed";
    let model: string | null = null;
    let latencyMs = 0;
    let rawCandidateCount = 0;
    let validCandidateCount = 0;

    if (isBackendAnchorId(anchor.id)) {
      try {
        const response = await apiClient.post<ApiResponse<SuggestionsResponse>>(
          `/api/anchors/${anchor.id}/visualization-scene/suggestions`,
          {},
        );
        const payload = response.data.data;
        if (payload?.suggestions?.length) {
          suggestions = payload.suggestions;
          source = payload.source;
          version = payload.version;
          fallbackUsed = source === "deterministic_fallback";
          fallbackReason = fallbackUsed ? (payload.fallbackReason ?? null) : null;
          model = payload.model ?? null;
          rawCandidateCount = payload.rawCandidateCount ?? 0;
          validCandidateCount = payload.validCandidateCount ?? 0;
          latencyMs = payload.latencyMs ?? Date.now() - startedAt;
        }
      } catch (error) {
        // The deterministic fallback is deliberately silent and usable offline —
        // but the reason is now recorded so the fallback rate is diagnosable.
        fallbackReason = classifyClientRequestFailure(error);
        latencyMs = Date.now() - startedAt;
      }
    }
    const diagnostics: VisualizationSceneDiagnostics = {
      source,
      fallbackReason,
      promptVersion: version,
      model,
      latencyMs,
      rawCandidateCount,
      validCandidateCount,
    };
    const now = new Date().toISOString();
    const sceneStore = useVisualizationSceneStore.getState();
    const existing =
      sceneStore.scenes[anchor.id] ??
      (anchor.localId ? sceneStore.scenes[anchor.localId] : undefined);
    const scene: VisualizationScene = {
      accountId,
      anchorId: anchor.id,
      anchorLocalId: anchor.localId ?? null,
      currentText: suggestions[0],
      originalSuggestion: existing?.originalSuggestion ?? suggestions[0],
      generationSource: source,
      generationVersion: version,
      clientUpdatedAt: now,
      syncState: "pending",
    };
    const store = useVisualizationSceneStore.getState();
    store.setSuggestions(
      anchor.id,
      suggestions,
      source === "gemini" ? "gemini" : "deterministic_fallback",
    );
    store.setScene(scene);
    await this.save(anchor, scene);
    return {
      scene: useVisualizationSceneStore.getState().scenes[anchor.id] ?? scene,
      suggestions,
      fallbackUsed,
      diagnostics,
    };
  }

  async save(
    anchor: Anchor,
    scene: VisualizationScene,
  ): Promise<VisualizationScene> {
    const validationError = validateVisualizationSceneText(scene.currentText);
    if (validationError) throw new Error(validationError);
    const pending = { ...scene, syncState: "pending" as const };
    const store = useVisualizationSceneStore.getState();
    store.setScene(pending);
    if (
      !isBackendAnchorId(anchor.id) ||
      store.tombstonedAnchorIds.includes(anchor.id)
    )
      return pending;
    try {
      const response = await apiClient.put<ApiResponse<SceneResponse>>(
        `/api/anchors/${anchor.id}/visualization-scene`,
        {
          currentText: pending.currentText,
          originalSuggestion: pending.originalSuggestion,
          generationSource: pending.generationSource,
          generationVersion: pending.generationVersion,
          clientUpdatedAt: pending.clientUpdatedAt,
        },
      );
      const remote = response.data.data;
      if (remote) {
        const synced = toLocalScene(
          remote,
          pending.accountId,
          pending.anchorLocalId,
        );
        store.setScene(synced);
        return synced;
      }
    } catch (error) {
      logger.warn("[VisualizationSceneService] Scene queued for later sync", {
        anchorId: anchor.id,
        reason: error instanceof Error ? error.name : "unknown",
      });
    }
    return pending;
  }

  async flushPending(anchors: Anchor[], accountId: string): Promise<void> {
    const store = useVisualizationSceneStore.getState();
    if (store.ownerAccountId !== accountId) return;
    for (const scene of Object.values(store.scenes)) {
      if (scene.syncState === "synced") continue;
      const anchor = anchors.find(
        (item) =>
          item.id === scene.anchorId || item.localId === scene.anchorLocalId,
      );
      if (anchor && !anchor.isReleased && !anchor.archivedAt)
        await this.save(anchor, scene);
    }
  }
}

export default new VisualizationSceneService();
