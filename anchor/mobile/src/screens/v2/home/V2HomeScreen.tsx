import React, { useEffect, useRef } from 'react';
import { Animated, AppState, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  V2Button,
  V2ActivityIndicator,
  V2EmptyState,
  V2InlineError,
  V2Screen,
  V2ThreadStrength,
} from '@/components/v2';
import {
  V2AnchorQuickSwitch,
  V2HomeChartSection,
  V2HomeHeader,
  V2HomePracticeEntry,
  V2HomeVisionSection,
  V2SelectedAnchorHero,
} from '@/components/v2/home';
import { useV2HomeModel } from '@/adapters/v2/home';
import { useV2SelectedAnchor } from '@/hooks/v2/home';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useV2ThreadEventQueue } from '@/hooks/v2/threadEvents';
import { V2ThreadEventModal } from '@/components/v2/threadEvents';
import { getCategoryColor, motion } from '@/theme/v2';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2DailyShellIntents, type V2DailyShellParamList } from './dailyShell';
import { isWithinWeeklyInsightReviewWindow } from '@/adapters/v2/weeklyInsight';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2Home'>;

const track = (name: string, properties: Record<string, unknown> = {}) => {
  try {
    AnalyticsService.track(name, properties);
  } catch {
    /* analytics must never break Home */
  }
};

function EmptyHomeGestureSvg() {
  return (
    <Svg width={220} height={200} viewBox="0 0 220 200" fill="none" accessibilityElementsHidden>
      {/* Soft paper circular foundation */}
      <Circle
        cx={110}
        cy={100}
        r={76}
        fill="#FBF9F4"
        stroke="#DAD6CD"
        strokeWidth={1}
        strokeDasharray="6 6"
      />

      {/* Dynamic irregular brush arcs echoing Hero rings */}
      <Ellipse
        cx={110}
        cy={100}
        rx={86}
        ry={82}
        stroke="#7C5CFA"
        strokeWidth={4}
        strokeDasharray="160 30 110 40"
        strokeLinecap="round"
        opacity={0.4}
        transform="rotate(-25 110 100)"
      />
      <Ellipse
        cx={110}
        cy={100}
        rx={90}
        ry={85}
        stroke="#3157D8"
        strokeWidth={3}
        strokeDasharray="70 20 180 50"
        strokeLinecap="round"
        opacity={0.3}
      />
      <Path
        d="M145 170 C175 160 196 135 198 105"
        stroke="#53BDCC"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.45}
      />

      {/* Orange rays accent at top right */}
      <Path
        d="M182 48 L188 32 M196 52 L206 42 M200 62 L212 60"
        stroke="#F28A2E"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Gentle center waypoint sigil */}
      <Circle cx={110} cy={100} r={16} stroke="#D8D2C8" strokeWidth={1.5} strokeDasharray="3 3" />
      <Circle cx={110} cy={100} r={5} fill="#F9A72F" />
    </Svg>
  );
}

