import { useEffect } from "react";

import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { usePracticeEntry } from "@/hooks/usePracticeEntry";
import { useAnchorStore } from "@/stores/anchorStore";
import { useNavigationResumeStore } from "@/stores/navigationResumeStore";
import { ENABLE_VISUALIZE } from "@/config";

export const ResumeTargetHandler: React.FC = () => {
  const { navigateToPractice } = useTabNavigation();
  const { startPractice } = usePracticeEntry();
  useEffect(() => {
    const target = useNavigationResumeStore.getState().consumeTarget();
    if (!target) return;
    if (
      ENABLE_VISUALIZE &&
      target.kind === "visualize_prepare"
    ) {
      // An existing anchor means the canonical helper owns the outcome,
      // including a paywall redirect. Do not add a second Practice navigation
      // after that helper has already handled the request.
      if (useAnchorStore.getState().getAnchorById(target.anchorId)) {
        startPractice({
          mode: "visualize",
          anchorId: target.anchorId,
          source: "shortcut",
        });
        return;
      }
    }
    navigateToPractice();
  }, [navigateToPractice, startPractice]);
  return null;
};
