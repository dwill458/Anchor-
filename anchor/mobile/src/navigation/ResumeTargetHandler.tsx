import { useEffect } from "react";

import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { useAnchorStore } from "@/stores/anchorStore";
import { useNavigationResumeStore } from "@/stores/navigationResumeStore";
import { ENABLE_VISUALIZE } from "@/config";

export const ResumeTargetHandler: React.FC = () => {
  const { navigateToPractice, navigateToVault } = useTabNavigation();
  useEffect(() => {
    const target = useNavigationResumeStore.getState().consumeTarget();
    if (!target) return;
    const anchor = useAnchorStore.getState().getAnchorById(target.anchorId);
    if (
      ENABLE_VISUALIZE &&
      target.kind === "visualize_prepare" &&
      anchor &&
      !anchor.isReleased &&
      !anchor.archivedAt
    ) {
      navigateToVault("VisualizePreparation", {
        anchorId: anchor.id,
        source: "paywall_resume",
      });
      return;
    }
    navigateToPractice();
  }, [navigateToPractice, navigateToVault]);
  return null;
};
