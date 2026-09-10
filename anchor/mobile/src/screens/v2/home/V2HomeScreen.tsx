import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  V2Button,
  V2EmptyState,
  V2Screen,
  V2Section,
  V2SectionHeader,
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
import { motion, spacing } from '@/theme/v2';
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

export function V2HomeScreen() {
  const navigation = useNavigation<Nav>();
  const model = useV2HomeModel();
  const { selectAnchor } = useV2SelectedAnchor();
  const reduceMotion = useV2ReduceMotion();
  const intents = useV2DailyShellIntents();
  const threadEvents = useV2ThreadEventQueue({ channel: 'HOME_CONTEXT', enabled: Boolean(model.selectedAnchor) });

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

  return (
    <V2Screen scroll testID="v2-home-screen">
      <V2HomeHeader
        greeting={model.greeting}
        onOpenChart={() => {
          track('v2_home_chart_tapped');
          intents.onOpenChart(selectedId ?? undefined);
        }}
        onCreateAnchor={() => {
          track('v2_home_create_anchor_tapped');
          intents.onCreateAnchor();
        }}
        onOpenProfile={intents.onOpenProfile}
      />

      {!model.selectedAnchor ? (
        <View style={styles.empty}>
          <V2EmptyState
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
          <Animated.View style={{ opacity: fade }}>
            <V2SelectedAnchorHero
              testID="v2-home-hero"
              anchor={model.selectedAnchor}
              threadValue={model.thread?.value}
              onPress={() => openDetails(selectedId as string)}
            />
          </Animated.View>

          {model.thread ? (
            <V2Section testID="v2-home-thread" style={styles.threadSection}>
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
            </V2Section>
          ) : null}

          <V2Section style={styles.practiceSection}>
            <V2HomePracticeEntry
              onStartPractice={() => {
                track('v2_home_practice_tapped');
                intents.onOpenPractice(selectedId as string);
              }}
            />
          </V2Section>

          {isWithinWeeklyInsightReviewWindow() ? (
            <V2Section testID="v2-home-weekly-review">
              <V2Button accessibilityLabel="Open Weekly Review" variant="secondary" onPress={intents.onOpenWeeklyInsight}>
                Weekly Review
              </V2Button>
            </V2Section>
          ) : null}

          <V2Section style={styles.visualSection}>
            <V2HomeVisionSection
              vision={model.vision}
              onOpenVision={() => {
                track('v2_home_vision_tapped');
                intents.onOpenVision(selectedId as string);
              }}
              onCreateVision={() => {
                track('v2_home_vision_tapped', { create: true });
                intents.onCreateVision(selectedId as string);
              }}
            />
          </V2Section>

          <V2Section style={styles.chartSection}>
            <V2HomeChartSection
              chart={model.chart}
              onOpenChart={() => {
                track('v2_home_chart_tapped');
                intents.onOpenChart(selectedId ?? undefined);
              }}
              onCreateChart={() => {
                track('v2_home_chart_tapped', { create: true });
                intents.onCreateChart(selectedId as string);
              }}
            />
          </V2Section>

          <V2Section testID="v2-home-quick-switch">
            <V2SectionHeader
              title="Your Anchors"
              actionLabel="See all"
              onActionPress={() => {
                track('v2_anchor_library_viewed', { from: 'home' });
                navigation.navigate('V2AnchorLibrary');
              }}
            />
            <V2AnchorQuickSwitch anchors={model.anchorList} onSelect={handleSwitch} />
          </V2Section>
        </>
      )}
      <V2ThreadEventModal
        bundle={threadEvents.active}
        visible={Boolean(threadEvents.active)}
        anchorSvg={model.selectedAnchor?.baseSigilSvg}
        category={model.selectedAnchor?.category}
        reducedMotion={reduceMotion}
        onPresented={() => { void threadEvents.claimActive().then(threadEvents.markPresented); }}
        onAcknowledge={() => { void threadEvents.acknowledge(); }}
        onDismiss={() => { void threadEvents.dismiss(); }}
      />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  empty: { paddingTop: spacing[8] },
  threadSection: { marginBottom: spacing[6] },
  practiceSection: { marginBottom: spacing[7] },
  visualSection: { marginBottom: spacing[5] },
  chartSection: { marginBottom: spacing[7] },
});
