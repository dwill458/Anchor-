import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { PracticeStackParamList } from '@/types';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { ZenBackground } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import { getDayDiffLocal, getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';

// Practice Components
import { PracticeHeader } from './components/PracticeHeader';
import { StreakCard } from './components/StreakCard';
import { PracticeModeCard } from './components/PracticeModeCard';
import { SanctuaryCandleIndicator } from './components/SanctuaryCandleIndicator';

type PracticeNavigationProp = StackNavigationProp<PracticeStackParamList, 'PracticeHome'>;

export const PracticeScreen: React.FC = () => {
  const navigation = useNavigation<PracticeNavigationProp>();
  const user = useAuthStore((state) => state.user);
  const { getActiveAnchors } = useAnchorStore();

  const activeAnchors = getActiveAnchors();
  const hasAnchors = activeAnchors.length > 0;
  const mostRecentAnchor = React.useMemo(() => {
    if (!hasAnchors) return undefined;

    const toMillis = (value?: Date | string): number => {
      if (!value) return 0;
      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };

    return [...activeAnchors].sort((a, b) => {
      const aRecency = Math.max(toMillis(a.lastActivatedAt), toMillis(a.updatedAt), toMillis(a.createdAt));
      const bRecency = Math.max(toMillis(b.lastActivatedAt), toMillis(b.updatedAt), toMillis(b.createdAt));
      return bRecency - aRecency;
    })[0];
  }, [activeAnchors, hasAnchors]);

  const now = new Date();
  const lastStabilizeAt = toDateOrNull(user?.lastStabilizeAt);
  const hasStabilizedToday = getDayDiffLocal(now, lastStabilizeAt) === 0;
  const stabilizeStreakDays = getEffectiveStabilizeStreakDays(
    user?.stabilizeStreakDays ?? 0,
    lastStabilizeAt,
    now
  );

  const handleCreateAnchor = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', { screen: 'CreateAnchor' });
  };

  const handleReconnect = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    if (!mostRecentAnchor) {
      handleCreateAnchor();
      return;
    }

    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', {
      screen: 'Ritual',
      params: { anchorId: mostRecentAnchor.id, ritualType: 'focus' },
    });
  };

  const handleStabilize = () => {
    safeHaptics.selection();
    if (!mostRecentAnchor) {
      handleCreateAnchor();
      return;
    }

    navigation.navigate('StabilizeRitual', { anchorId: mostRecentAnchor.id });
  };

  const handleEvolve = () => {
    safeHaptics.selection();
    navigation.navigate('Evolve');
  };

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
            <SanctuaryCandleIndicator isLit={hasStabilizedToday} streakDays={stabilizeStreakDays} />
          </View>

          <StreakCard streakDays={stabilizeStreakDays} hasStabilizedToday={hasStabilizedToday} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Practice</Text>

            <PracticeModeCard
              title="Resume Ritual"
              subtext="Pick up your thread."
              cta="Reconnect"
              onPress={handleReconnect}
            />

            <PracticeModeCard
              title="Stabilize (30s)"
              subtext="Breathe. Return. Seal the state."
              cta="Stabilize"
              onPress={handleStabilize}
            />

            <PracticeModeCard
              title="Expand Your Sanctuary"
              subtext="Unlock deeper rituals, pattern tracking, and longer sessions."
              cta="Evolve"
              onPress={handleEvolve}
            />
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
});
