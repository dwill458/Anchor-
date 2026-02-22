import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather, Target, Flame, Sparkles, Lock } from 'lucide-react-native';

import type { PracticeStackParamList, Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';

import { RitualScaffold } from '@/screens/rituals/components/RitualScaffold';
import { RitualTopBar } from '@/screens/rituals/components/RitualTopBar';
import { useNavigation } from '@react-navigation/native';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { StackNavigationProp } from '@react-navigation/stack';

type EvolveNavProp = StackNavigationProp<PracticeStackParamList, 'Evolve'>;

type PathKey = 'grounding' | 'focus' | 'release' | 'integration';

type PathCardModel = {
  key: PathKey;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const GlassCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => {
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.card, style]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.cardInner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.androidCard, style]}>
      <View style={styles.cardInner}>{children}</View>
    </View>
  );
};

export const EvolveScreen: React.FC = () => {
  const navigation = useNavigation<EvolveNavProp>();
  const { navigateToVault } = useTabNavigation();
  const user = useAuthStore((state) => state.user);
  const getActiveAnchors = useAnchorStore((state) => state.getActiveAnchors);

  const activeAnchors = getActiveAnchors();
  const hasAnchors = activeAnchors.length > 0;
  const mostRecentAnchor = useMemo(() => {
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

  const isPro = user?.subscriptionStatus === 'pro' || user?.subscriptionStatus === 'pro_annual';

  const statsLine = useMemo(() => {
    const total = user?.stabilizesTotal ?? 0;
    const effectiveStreak = getEffectiveStabilizeStreakDays(
      user?.stabilizeStreakDays ?? 0,
      toDateOrNull(user?.lastStabilizeAt)
    );
    return `Stabilizes: ${total} • Streak: ${effectiveStreak} ${effectiveStreak === 1 ? 'day' : 'days'}`;
  }, [user?.lastStabilizeAt, user?.stabilizeStreakDays, user?.stabilizesTotal]);

  const paths: PathCardModel[] = useMemo(() => ([
    {
      key: 'grounding',
      title: 'Grounding',
      description: 'Stabilize variants, longer resets.',
      icon: <Feather color={colors.gold} size={22} />,
    },
    {
      key: 'focus',
      title: 'Focus',
      description: 'Activation sessions, timers, mantras.',
      icon: <Target color={colors.gold} size={22} />,
    },
    {
      key: 'release',
      title: 'Release',
      description: 'Burn ritual, closure ceremonies.',
      icon: <Flame color={colors.gold} size={22} />,
    },
    {
      key: 'integration',
      title: 'Integration',
      description: 'Pattern tracking + insights.',
      icon: <Sparkles color={colors.gold} size={22} />,
    },
  ]), []);

  const navigateToCreateAnchor = () => {
    navigateToVault('CreateAnchor');
  };

  const navigateToStabilize = (anchor: Anchor | undefined) => {
    if (!anchor) {
      navigateToCreateAnchor();
      return;
    }
    navigation.navigate('StabilizeRitual', { anchorId: anchor.id });
  };

  const navigateToReconnect = (anchor: Anchor | undefined) => {
    if (!anchor) {
      navigateToCreateAnchor();
      return;
    }

    navigateToVault('Ritual', { anchorId: anchor.id, ritualType: 'focus' });
  };

  return (
    <RitualScaffold showOrbs overlayOpacity={0.5} contentStyle={styles.safeArea}>
      <RitualTopBar onBack={() => navigation.goBack()} title="Evolve" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>Expand Your Sanctuary.</Text>
          <Text style={styles.stats}>{statsLine}</Text>
        </View>

        <View style={styles.pathList}>
          {paths.map((path, index) => (
            <Animated.View
              key={path.key}
              entering={FadeInDown.delay(index * 80).duration(420)}
            >
              <GlassCard>
                <View style={styles.pathHeaderRow}>
                  <View style={styles.pathIcon}>{path.icon}</View>
                  <View style={styles.pathText}>
                    <Text style={styles.pathTitle}>{path.title}</Text>
                    <Text style={styles.pathDesc}>{path.description}</Text>
                  </View>
                  {!isPro && (path.key === 'grounding' || path.key === 'focus') ? (
                    <View style={styles.proPill}>
                      <Text style={styles.proPillText}>PRO</Text>
                    </View>
                  ) : null}
                </View>

                {path.key === 'grounding' ? (
                  <View style={styles.actionsRow}>
                    <ActionChip
                      label="Stabilize (30s)"
                      onPress={() => navigateToStabilize(mostRecentAnchor)}
                      emphasized
                    />
                    <ActionChip
                      label="Longer Reset (2m)"
                      onPress={() => {}}
                      locked={!isPro}
                      disabled
                    />
                  </View>
                ) : path.key === 'focus' ? (
                  <View style={styles.actionsRow}>
                    <ActionChip
                      label="Reconnect"
                      onPress={() => navigateToReconnect(mostRecentAnchor)}
                      emphasized
                    />
                    <ActionChip label="Mantra Timer (5m)" onPress={() => {}} locked={!isPro} disabled />
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    <ActionChip label="Coming soon" onPress={() => {}} disabled />
                  </View>
                )}

                {!hasAnchors ? (
                  <View style={styles.helperRow}>
                    <Text style={styles.helperText}>
                      Create an anchor to begin these paths.
                    </Text>
                    <TouchableOpacity
                      onPress={navigateToCreateAnchor}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Create anchor"
                      style={styles.helperButton}
                    >
                      <Text style={styles.helperButtonText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </GlassCard>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </RitualScaffold>
  );
};

const ActionChip: React.FC<{
  label: string;
  onPress: () => void;
  emphasized?: boolean;
  locked?: boolean;
  disabled?: boolean;
}> = ({ label, onPress, emphasized = false, locked = false, disabled = false }) => {
  const isDisabled = disabled || locked;
  return (
    <TouchableOpacity
      onPress={isDisabled ? undefined : onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.actionChip,
        emphasized && styles.actionChipEmphasized,
        isDisabled && styles.actionChipDisabled,
      ]}
    >
      <View style={styles.actionChipRow}>
        {locked ? <Lock color={colors.text.tertiary} size={14} /> : null}
        <Text
          style={[
            styles.actionChipText,
            emphasized && styles.actionChipTextEmphasized,
            isDisabled && styles.actionChipTextDisabled,
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    paddingBottom: spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  stats: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.95,
  },
  pathList: {
    gap: spacing.md,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    backgroundColor: 'rgba(15, 20, 25, 0.55)',
  },
  androidCard: {
    backgroundColor: 'rgba(12, 17, 24, 0.92)',
  },
  cardInner: {
    padding: spacing.lg,
  },
  pathHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  pathIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  pathText: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 18,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    marginBottom: 2,
  },
  pathDesc: {
    fontSize: 13,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  proPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  proPillText: {
    fontSize: 10,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 1.4,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionChipEmphasized: {
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  actionChipDisabled: {
    opacity: 0.55,
  },
  actionChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionChipText: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.bone,
  },
  actionChipTextEmphasized: {
    color: colors.gold,
  },
  actionChipTextDisabled: {
    color: colors.text.tertiary,
  },
  helperRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperText: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    flex: 1,
    marginRight: spacing.md,
  },
  helperButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  helperButtonText: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
