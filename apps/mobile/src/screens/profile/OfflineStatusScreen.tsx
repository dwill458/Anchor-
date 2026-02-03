/**
 * Anchor App - Offline Status Screen
 *
 * Displays connectivity and pending sync actions.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { ScreenHeader, ZenBackground } from '@/components/common';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useToast } from '@/components/ToastProvider';
import { colors, spacing, typography } from '@/theme';

const IS_ANDROID = Platform.OS === 'android';

const formatTimestamp = (timestamp: Date | string) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return format(date, 'PPp');
};

export const OfflineStatusScreen: React.FC = () => {
  const toast = useToast();
  const { isOnline, pendingActions, lastSyncedAt, isLoading } = useOfflineStatus();

  const pendingCount = pendingActions.length;
  const syncLabel = pendingCount > 0 ? `${pendingCount} action${pendingCount !== 1 ? 's' : ''} pending` : 'All synced';
  const connectionLabel = isOnline ? 'Online' : 'Offline';

  const helperText = useMemo(() => {
    if (!isOnline) return 'Connect to the internet to sync pending actions.';
    if (pendingCount === 0) return 'No pending actions detected.';
    return 'Sync will attempt to upload pending actions.';
  }, [isOnline, pendingCount]);

  const handleSyncNow = () => {
    if (!isOnline) {
      toast.info('Connect to the internet to sync.');
      return;
    }

    if (pendingCount === 0) {
      toast.info('No pending actions to sync.');
      return;
    }

    toast.info('Sync queue not configured yet.');
  };

  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ZenBackground />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Offline Status" subtitle="View actions waiting to sync." />

        <CardWrapper {...cardProps} style={styles.card}>
          <Text style={styles.cardTitle}>Connection</Text>
          <Text style={[styles.statusText, isOnline ? styles.statusOnline : styles.statusOffline]}>
            {connectionLabel}
          </Text>
        </CardWrapper>

        <CardWrapper {...cardProps} style={styles.card}>
          <Text style={styles.cardTitle}>Sync State</Text>
          <Text style={styles.statusText}>{syncLabel}</Text>
          <Text style={styles.cardText}>
            {lastSyncedAt ? `Last synced: ${formatTimestamp(lastSyncedAt)}` : 'Last synced: Not yet'}
          </Text>
        </CardWrapper>

        <CardWrapper {...cardProps} style={styles.card}>
          <Text style={styles.cardTitle}>Pending Actions</Text>
          {isLoading ? (
            <Text style={styles.cardText}>Checking for pending actions...</Text>
          ) : pendingCount === 0 ? (
            <Text style={styles.cardText}>No pending actions detected.</Text>
          ) : (
            pendingActions.map((action) => (
              <View key={action.id} style={styles.pendingRow}>
                <View style={styles.pendingDot} />
                <View style={styles.pendingContent}>
                  <Text style={styles.pendingTitle}>{action.type}</Text>
                  <Text style={styles.pendingMeta}>
                    {action.anchorLabel || action.anchorId || 'Unknown anchor'} - {formatTimestamp(action.timestamp)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </CardWrapper>

        <View style={styles.helperContainer}>
          <Text style={styles.helperText}>{helperText}</Text>
        </View>

        <TouchableOpacity
          style={styles.ctaWrapper}
          onPress={handleSyncNow}
          activeOpacity={0.85}
          disabled={!isOnline || pendingCount === 0}
        >
          <LinearGradient
            colors={[colors.gold, '#B8941F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.ctaButton,
              (!isOnline || pendingCount === 0) && styles.ctaButtonDisabled,
            ]}
          >
            <Text style={styles.ctaText}>Sync now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.85)' : 'rgba(26, 26, 29, 0.4)',
  },
  cardTitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  cardText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  statusText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
  },
  statusOnline: {
    color: colors.success,
  },
  statusOffline: {
    color: colors.error,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginRight: spacing.sm,
  },
  pendingContent: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
  },
  pendingMeta: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  helperContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  helperText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  ctaWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  ctaButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    fontWeight: '600',
  },
});