export function V2HomeScreen() {
  const navigation = useNavigation<Nav>();
  const model = useV2HomeModel();
  const { selectAnchor } = useV2SelectedAnchor();
  const reduceMotion = useV2ReduceMotion();
  const intents = useV2DailyShellIntents();
  const threadEvents = useV2ThreadEventQueue({
    channel: 'HOME_CONTEXT',
    enabled: Boolean(model.selectedAnchor),
  });

  useEffect(() => {
    if (!model.selectedAnchor) return undefined;
    const refreshModules = () => {
      void model.refreshVision();
      void model.refreshToday();
      void model.refreshChart();
    };
    const unsubscribeFocus = navigation.addListener('focus', refreshModules);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshModules();
      }
    });
    return () => {
      unsubscribeFocus();
      subscription.remove();
    };
  }, [model.refreshChart, model.refreshToday, model.refreshVision, model.selectedAnchor, navigation]);

  useEffect(() => {
    track('v2_home_viewed', { anchorCount: model.anchorList.length });
  }, [model.anchorList.length]);

  const selectedId = model.selectedAnchor
    ? model.selectedAnchor.localId ?? model.selectedAnchor.id
    : null;

  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion || !selectedId) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: motion.standard,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fade, reduceMotion, selectedId]);

  const openDetails = (anchorId: string) => {
    track('v2_anchor_details_viewed', { from: 'home' });
    navigation.navigate('V2AnchorDetails', { anchorId });
  };

  const handleSwitch = (anchorId: string) => {
    selectAnchor(anchorId);
    track('v2_home_anchor_switched');
  };

  const catColor = getCategoryColor(model.selectedAnchor?.category);

  return (
    <V2Screen scroll testID="v2-home-screen">
      <V2HomeHeader
        greeting={model.greeting}
        profileInitial={model.profileInitial}
        onOpenChart={() => {
          track('v2_home_chart_tapped');
          intents.onOpenChart(selectedId ?? undefined, model.chart.state === 'ready' ? model.chart.courseId : undefined);
        }}
        onCreateAnchor={() => {
          track('v2_home_create_anchor_tapped');
          intents.onCreateAnchor();
        }}
        onOpenProfile={intents.onOpenProfile}
      />

      {model.anchorState === 'loading' ? (
        <View style={styles.statusContainer}><V2ActivityIndicator label="Loading your Anchors" /></View>
      ) : model.anchorState === 'error' ? (
        <View style={styles.statusContainer}>
          <V2InlineError message={model.anchorError ?? 'Unable to load your Anchors.'} />
        </View>
      ) : !model.selectedAnchor ? (
        <View style={styles.emptyContainer}>
          <V2EmptyState
            gesture={<EmptyHomeGestureSvg />}
            title="No Anchor yet"
            message="Create your first Anchor to begin. Everything on Home orients around one selected Anchor."
            action={
              <V2Button
                accessibilityLabel="Create your first Anchor"
                onPress={() => {
                  track('v2_home_create_anchor_tapped');
                  intents.onCreateAnchor();
                }}
              >
                Create an Anchor
              </V2Button>
            }
          />
        </View>
      ) : (
        <>
          {/* Hero Artwork & Intention */}
          <Animated.View style={{ opacity: fade }}>
            <V2SelectedAnchorHero
              testID="v2-home-hero"
              anchor={model.selectedAnchor}
              threadValue={model.thread?.value ?? undefined}
              onPress={() => openDetails(selectedId as string)}
            />
          </Animated.View>

          {/* Thread Strength */}
          {model.thread ? (
            <View testID="v2-home-thread" style={styles.threadSection}>
              <V2ThreadStrength
                testID="v2-home-thread-strength"
                value={model.thread.value}
                category={model.thread.category}
                delta={model.thread.delta}
                trend={model.thread.trend}
                detail={model.thread.detail}
                onPress={() => {
                  track('v2_home_progress_tapped');
                  intents.onOpenProgress(selectedId ?? undefined);
                }}
              />
            </View>
          ) : null}

          {/* Today / Practice Section */}
          <V2HomePracticeEntry
            today={model.today}
            onRetry={model.refreshToday}
            onStartPractice={(mode) => {
              track('v2_home_practice_tapped');
              intents.onOpenPractice(selectedId as string, mode);
            }}
          />

          {isWithinWeeklyInsightReviewWindow() ? (
            <View testID="v2-home-weekly-review" style={styles.weeklyReviewSection}>
              <V2Button
                accessibilityLabel="Open Weekly Review"
                variant="secondary"
                onPress={intents.onOpenWeeklyInsight}
              >
                Weekly Review
              </V2Button>
            </View>
          ) : null}

          {/* Hairline Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.hairlineDivider} />
          </View>

          {/* Vision Section */}
          <V2HomeVisionSection
            vision={model.vision}
            category={model.selectedAnchor.category}
            onOpenVision={() => {
              track('v2_home_vision_tapped');
              intents.onOpenVision(selectedId as string);
            }}
          />

          {/* Chart Section */}
          <V2HomeChartSection
            chart={model.chart}
            categoryColor={catColor}
            onRetry={model.refreshChart}
            onOpenChart={() => {
              track('v2_home_chart_tapped');
              intents.onOpenChart(selectedId ?? undefined, model.chart.state === 'ready' ? model.chart.courseId : undefined);
            }}
          />

          {/* Hairline Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.hairlineDivider} />
          </View>

          {/* Your Anchors Horizontal Rail */}
          <View testID="v2-home-quick-switch">
            <V2AnchorQuickSwitch
              anchors={model.anchorList}
              onSelect={handleSwitch}
              onOpenAllAnchors={() => {
                track('v2_anchor_library_viewed', { from: 'home' });
                navigation.navigate('V2AnchorLibrary');
              }}
            />
          </View>
        </>
      )}

      <V2ThreadEventModal
        bundle={threadEvents.active}
        visible={Boolean(threadEvents.active)}
        anchorSvg={model.selectedAnchor?.baseSigilSvg}
        category={model.selectedAnchor?.category}
        reducedMotion={reduceMotion}
        onPresented={() => {
          void threadEvents.claimActive().then(threadEvents.markPresented);
        }}
        onAcknowledge={() => {
          void threadEvents.acknowledge();
        }}
        onDismiss={() => {
          void threadEvents.dismiss();
        }}
      />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    paddingTop: 48,
    paddingHorizontal: 22,
  },
  emptyContainer: {
    paddingTop: 48,
    paddingBottom: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadSection: {
    marginTop: 0,
  },
  weeklyReviewSection: {
    marginHorizontal: 22,
    marginTop: 16,
  },
  dividerContainer: {
    marginTop: 26,
    paddingHorizontal: 22,
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: '#D8D2C8',
  },
});
