import { apiClient } from "@/services/ApiClient";
import type { AnchorCategory, ApiResponse } from "@/types";
import type { FirstRunDraft } from "@/stores/v2/firstRunStore";

export type SavedOnboardingContext = {
  /**
   * Screen 3's "What matters most to you right now?" choice. Personalization context only —
   * it is never used as the category of the user's Anchors.
   */
  focusCategory?: AnchorCategory;
  /** Free-text motivation from the earlier onboarding; kept for drafts that still carry it. */
  motivation?: string;
  desiredChange: string;
  lifeChanges: string[];
  primaryNeed: string;
  customAnswer?: string;
};

export function buildOnboardingContext(
  draft: FirstRunDraft,
): SavedOnboardingContext {
  const motivation = (draft.motivation ?? "").trim();
  const focusCategory = draft.focusCategory;
  const customAnswer = draft.customDesiredChange?.trim();
  const desiredChange = (draft.desiredOutcome ?? "").trim();
  if (
    (!motivation && !focusCategory) ||
    (motivation === "Something else" && !customAnswer) ||
    !desiredChange ||
    !draft.lifeChanges?.length ||
    !draft.primaryNeed
  ) {
    throw new Error("Finish the onboarding questions before saving your progress.");
  }
  return {
    ...(focusCategory ? { focusCategory } : {}),
    ...(motivation ? { motivation } : {}),
    desiredChange,
    lifeChanges: draft.lifeChanges,
    primaryNeed: draft.primaryNeed,
    ...(motivation === "Something else" && customAnswer ? { customAnswer } : {}),
  };
}

export async function saveOnboardingContext(
  draft: FirstRunDraft,
): Promise<void> {
  const context = buildOnboardingContext(draft);
  if (__DEV__ && process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH === "true") return;
  const response = await apiClient.put<
    ApiResponse<{ hasCompletedOnboarding: boolean }>
  >("/api/auth/onboarding-context", context);
  if (!response.data?.success || !response.data.data?.hasCompletedOnboarding) {
    throw new Error("Your answers could not be saved. Please try again.");
  }
}
