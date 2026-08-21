import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import { Anchor15PrimaryButton, Anchor15Screen, Anchor15TextButton } from '@/components/anchor15';
import { OptimizedImage, SigilSvg } from '@/components/common';
import { DailyReminderPrompt } from '@/components/notifications';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useNotificationController } from '@/hooks/useNotificationController';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { finishChartAnchorPracticeHandoff } from '@/services/ChartAnchorHandoffService';
import { colors, typography } from '@/theme';
import type { RootStackParamList } from '@/types';
import { canViewChart } from '@/types/chart';

type PrimeRoute = RouteProp<RootStackParamList, 'PrimeYourAnchor'>;
type PrimeNavigation = StackNavigationProp<RootStackParamList, 'PrimeYourAnchor'>;
type FirstPracticeMode = 'focus' | 'deepPrime';

const MODE_COPY: Record<FirstPracticeMode, {
  title: string;
  duration: string;
  descriptor: string;
  teaching: string;
}> = {
  focus: {
    title: 'Focus', duration: '30 seconds', descriptor: 'Quick first return',
    teaching: 'A brief return to learn the form.',
  },
  deepPrime: {
    title: 'Deep Prime', duration: '2–10 minutes', descriptor: 'Guided depth',
    teaching: 'More time to settle your attention on the form.',
  },
};

