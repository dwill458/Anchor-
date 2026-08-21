import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { colors as themeColors, typography } from '@/theme';
import { useChartPracticeReturn } from '@/hooks/useChartPracticeReturn';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import {
  VisualizeFieldBackground,
} from './VisualizeAnchorField';
import {
  VisualizationAnchorLens,
  VisualizationPrimaryButton,
} from './VisualizationPrimitives';

type Props = NativeStackScreenProps<RootStackParamList, 'VisualizeCompletion'>;

const colors = {
  ...themeColors,
  gold: '#D4AF37',
  goldBright: '#F0CB6A',
  goldDim: '#8a6f23',
  goldLine: 'rgba(212,175,55,0.28)',
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.34)',
};

const durLabel = (s: number) => (s === 60 ? '1 min' : s === 300 ? '5 min' : '3 min');

export const VisualizeCompletionScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const returnToChart = useChartPracticeReturn(navigation);
  const {
    navigateToSanctuary: canonicalNavigateToSanctuary,
    navigateToVault,
    returnToAnchorDetail: canonicalReturnToAnchorDetail,
  } = useTabNavigation();
  const navigateToSanctuary = canonicalNavigateToSanctuary ?? (() => navigateToVault());
  const returnToAnchorDetail =
    canonicalReturnToAnchorDetail ??
    ((anchorId: string) => navigateToVault('AnchorDetail', { anchorId }));

  const anchor = useAnchorStore((state) =>
    state.getAnchorById(route.params.anchorId),
  );
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const completedSession = useSessionStore((state) =>
    state.practiceHistory.find(
      (session) => session.id === route.params.sessionId,
    ),
  );

  const [nextAction, setNextAction] = useState('');
  const [saved, setSaved] = useState(false);

  const sigilSvg = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '';
  const imageUrl = anchor?.enhancedImageUrl;
  const allowsNextAction = route.params.durationSeconds >= 180;

  // Expanding ripple rings animations
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 4_000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2_500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2_500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const r1 = createRipple(ring1, 0);
    const r2 = createRipple(ring2, 1_300);
    const r3 = createRipple(ring3, 2_600);

    r1.start();
    r2.start();
    r3.start();
    shimmerLoop.start();

    return () => {
      r1.stop();
      r2.stop();
      r3.stop();
      shimmerLoop.stop();
    };
  }, [ring1, ring2, ring3, shimmer]);

  const isChartReturn = route.params.returnTo === 'chart';
  const returnLabel = route.params.returnTarget?.kind === 'anchorDetail'
    ? 'Done'
    : route.params.returnTarget?.kind === 'sanctuary'
      ? 'Done'
      : isChartReturn
        ? 'Continue'
        : 'Done';

  const returnToOrigin = () => {
    if (isChartReturn) {
      returnToChart({
        returnTo: route.params.returnTo,
        anchorId: route.params.anchorId,
        chartContext: route.params.chartContext,
        ...(completedSession
          ? {
              practiceReturn: {
                outcome: 'completed' as const,
                practiceSessionId: completedSession.id,
                practiceMode: route.params.practiceMode ?? 'visualize',
                anchorId: route.params.anchorId,
              },
            }
          : {}),
      });
      return;
    }

    navigation.popToTop();
    if (route.params.returnTarget?.kind === 'anchorDetail') {
      returnToAnchorDetail(route.params.returnTarget.anchorId);
      return;
    }
    if (route.params.returnTarget?.kind === 'sanctuary') {
      navigateToSanctuary();
    }
  };

  const handleVisualizeAgain = () => {
    AnalyticsService.track(
      AnalyticsEvents.VISUALIZE_PRACTICE_AGAIN_SELECTED,
      { anchor_id: route.params.anchorId },
    );
    navigation.replace('VisualizeSession', {
      anchorId: route.params.anchorId,
      durationSeconds: route.params.durationSeconds,
      sceneText: route.params.sceneText ?? completedSession?.sceneSnapshot ?? '',
      guidanceVoice: (completedSession?.guidanceVoice as any) ?? 'female',
      backgroundAudio: (completedSession?.backgroundAudio as any) ?? 'ambient',
      returnTo: route.params.returnTo === 'chart' ? 'chart' : 'practice',
      returnTarget: route.params.returnTarget,
      chartContext: route.params.chartContext,
      practiceMode: route.params.practiceMode ?? 'visualize',
      practiceEntrySource: route.params.practiceEntrySource,
    });
  };

  const saveNextAction = async () => {
    if (!accountId || !nextAction.trim()) return;
    Keyboard.dismiss();
    await PracticeCompletionService.saveNextAction({
      accountId,
      sessionId: route.params.sessionId,
      nextAction: nextAction.trim(),
    });
    setSaved(true);
    AnalyticsService.track(AnalyticsEvents.VISUALIZE_NEXT_ACTION_SAVED, {
      session_id: route.params.sessionId,
      anchor_id: route.params.anchorId,
      duration_seconds: route.params.durationSeconds,
      sync_outcome: 'queued',
    });
  };

  const ringScale1 = ring1.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity1 = ring1.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.6, 0] });

  const ringScale2 = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity2 = ring2.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.6, 0] });

  const ringScale3 = ring3.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity3 = ring3.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.6, 0] });

  const shimmerScale = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={styles.container}>
      <VisualizeFieldBackground phase="return" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top + 20, 48), paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Centered Shimmering Coin with Ripple Rings */}
          <View style={styles.markContainer}>
            <Animated.View
              style={[
                styles.shimmerAura,
                {
                  opacity: shimmerOpacity,
                  transform: [{ scale: shimmerScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  opacity: ringOpacity1,
                  transform: [{ scale: ringScale1 }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  opacity: ringOpacity2,
                  transform: [{ scale: ringScale2 }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  opacity: ringOpacity3,
                  transform: [{ scale: ringScale3 }],
                },
              ]}
            />
            <VisualizationAnchorLens
              size={132}
              imageUrl={imageUrl}
              svg={sigilSvg}
              still={false}
            />
          </View>

          {/* Eyebrow & Title */}
          <Text style={styles.eyebrow}>VISUALIZE COMPLETE</Text>
          <Text style={styles.title}>Rehearsal complete.</Text>

          {/* Stats Row */}
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statVal}>{durLabel(route.params.durationSeconds)}</Text>
              <Text style={styles.statLbl}>PRACTICED</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statVal}>Thread 88</Text>
              <Text style={styles.statLbl}>TEMPERED</Text>
            </View>
          </View>

          {/* "Take It Forward" (for 3 min and 5 min sessions) */}
          {allowsNextAction && (
            <View style={styles.carryCard}>
              <Text style={styles.carryLabel}>TAKE IT FORWARD</Text>
              <Text style={styles.carryQuestion}>
                What is one action you can take now that matches what you rehearsed?
              </Text>
              {saved ? (
                <View style={styles.nextSavedPill}>
                  <Check size={14} color={colors.gold} />
                  <Text style={styles.nextSavedText}>{nextAction}</Text>
                </View>
              ) : (
                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder={'"Send the meeting outline before 9:00 AM."'}
                    placeholderTextColor="rgba(245,240,232,0.28)"
                    value={nextAction}
                    onChangeText={setNextAction}
                    style={styles.nextInput}
                  />
                  <Pressable
                    disabled={!nextAction.trim()}
                    onPress={() => void saveNextAction()}
                    style={[styles.saveActionBtn, !nextAction.trim() && styles.saveActionDisabled]}
                  >
                    <Text style={styles.saveActionText}>SAVE ACTION</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Action CTAs */}
          <View style={styles.actionsWrap}>
            <VisualizationPrimaryButton
              label={`${returnLabel.toUpperCase()} →`}
              onPress={returnToOrigin}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Visualize Again"
              onPress={handleVisualizeAgain}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostBtnText}>Visualize Again</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04060c',
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  markContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  shimmerAura: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(240,203,106,0.18)',
  },
  rippleRing: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  eyebrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 3.6,
    color: colors.gold,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 27,
    fontWeight: '500',
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 10,
  },
  statCell: {
    alignItems: 'center',
    gap: 3,
  },
  statVal: {
    fontFamily: typography.fonts.heading,
    fontSize: 19,
    color: colors.bone,
    letterSpacing: 0.4,
  },
  statLbl: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.boneFaint,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(245,240,232,0.12)',
  },
  carryCard: {
    width: '100%',
    marginTop: 16,
    gap: 10,
    alignItems: 'center',
  },
  carryLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 2.8,
    color: colors.gold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  carryQuestion: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 15.5,
    color: colors.boneSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  nextInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    backgroundColor: 'rgba(245,240,232,0.04)',
    color: colors.bone,
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 16,
    textAlign: 'center',
  },
  saveActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  saveActionDisabled: {
    opacity: 0.35,
  },
  saveActionText: {
    fontFamily: typography.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: colors.goldBright,
    textTransform: 'uppercase',
  },
  nextSavedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  nextSavedText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.bone,
  },
  actionsWrap: {
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  ghostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  ghostBtnText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.boneSoft,
  },
});
