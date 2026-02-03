/**
 * Anchor App - Export Data Screen
 *
 * Generates a JSON export of account and local data.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ScreenHeader, ZenBackground } from '@/components/common';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/components/ToastProvider';
import { colors, spacing, typography } from '@/theme';

const IS_ANDROID = Platform.OS === 'android';

const buildExportFilename = () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `anchor-data-export-${stamp}.json`;
};

const summarizeAnchors = (anchors: ReturnType<typeof useAnchorStore.getState>['anchors']) =>
  anchors.map((anchor) => ({
    id: anchor.id,
    intentionText: anchor.intentionText,
    category: anchor.category,
    structureVariant: anchor.structureVariant,
    isCharged: anchor.isCharged,
    activationCount: anchor.activationCount,
    lastActivatedAt: anchor.lastActivatedAt ?? null,
    chargedAt: anchor.chargedAt ?? null,
    createdAt: anchor.createdAt,
    updatedAt: anchor.updatedAt,
    enhancedImageUrl: anchor.enhancedImageUrl ?? null,
  }));

const buildSettingsSnapshot = (settings: ReturnType<typeof useSettingsStore.getState>) => ({
  defaultChargeType: settings.defaultChargeType,
  defaultChargeMode: settings.defaultChargeMode,
  defaultChargeDuration: settings.defaultChargeDuration,
  defaultActivationType: settings.defaultActivationType,
  autoOpenDailyAnchor: settings.autoOpenDailyAnchor,
  dailyPracticeGoal: settings.dailyPracticeGoal,
  reduceIntentionVisibility: settings.reduceIntentionVisibility,
  dailyReminderEnabled: settings.dailyReminderEnabled,
  dailyReminderTime: settings.dailyReminderTime,
  streakProtectionEnabled: settings.streakProtectionEnabled,
  weeklyReflectionEnabled: settings.weeklyReflectionEnabled,
  theme: settings.theme,
  accentColor: settings.accentColor,
  vaultView: settings.vaultView,
  mantraVoice: settings.mantraVoice,
  voiceStyle: settings.voiceStyle,
  hapticStrength: settings.hapticStrength,
  soundEffectsEnabled: settings.soundEffectsEnabled,
});

export const ExportDataScreen: React.FC = () => {
  const toast = useToast();
  const anchors = useAnchorStore((state) => state.anchors);
  const lastSyncedAt = useAnchorStore((state) => state.lastSyncedAt);
  const user = useAuthStore((state) => state.user);
  const profileData = useAuthStore((state) => state.profileData);

  const [isGenerating, setIsGenerating] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const isSignedIn = Boolean(user);

  const activationSummary = useMemo(() => {
    const totalActivations = anchors.reduce(
      (sum, anchor) => sum + (anchor.activationCount || 0),
      0
    );
    const lastActivatedAt = anchors.reduce<Date | null>((latest, anchor) => {
      if (!anchor.lastActivatedAt) return latest;
      if (!latest || anchor.lastActivatedAt > latest) return anchor.lastActivatedAt;
      return latest;
    }, null);

    return {
      totalActivations,
      lastActivatedAt,
    };
  }, [anchors]);

  const chargeSummary = useMemo(() => {
    const totalCharged = anchors.filter((anchor) => anchor.isCharged).length;
    const lastChargedAt = anchors.reduce<Date | null>((latest, anchor) => {
      if (!anchor.chargedAt) return latest;
      if (!latest || anchor.chargedAt > latest) return anchor.chargedAt;
      return latest;
    }, null);

    return {
      totalCharged,
      lastChargedAt,
    };
  }, [anchors]);

  const handleGenerateExport = async () => {
    setIsGenerating(true);
    setExportError(null);
    setExportPath(null);

    try {
      const settingsSnapshot = buildSettingsSnapshot(useSettingsStore.getState());
      const anchorMetadata = summarizeAnchors(anchors);
      const exportPayload = {
        generatedAt: new Date().toISOString(),
        signedIn: isSignedIn,
        profile: isSignedIn
          ? {
              user,
              stats: profileData?.stats ?? null,
              activeAnchors: profileData?.activeAnchors ?? null,
            }
          : null,
        anchors: anchorMetadata,
        activationsSummary: activationSummary,
        chargesSummary: chargeSummary,
        settings: settingsSnapshot,
        localOnly: isSignedIn
          ? null
          : {
              anchors,
              settings: settingsSnapshot,
            },
        sync: {
          lastSyncedAt,
        },
      };

      const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDirectory) {
        throw new Error('Storage not available');
      }

      const exportDirectory = `${baseDirectory}exports/`;
      await FileSystem.makeDirectoryAsync(exportDirectory, { intermediates: true });

      const fileUri = `${exportDirectory}${buildExportFilename()}`;
      const serialized = JSON.stringify(exportPayload, null, 2);
      await FileSystem.writeAsStringAsync(fileUri, serialized, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      setExportPath(fileUri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Share Anchor data export',
            UTI: 'public.json',
          });
        } catch {
          toast.info('Export saved to device.');
        }
      } else {
        toast.success('Export saved to device.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate export.';
      setExportError(message);
      toast.error('Unable to generate export.');
    } finally {
      setIsGenerating(false);
    }
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
        <ScreenHeader
          title="Export My Data"
          subtitle="Download a copy of your account data."
        />

        <CardWrapper {...cardProps} style={styles.card}>
          <Text style={styles.cardTitle}>Export Scope</Text>
          <Text style={styles.cardText}>
            {isSignedIn
              ? 'Your account and local data will be included.'
              : "You're not signed in. Export includes local data only."}
          </Text>
        </CardWrapper>

        <CardWrapper {...cardProps} style={styles.card}>
          <Text style={styles.cardTitle}>Included</Text>
          <Text style={styles.cardText}>- Anchor metadata ({anchors.length})</Text>
          <Text style={styles.cardText}>- Activation summary</Text>
          <Text style={styles.cardText}>- Charge summary</Text>
          <Text style={styles.cardText}>- Settings snapshot</Text>
          {!isSignedIn && (
            <Text style={styles.cardText}>- Local-only items (anchors + settings)</Text>
          )}
        </CardWrapper>

        {exportError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{exportError}</Text>
          </View>
        )}

        {exportPath && (
          <CardWrapper {...cardProps} style={styles.card}>
            <Text style={styles.cardTitle}>Export Ready</Text>
            <Text style={styles.cardText}>Saved to:</Text>
            <Text style={styles.pathText}>{exportPath}</Text>
          </CardWrapper>
        )}

        <TouchableOpacity
          style={styles.ctaWrapper}
          onPress={handleGenerateExport}
          activeOpacity={0.85}
          disabled={isGenerating}
        >
          <LinearGradient
            colors={[colors.gold, '#B8941F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaButton, isGenerating && styles.ctaButtonDisabled]}
          >
            {isGenerating ? (
              <View style={styles.ctaLoading}>
                <ActivityIndicator color={colors.charcoal} />
                <Text style={styles.ctaText}>Generating...</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>Generate Export</Text>
            )}
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
    marginBottom: 6,
  },
  errorCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.4)',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.error,
  },
  pathText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  ctaWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  ctaButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    fontWeight: '600',
  },
  ctaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