/** The native first-prime bridge for a saved Anchor. */
export function PrimeYourAnchorScreen() {
  const navigation = useNavigation<PrimeNavigation>();
  const route = useRoute<PrimeRoute>();
  const anchor = useAnchorStore((state) => state.getAnchorById(route.params.anchorId));
  const chartContext = route.params.chartContext;
  const activeAccountId = useAuthStore((state) => state.user?.id ?? null);
  const activeChartFlags = useAuthStore((state) => state.user?.chartFlags);
  const activeChartCapabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const chartAvailable = canViewChart(activeChartFlags, activeChartCapabilities);
  // The producer records the account that owned the server-confirmed link.
  // Do not infer it from a later render: the auth account can switch while the
  // route is queued or while the notification reminder gate is open.
  const chartOriginAccountIdRef = useRef(
    chartContext ? route.params.chartOriginAccountId ?? null : null,
  );
  const { startPractice, isNavigationLocked } = usePracticeEntry();
  const { navigateToSanctuary, navigateToChart } = useTabNavigation();
  const [selectedMode, setSelectedMode] = useState<FirstPracticeMode>('focus');
  const breath = useRef(new Animated.Value(0)).current;
  const { canOfferFirstAnchorReminder } = useNotificationController();
  const [reminderVisible, setReminderVisible] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const safeFallbackDispatchedRef = useRef(false);

  const chartHandoffIsActive = useCallback(() => {
    if (!chartContext || !chartOriginAccountIdRef.current) return false;
    const user = useAuthStore.getState().user;
    return user?.id === chartOriginAccountIdRef.current &&
      canViewChart(user.chartFlags, user.chartCapabilities);
  }, [chartContext]);

  const returnToSafeAccountRoot = useCallback(() => {
    if (safeFallbackDispatchedRef.current) return;
    safeFallbackDispatchedRef.current = true;
    pendingActionRef.current = null;
    setReminderVisible(false);
    navigateToSanctuary();
  }, [navigateToSanctuary]);

  // This screen is the single first-anchor destination reached after saving an
  // Anchor (guest or signed-in), so it is the only remaining chance to ask for
  // notification permission before the user leaves the creation flow. Without
  // this, notificationPermissionStatus stays 'undetermined' forever and every
  // reminder rule silently refuses to schedule.
  const runWithReminderGate = useCallback(async (action: () => void) => {
    if (chartContext && !chartHandoffIsActive()) {
      returnToSafeAccountRoot();
      return;
    }
    const shouldOffer = await canOfferFirstAnchorReminder();
    if (chartContext && !chartHandoffIsActive()) {
      returnToSafeAccountRoot();
      return;
    }
    if (shouldOffer) {
      pendingActionRef.current = action;
      setReminderVisible(true);
      return;
    }
    action();
  }, [canOfferFirstAnchorReminder, chartContext, chartHandoffIsActive, returnToSafeAccountRoot]);

  const handleReminderDismiss = useCallback(() => {
    setReminderVisible(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  useEffect(() => {
    if (
      chartContext &&
      (!chartOriginAccountIdRef.current ||
        activeAccountId !== chartOriginAccountIdRef.current ||
        !chartAvailable)
    ) {
      returnToSafeAccountRoot();
    }
  }, [activeAccountId, chartAvailable, chartContext, returnToSafeAccountRoot]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 3000, useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 3000, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [breath]);

  const sigil = useMemo(
    () => anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '',
    [anchor?.baseSigilSvg, anchor?.reinforcedSigilSvg],
  );
  const expressionArtwork = anchor?.enhancedImageUrl;
  const selectedCopy = MODE_COPY[selectedMode];

  const leaveWithoutPractice = useCallback(() => {
    if (chartContext) {
      if (!chartHandoffIsActive()) {
        returnToSafeAccountRoot();
        return;
      }
      finishChartAnchorPracticeHandoff(chartContext.courseId, chartContext.waypointId, route.params.anchorId);
      navigation.popToTop();
      navigateToChart('WaypointDetail', {
        courseId: chartContext.courseId,
        waypointId: chartContext.waypointId,
      });
      return;
    }
    navigateToSanctuary();
  }, [chartContext, chartHandoffIsActive, navigateToChart, navigateToSanctuary, navigation, returnToSafeAccountRoot, route.params.anchorId]);

  if (!anchor) {
    return (
      <Anchor15Screen>
        <StatusBar style="light" />
        <View style={styles.missingWrap}>
          <Text style={styles.eyebrow}>ANCHOR FORGED</Text>
          <Text style={styles.missingTitle}>Your Anchor is safely waiting in Sanctuary.</Text>
          <Text style={styles.missingBody}>We could not reopen it from this link. Nothing has been discarded.</Text>
          <Anchor15PrimaryButton label={chartContext ? 'Return to Chart' : 'Go to Sanctuary'} onPress={leaveWithoutPractice} />
        </View>
      </Anchor15Screen>
    );
  }

  const beginSelectedPractice = () => {
    void runWithReminderGate(() => {
      if (chartContext) {
        if (!chartHandoffIsActive()) {
          returnToSafeAccountRoot();
          return;
        }
        navigation.popToTop();
      }
      startPractice({
        mode: selectedMode,
        anchorId: anchor.id,
        source: chartContext ? 'chart_waypoint_detail' : 'sanctuary_prime_anchor',
        durationSeconds: selectedMode === 'focus' ? 30 : undefined,
        ...(chartContext
          ? { chartContext }
          : { returnTarget: { kind: 'sanctuary' as const } }),
      });
    });
  };

  const practiceLater = () => {
    void runWithReminderGate(leaveWithoutPractice);
  };

  return (
    <Anchor15Screen style={styles.screen}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.goldGlow} />
      <View style={styles.topRow}>
        <Pressable onPress={leaveWithoutPractice} hitSlop={10} accessibilityRole="button" accessibilityLabel={chartContext ? 'Close and return to Chart' : 'Close and return to Sanctuary'} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.titlePill}><Text style={styles.titlePillText}>Prime Your Anchor</Text></View>
        <View style={styles.topBalance} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero} accessible={false}>
          <View style={styles.dottedRing} />
          <View style={styles.dashedRing} />
          <Animated.View style={[styles.sigilFrame, { transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }], opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]}>
            {expressionArtwork ? (
              <OptimizedImage uri={expressionArtwork} style={styles.artwork} resizeMode="cover" />
            ) : (
              <SigilSvg xml={sigil} width={136} height={136} color={colors.anchor15.giltBright} />
            )}
          </Animated.View>
        </View>

        <Text style={styles.eyebrow}>ANCHOR FORGED</Text>
        <Text style={styles.title}>The Work Begins Now</Text>
        <Text style={styles.subtitle}>You’ve set the meaning.{`\n`}Now return to the symbol.</Text>
        <Text style={styles.teaching}>The intention gave it meaning. Practice builds your connection to the form.</Text>
        <Text style={styles.sectionLabel}>CHOOSE YOUR FIRST PRACTICE</Text>

        <View style={styles.modeGrid}>
          {(Object.keys(MODE_COPY) as FirstPracticeMode[]).map((mode) => {
            const selected = selectedMode === mode;
            const copy = MODE_COPY[mode];
            return (
              <Pressable key={mode} onPress={() => setSelectedMode(mode)} accessibilityRole="radio" accessibilityLabel={`${copy.title}. ${copy.duration}. ${copy.descriptor}`} accessibilityState={{ selected }} style={[styles.modeCard, selected && styles.modeCardSelected]}>
                {selected && <View style={styles.modeCheck}><Text style={styles.modeCheckText}>✓</Text></View>}
                <View style={[styles.modeIcon, selected && styles.modeIconSelected]}><Text style={[styles.modeIconText, selected && styles.modeIconTextSelected]}>{mode === 'focus' ? 'ϟ' : '◌'}</Text></View>
                <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{copy.title}</Text>
                <Text style={styles.modeMeta}>{copy.duration}{`\n`}{copy.descriptor}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectedTeaching}>{selectedCopy.teaching}</Text>
      </ScrollView>

      <View style={styles.actions}>
        <Anchor15PrimaryButton label={`Begin ${selectedCopy.title} →`} onPress={beginSelectedPractice} disabled={isNavigationLocked} accessibilityHint="Starts your selected first practice" />
        <Text style={styles.hint}>{selectedCopy.duration} · You can stop anytime</Text>
        <Anchor15TextButton label="Practice later" onPress={practiceLater} accessibilityHint="Return to Sanctuary without starting a practice" />
      </View>

      <DailyReminderPrompt
        visible={reminderVisible}
        variant="first_anchor"
        onDismiss={handleReminderDismiss}
      />
    </Anchor15Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.anchor15.navy },
  goldGlow: { position: 'absolute', width: 360, height: 360, top: -205, left: '50%', marginLeft: -180, borderRadius: 180, backgroundColor: 'rgba(217,179,108,0.10)' },
  topRow: { minHeight: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.anchor15.goldHairline, backgroundColor: 'rgba(244,239,230,0.03)' },
  closeText: { color: colors.anchor15.ash, fontSize: 22, lineHeight: 22, fontWeight: '300' }, topBalance: { width: 36 },
  titlePill: { paddingHorizontal: 17, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.anchor15.goldHairline, backgroundColor: 'rgba(217,179,108,0.05)' }, titlePillText: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  scroll: { flex: 1 }, content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  hero: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  dottedRing: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderStyle: 'dotted', borderColor: 'rgba(217,179,108,0.20)' }, dashedRing: { position: 'absolute', width: 168, height: 168, borderRadius: 84, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(217,179,108,0.26)' },
  sigilFrame: { width: 146, height: 146, borderRadius: 73, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,179,108,0.34)', backgroundColor: 'rgba(8,11,15,0.56)', shadowColor: colors.anchor15.gilt, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, artwork: { width: '100%', height: '100%' },
  eyebrow: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.4, marginTop: 14, textAlign: 'center' },
  title: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 28, lineHeight: 33, marginTop: 8, textAlign: 'center' }, subtitle: { color: 'rgba(244,239,230,0.7)', fontFamily: typography.fontFamily.voice, fontSize: 16, fontStyle: 'italic', lineHeight: 22, marginTop: 10, textAlign: 'center' }, teaching: { color: 'rgba(135,147,157,0.88)', fontFamily: typography.fontFamily.instrument, fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 320, textAlign: 'center' }, sectionLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 1.8, marginTop: 20, textAlign: 'center' },
  modeGrid: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 }, modeCard: { flex: 1, minHeight: 134, paddingHorizontal: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.anchor15.hairline, alignItems: 'center', backgroundColor: 'rgba(30,42,51,0.22)' }, modeCardSelected: { borderColor: colors.anchor15.gilt, backgroundColor: 'rgba(30,42,51,0.44)', shadowColor: colors.anchor15.gilt, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, modeCheck: { position: 'absolute', top: 9, right: 9, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.gilt }, modeCheckText: { color: colors.anchor15.ink, fontSize: 11, fontWeight: '800' }, modeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(135,147,157,0.35)', marginBottom: 8 }, modeIconSelected: { borderColor: colors.anchor15.goldHairline }, modeIconText: { color: colors.anchor15.ash, fontSize: 23, lineHeight: 23 }, modeIconTextSelected: { color: colors.anchor15.gilt }, modeTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 12, letterSpacing: 0.7, textAlign: 'center' }, modeTitleSelected: { color: colors.anchor15.giltBright }, modeMeta: { color: 'rgba(244,239,230,0.6)', fontFamily: typography.fontFamily.voice, fontSize: 12, fontStyle: 'italic', lineHeight: 17, marginTop: 6, textAlign: 'center' }, selectedTeaching: { color: 'rgba(244,239,230,0.56)', fontFamily: typography.fontFamily.voice, fontSize: 13, fontStyle: 'italic', lineHeight: 18, marginTop: 12, minHeight: 18, textAlign: 'center' },
  actions: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, alignItems: 'center', gap: 6 }, hint: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voice, fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  missingWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 14 }, missingTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 29, lineHeight: 35 }, missingBody: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 14, lineHeight: 21 },
});
