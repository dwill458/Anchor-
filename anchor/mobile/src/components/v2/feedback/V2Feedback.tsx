import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, WifiOff } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';

export function V2ActivityIndicator({ label = 'Loading' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}>
      <ActivityIndicator color={colors.text.secondary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function V2Skeleton({
  width = '100%',
  height = 16,
  testID,
}: {
  width?: number | `${number}%`;
  height?: number;
  testID?: string;
}) {
  return <View testID={testID} accessibilityElementsHidden style={[styles.skeleton, { width, height }]} />;
}

export function V2InlineError({
  message,
  onRetry,
  offline = false,
}: {
  message: string;
  onRetry?: () => void;
  offline?: boolean;
}) {
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Icon size={18} color={colors.semantic.error} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Text accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          Try again
        </Text>
      ) : null}
    </View>
  );
}

export function V2EmptyState({
  title,
  message,
  action,
  gesture,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  gesture?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {gesture ? <View style={styles.emptyGesture}>{gesture}</View> : null}
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  loadingLabel: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
  skeleton: {
    borderRadius: radii.sm,
    backgroundColor: colors.grouped,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.md,
    backgroundColor: '#B63B3812',
    borderWidth: 1,
    borderColor: '#B63B3833',
  },
  errorText: {
    flex: 1,
    ...typography.bodySM,
    color: colors.text.primary,
  },
  retry: {
    ...typography.labelMD,
    color: colors.semantic.error,
    minHeight: 24,
    paddingVertical: 3,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
  },
  emptyGesture: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.displayBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: typography.utility.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: '#647188',
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyAction: {
    marginTop: 8,
  },
});
