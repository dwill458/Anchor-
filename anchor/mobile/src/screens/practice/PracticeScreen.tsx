import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Anchor } from '@/types';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { ZenBackground } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';

// Practice Components
import { PracticeHeader } from './components/PracticeHeader';
import { StreakCard } from './components/StreakCard';
import { PracticeModeCard } from './components/PracticeModeCard';
import { UpgradeNudge } from './components/UpgradeNudge';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const PracticeScreen: React.FC = () => {
  console.log('DEBUG: PracticeScreen Rendered - REDESIGN ACTIVE');
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const { getActiveAnchors } = useAnchorStore();

  const activeAnchors = getActiveAnchors();
  const hasAnchors = activeAnchors.length > 0;
  const isPro = user?.subscriptionStatus === 'pro' || user?.subscriptionStatus === 'pro_annual';
  const streakCount = user?.currentStreak || 0;

  // Soft Tension Footer Logic
  const footerText = useMemo(() => {
    if (!isPro) return 'Your practice begins with a single anchor.';

    // Pro logic: check for stale anchors
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hasStaleAnchor = activeAnchors.some((a: Anchor) =>
      !a.lastActivatedAt || new Date(a.lastActivatedAt) < oneDayAgo
    );

    return hasStaleAnchor
      ? 'One anchor hasn’t been activated recently.'
      : 'Your strongest anchor is ready.';
  }, [isPro, activeAnchors]);

  const handleCreateAnchor = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CreateAnchor');
  };

  const handleActivateLast = () => {
    if (hasAnchors) {
      safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
      // Navigate to last activated or most recent anchor ritual
      const lastAnchor = activeAnchors[0]; // Assuming first is most recent
      navigation.navigate('Ritual', {
        anchorId: lastAnchor.id,
        ritualType: 'focus'
      });
    }
  };

  // Memory-based context for the last anchor
  const lastActivatedText = useMemo(() => {
    if (!hasAnchors) return 'A single moment of focus is enough.';
    const lastAnchor = activeAnchors[0];
    if (!lastAnchor.lastActivatedAt) return 'Ready for first activation.';

    const lastDate = new Date(lastAnchor.lastActivatedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Last rejoined moments ago.';
    if (diffHours < 24) return `Last rejoined ${diffHours}h ago.`;
    return `Last rejoined ${Math.floor(diffHours / 24)}d ago.`;
  }, [hasAnchors, activeAnchors]);

  // Today Context Logic (Simplified)
  const todayContext = useMemo(() => {
    const lines = ['clarity', 'momentum', 'integration', 'ease', 'focus'];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return lines[dayOfYear % lines.length];
  }, []);

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <PracticeHeader subhead="Return to your signal" />
            <View style={styles.todayTag}>
              <Text style={styles.todayText}>{todayContext}</Text>
            </View>
          </View>

          <StreakCard streakCount={streakCount} isPro={isPro} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isPro ? 'Practice Evolution' : 'Daily Practice'}
            </Text>

            {!isPro ? (
              <>
                <PracticeModeCard
                  title="Resume Ritual"
                  subtext={hasAnchors
                    ? lastActivatedText
                    : 'A single moment of focus is enough.'
                  }
                  cta={hasAnchors ? 'Reconnect' : undefined}
                  onPress={hasAnchors ? handleActivateLast : handleCreateAnchor}
                />
                <PracticeModeCard
                  title="Stabilize (30s)"
                  subtext="Breath, focus, and reset."
                  isLocked={true}
                  lockCopy="Deepen Practice"
                />
              </>
            ) : (
              <>
                <PracticeModeCard
                  title="Ignite"
                  subtext="Instant activation. Sharp focus."
                  meta="~10 seconds"
                  onPress={() => { }} // TODO: Navigate to Ignite ritual
                />
                <PracticeModeCard
                  title="Stabilize"
                  subtext="Breath, gaze, and grounding."
                  meta="30–60 seconds"
                  onPress={() => { }} // TODO: Navigate to Stabilize ritual
                />
                <PracticeModeCard
                  title="Deepen"
                  subtext="Guided ritual and visualization."
                  meta="5–10 minutes"
                  onPress={() => { }} // TODO: Navigate to Deepen ritual
                />
              </>
            )}
          </View>

          {!isPro && <UpgradeNudge />}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{footerText}</Text>
            {!isPro && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateAnchor}
              >
                <Text style={styles.createButtonText}>New Intent</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },
  todayTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  todayText: {
    fontSize: 10,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: spacing.lg,
  },
  createButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  createButtonText: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: colors.bone,
  },
});
