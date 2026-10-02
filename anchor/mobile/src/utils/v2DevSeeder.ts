import { Image } from 'react-native';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { primeVisionRead } from '@/hooks/v2/vision/useV2Vision';
import { primeAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { rememberV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { useCreationStore } from '@/stores/v2/creationStore';
import { createDeveloperMasterUser } from '@/utils/developerMasterAccount';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';
import { CATEGORY_TO_TIER, type Anchor } from '@/types';
import type { VisionReadModel, VisionSceneReadModel, V2VisionTile } from '@/adapters/v2/vision';
import type { CourseDetail } from '@/types/chart';

export const DEMO_ANCHOR_ID = 'demo-v2-anchor';

/**
 * Seeds a full demonstration Anchor with ready Vision board and Chart course.
 * Ensures the developer build immediately has complete data to test Home, Vision,
 * Chart, and Practice without needing backend setup or running through onboarding.
 */
export function seedV2DemoAnchor(): { anchorId: string } {
  // Ensure a development user is active so all account-scoped hooks resolve cleanly
  if (!useAuthStore.getState().user) {
    const devUser = createDeveloperMasterUser();
    useAuthStore.getState().setUser(devUser);
    useAuthStore.getState().setToken('developer-master-token');
    useAuthStore.getState().setHasCompletedOnboarding(true);
  }
  const accountId = useAuthStore.getState().user?.id ?? 'dev-master-account';
  const now = new Date();

  // Clear any existing stale creation drafts so Creation Flow opens fresh
  useCreationStore.getState().discard();

  // 1. Create Demo Anchor
  const demoAnchor: Anchor = {
    id: DEMO_ANCHOR_ID,
    localId: DEMO_ANCHOR_ID,
    userId: accountId,
    intentionText: 'Anchor has ten thousand active users',
    category: 'desire',
    distilledLetters: ['A', 'N', 'C', 'H', 'O', 'R'],
    baseSigilSvg: V2_SAMPLE_ANCHOR_SVGS.medium,
    structureVariant: 'balanced',
    planetaryTier: CATEGORY_TO_TIER['desire'],
    isCharged: true,
    activationCount: 5,
    chargeCount: 5,
    threadStrength: 72,
    createdAt: now,
    updatedAt: now,
  };

  useAnchorStore.getState().addAnchor(demoAnchor);
  useAnchorStore.getState().setCurrentAnchor(DEMO_ANCHOR_ID);

  // 2. Seed Vision
  const sources = [
    require('@/assets/vision/vision-future-desk.jpg'),
    require('@/assets/vision/vision-future-window.jpg'),
    require('@/assets/vision/vision-future-family.jpg'),
  ];
  const demoVisionId = `demo-vision-${DEMO_ANCHOR_ID}`;
  const scenes: VisionSceneReadModel[] = sources.map((src, idx) => ({
    id: `demo-scene-${idx}`,
    visionId: demoVisionId,
    assetId: `demo-asset-${idx}`,
    prompt: null,
    sourceType: 'AI_GENERATED',
    sortOrder: idx,
    resolvedImageUrl: Image.resolveAssetSource(src).uri,
    isArchived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));

  const demoVision: VisionReadModel = {
    id: demoVisionId,
    anchorId: DEMO_ANCHOR_ID,
    title: 'Ten thousand users living intentionally',
    description:
      'My app is thriving. I see ten thousand people using something I created, and I have the freedom to work by the ocean with my family.',
    status: 'ACTIVE',
    scenes,
    seenToday: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  primeVisionRead(DEMO_ANCHOR_ID, demoVision, accountId);
  primeVisionRead(DEMO_ANCHOR_ID, demoVision, null);
  primeVisionRead(DEMO_ANCHOR_ID, demoVision, 'developer');

  // Seed Today practice recommendation
  const demoRec = {
    anchorId: DEMO_ANCHOR_ID,
    completionSignal: null,
    vision: { exists: true, seenToday: false, visionId: demoVisionId },
    thread: {
      strength: 72,
      delta7d: 5,
      delta7dStatus: 'AVAILABLE' as const,
      status: 'AVAILABLE' as const,
    },
    recommendation: {
      action: 'Visualize' as const,
      reason: 'See what you are working toward today.',
    },
  };
  rememberV2RecommendationContext(DEMO_ANCHOR_ID, demoRec, accountId);
  rememberV2RecommendationContext(DEMO_ANCHOR_ID, demoRec, null);

  // 3. Seed Chart
  const demoChart: CourseDetail = {
    id: `demo-course-${DEMO_ANCHOR_ID}`,
    destinationText: 'My days reflect what I actually want',
    startingContext: 'Building Anchor with clarity and intention',
    anchorId: DEMO_ANCHOR_ID,
    visionId: demoVision.id,
    complexity: 'medium',
    currentMoveId: 'demo-move-1',
    status: 'ACTIVE',
    version: 1,
    currentWaypointId: 'demo-wp-2',
    waypointCount: 4,
    reachedCount: 1,
    plottedAt: now.toISOString(),
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    waypoints: [
      {
        id: 'demo-wp-1',
        courseId: `demo-course-${DEMO_ANCHOR_ID}`,
        position: 0,
        title: 'First 50 active daily testers',
        description: 'Test the complete Anchor 2.0 flow with real people.',
        state: 'REACHED',
        blockedReason: null,
        reachedAt: now.toISOString(),
        skippedAt: null,
        cancelledAt: null,
        anchorLink: null,
      },
      {
        id: 'demo-wp-2',
        courseId: `demo-course-${DEMO_ANCHOR_ID}`,
        position: 1,
        title: 'First 1,000 active members',
        description: 'Word of mouth spreading through intentional practice.',
        state: 'CURRENT',
        blockedReason: null,
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        anchorLink: null,
      },
      {
        id: 'demo-wp-3',
        courseId: `demo-course-${DEMO_ANCHOR_ID}`,
        position: 2,
        title: '5,000 members forming habits',
        description: 'Consistent morning ritual across thousands of days.',
        state: 'UPCOMING',
        blockedReason: null,
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        anchorLink: null,
      },
      {
        id: 'demo-wp-4',
        courseId: `demo-course-${DEMO_ANCHOR_ID}`,
        position: 3,
        title: '10,000 members living what matters',
        description: 'Self-sustaining movement toward meaningful goals.',
        state: 'UPCOMING',
        blockedReason: null,
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        anchorLink: null,
      },
    ],
    moves: [
      {
        id: 'demo-move-1',
        courseId: `demo-course-${DEMO_ANCHOR_ID}`,
        waypointId: 'demo-wp-2',
        title: 'Ship the Anchor 2.0 creation flow and vision experience',
        rationale: 'Give every tester the tactile experience of forming an Anchor.',
        source: 'USER',
        status: 'ACTIVE',
        position: 0,
        isCurrent: true,
        completedAt: null,
        createdAt: now.toISOString(),
      },
    ],
  };

  primeAnchorChart(DEMO_ANCHOR_ID, {
    anchor: {
      id: DEMO_ANCHOR_ID,
      intentionText: demoAnchor.intentionText,
      category: 'desire',
      enhancedImageUrl: null,
      released: false,
    },
    chart: demoChart,
    history: [],
    stats: { completedMoveCount: 1, practiceCount: 5 },
  });

  // 4. Mark onboarding complete & skip onboarding enabled
  useAuthStore.getState().setHasCompletedOnboarding(true);
  useSettingsStore.getState().setDeveloperSkipOnboardingEnabled(true);

  return { anchorId: DEMO_ANCHOR_ID };
}
