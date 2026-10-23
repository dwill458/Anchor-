import React, { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartCourseReviewScreen } from "@/components/v2/chart/ChartCourseReviewScreen";
import type { DraftWaypoint } from "@/components/v2/chart/ChartRouteEditor";

/** Development-only rendering fixture using the milestones from the live planning evaluation. No API writes. */
export function ChartCourseReviewFixture({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [oneMove, setOneMove] = useState(
    "Message current users for feedback, then note what keeps them subscribed and where they get stuck.",
  );
  const [waypoints, setWaypoints] = useState<DraftWaypoint[]>(() =>
    [
      "Understand why paying users stay",
      "Hold a better first month for new users",
      "Find one repeatable acquisition channel",
      "Support steady monthly growth",
      "Reach 10,000 paying users",
    ].map((title, index) => ({
      key: `review-fixture-${index}`,
      title,
      rationale: null,
      kind: "MILESTONE",
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
    })),
  );
  return (
    <ChartCourseReviewScreen
      destination="Anchor has 10,000 paying users acquired mainly through App Store search, ranking top 10 in downloads"
      waypoints={waypoints}
      onWaypointsChange={setWaypoints}
      oneMove={oneMove}
      onOneMoveChange={setOneMove}
      guidance="Start with retention, then build an acquisition process you can repeat while keeping support manageable."
      topInset={insets.top}
      saving={false}
      canConfirm
      onAdjust={onClose}
      onConfirm={onClose}
    />
  );
}
