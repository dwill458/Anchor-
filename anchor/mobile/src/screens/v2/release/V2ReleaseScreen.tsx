import React, { useCallback } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { V2Button, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import {
  V2DissolutionCeremony,
  V2HoldToReleaseControl,
  V2ReleaseChamberStatus,
  V2ReleaseCompletion,
  V2ReleaseConsequenceCard,
} from '@/components/v2/release';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useReleaseHold, useV2Release } from '@/hooks/v2/release';
import { RELEASE_COPY } from '@/constants/v2/release';
import { colors, spacing, typography } from '@/theme/v2';
import type { V2ReleaseAdapter } from '@/adapters/v2/release';
import type { V2ReleaseContinuationCallbacks, V2ReleaseRouteParams } from './releaseRoutes';

export interface V2ReleaseScreenProps
  extends Partial<V2ReleaseRouteParams>,
    V2ReleaseContinuationCallbacks {
  /** Injectable non-destructive release submission port. Defaults to the V2 API adapter. */
  releaseAdapter?: V2ReleaseAdapter;
  /** Integration may pass known Vision linkage (async to resolve). */
  hasLinkedVision?: boolean;
  testID?: string;
}

/**
 * Anchor 2.0 Release experience: preflight consequence snapshot → deliberate
 * 1.8s hold → consuming dissolution ceremony → idempotent non-destructive
 * submit → reconciliation + celebratory completion.
 *
 * Never calls the legacy destructive `/api/anchors/:id/burn` endpoint and never
 * deletes Anchor history or Course events.
 */
export function V2ReleaseScreen({
  anchorId = '',
  reason,
  releaseAdapter,
  hasLinkedVision,
  onReleaseCompleted,
  onCancel,
  testID,
}: V2ReleaseScreenProps) {
  const reduceMotion = useV2ReduceMotion();

  const release = useV2Release({
    anchorId,
    adapter: releaseAdapter,
    reason,
    hasLinkedVision,
  });

  const hold = useReleaseHold({
    reduceMotion,
    onComplete: release.startRelease,
    onCancel: () =>
      AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.cancelAnnouncement),
    onSustainStart: () =>
      AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.sustainAnnouncement),
  });

  const handleFreshHold = useCallback(() => {
    release.reset();
    hold.reset();
  }, [release, hold]);

  const handleComplete = useCallback(() => {
    onReleaseCompleted(anchorId);
  }, [onReleaseCompleted, anchorId]);

  if (release.anchorMissing || !release.snapshot) {
    return (
      <V2Screen testID={testID ?? 'v2-release-screen'}>
        <V2TopBar title="Release" onBackPress={onCancel} />
        <V2EmptyState
          title="Anchor unavailable"
          message="This Anchor is no longer available to release."
        />
      </V2Screen>
    );
  }

  const { snapshot, stage } = release;

  if (stage === 'dissolving') {
    return (
      <View style={styles.fill} testID={testID ?? 'v2-release-screen'}>
        <V2DissolutionCeremony
          artworkSvg={snapshot.artworkSvg}
          category={snapshot.category}
          reduceMotion={reduceMotion}
          onDissolutionComplete={release.markDissolutionComplete}
        />
      </View>
    );
  }

  if (stage === 'confirming') {
    return (
      <View style={styles.fill} testID={testID ?? 'v2-release-screen'}>
        <V2ReleaseChamberStatus
          variant="confirming"
          message={release.message}
          onRetry={release.retry}
        />
      </View>
    );
  }

  if (stage === 'failed') {
    return (
      <View style={styles.fill} testID={testID ?? 'v2-release-screen'}>
        <V2ReleaseChamberStatus
          variant="failed"
          message={release.message}
          retryable
          onRetry={handleFreshHold}
          onDismiss={onCancel}
        />
      </View>
    );
  }

  if (stage === 'completed') {
    return (
      <V2Screen testID={testID ?? 'v2-release-screen'}>
        <V2ReleaseCompletion
          intentionText={snapshot.intentionText}
          reduceMotion={reduceMotion}
          onPrimary={handleComplete}
          onSecondary={handleComplete}
        />
      </V2Screen>
    );
  }

  // Preflight shell — warm mineral canvas, consequence snapshot, hold target.
  return (
    <V2Screen testID={testID ?? 'v2-release-screen'}>
      <V2TopBar title="Release" onBackPress={onCancel} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        testID="v2-release-preflight"
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>{RELEASE_COPY.preflightKicker}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {RELEASE_COPY.preflightTitle}
          </Text>
          <Text style={styles.subtitle}>{RELEASE_COPY.preflightSubtitle}</Text>
        </View>

        <Text style={styles.intention} testID="v2-release-intention">
          “{snapshot.intentionText}”
        </Text>

        <View style={styles.holdArea}>
          <V2HoldToReleaseControl
            artworkSvg={snapshot.artworkSvg}
            category={snapshot.category}
            progress={hold.progress}
            isHolding={hold.isHolding}
            accessibilityLabel={snapshot.intentionText}
            onHoldStart={hold.beginHold}
            onHoldEnd={hold.endHold}
          />
        </View>

        <V2ReleaseConsequenceCard consequences={snapshot.consequences} />

        <V2Button
          variant="tertiary"
          size="large"
          onPress={onCancel}
          style={styles.keepButton}
          testID="v2-release-keep-active"
        >
          {RELEASE_COPY.keepAnchorCta}
        </V2Button>
      </ScrollView>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing[9],
    gap: spacing[5],
  },
  header: {
    gap: spacing[2],
  },
  kicker: {
    ...typography.labelSM,
    color: colors.text.secondary,
  },
  title: {
    ...typography.headingXL,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  intention: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  holdArea: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  keepButton: {
    marginTop: spacing[1],
  },
});
