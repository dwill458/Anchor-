import type { Anchor, ApiResponse } from "@/types";
import type { VisualizationScene } from "@/types/practice";
import { apiClient } from "./ApiClient";
import { isBackendAnchorId } from "./BackendAnchorService";
import { useVisualizationSceneStore } from "@/stores/visualizationSceneStore";
import { logger } from "@/utils/logger";

export const VISUALIZATION_SCENE_MAX_LENGTH = 180;
export const VISUALIZATION_SCENE_VERSION = "scene-v1";

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

interface SuggestionsResponse {
  suggestions: string[];
  source: "gemini" | "deterministic_fallback";
  version: string;
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

class VisualizationSceneService {
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

  async generate(
    anchor: Anchor,
    accountId: string,
  ): Promise<{
    scene: VisualizationScene;
    suggestions: string[];
    fallbackUsed: boolean;
  }> {
    let suggestions = buildFallbackSceneSuggestions(anchor);
    let source: VisualizationScene["generationSource"] =
      "deterministic_fallback";
    let version = VISUALIZATION_SCENE_VERSION;
    let fallbackUsed = true;
    if (isBackendAnchorId(anchor.id)) {
      try {
        const response = await apiClient.post<ApiResponse<SuggestionsResponse>>(
          `/api/anchors/${anchor.id}/visualization-scene/suggestions`,
          {},
        );
        if (response.data.data?.suggestions?.length) {
          suggestions = response.data.data.suggestions;
          source = response.data.data.source;
          version = response.data.data.version;
          fallbackUsed = source === "deterministic_fallback";
        }
      } catch {
        // The deterministic fallback is deliberately silent and usable offline.
      }
    }
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
    store.setSuggestions(anchor.id, suggestions);
    store.setScene(scene);
    await this.save(anchor, scene);
    return {
      scene: useVisualizationSceneStore.getState().scenes[anchor.id] ?? scene,
      suggestions,
      fallbackUsed,
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
