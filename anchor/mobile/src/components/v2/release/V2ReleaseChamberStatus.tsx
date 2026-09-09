import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { V2Button } from '@/components/v2';
import { typography } from '@/theme/v2';
import { RELEASE_CEREMONY_CHAMBER_BG, RELEASE_COPY } from '@/constants/v2/release';

interface Props {
  variant: 'confirming' | 'failed';
  message?: string | null;
  retryable?: boolean;
  onRetry: () => void;
  /** Failed only: abandon the attempt and return to preflight for a fresh hold. */
  onDismiss?: () => void;
  testID?: string;
}

const INK = '#FBF9F4';
const MUTED = 'rgba(251, 249, 244, 0.62)';

/**
 * Calm status panel shown inside the Ceremony Chamber while a release is being
 * confirmed, or after a definitive failure. A timeout is never reported as
 * success or as "nothing changed" — the copy stays honest and offers a retry
 * that reuses the same idempotency key.
 */
export function V2ReleaseChamberStatus({
  variant,
  message,
  retryable = true,
  onRetry,
  onDismiss,
  testID,
}: Props) {
  const isFailed = variant === 'failed';

  return (
    <View style={styles.chamber} testID={testID ?? `v2-release-status-${variant}`}>
      <View style={styles.body}>
        {!isFailed && <ActivityIndicator color={INK} size="large" />}
        <Text style={styles.title} accessibilityRole="header">
          {isFailed ? RELEASE_COPY.errorTitle : RELEASE_COPY.ceremonyConfirming}
        </Text>
        <Text style={styles.detail}>
          {message ?? (isFailed ? RELEASE_COPY.errorDetail : RELEASE_COPY.ceremonyConfirmingDetail)}
        </Text>
      </View>

      <View style={styles.actions}>
        {(retryable || !isFailed) && (
          <V2Button variant="secondary" size="large" onPress={onRetry} testID="v2-release-status-retry">
            {isFailed ? RELEASE_COPY.retryCta : RELEASE_COPY.offlineRetryCta}
          </V2Button>
        )}
        {isFailed && onDismiss && (
          <V2Button
            variant="tertiary"
            size="large"
            onPress={onDismiss}
            testID="v2-release-status-dismiss"
          >
            {RELEASE_COPY.keepAnchorCta}
          </V2Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chamber: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: RELEASE_CEREMONY_CHAMBER_BG,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    ...typography.headingLG,
    color: INK,
    textAlign: 'center',
  },
  detail: {
    ...typography.bodyMD,
    color: MUTED,
    textAlign: 'center',
  },
  actions: {
    gap: 8,
  },
});
