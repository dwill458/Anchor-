import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { colors } from '@/theme/v2';
import { ChartCompletionPanel } from './ChartDestinationReached';
import type { ChartVisionPreview } from './ChartActiveView';

type Props = {
  /** 0..1 grow, driven by the summit scene (5500-6300). */
  progress: SharedValue<number>;
  view: ChartViewModel;
  vision: ChartVisionPreview | null;
  reducedMotion: boolean;
  onViewJourney: () => void;
  onRelease: () => void;
  testID?: string;
};

/** How far the panel rises from, as a fraction of the screen. Reduce Motion cross-fades in place instead. */
const RISE = 0.12;

/**
 * The end of the summit scene (S1): the existing cream completion panel (ChartCompletionPanel, with its own copy),
 * presented over the still-mounted Chart where the sheet was. It is not a second panel: it is the same component the
 * released Chart shows, so the words and the two actions are exactly those.
 */
export function ChartSummitPanel({ progress, view, vision, reducedMotion, onViewJourney, onRelease, testID }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - progress.value) * height * RISE }],
  }));
  return (
    <Animated.View testID={testID ?? 'chart-summit-panel'} style={[styles.root, { maxHeight: height * 0.84 }, style]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ChartCompletionPanel view={view} vision={vision} onViewJourney={onViewJourney} onRelease={onRelease} />
        <View style={{ height: insets.bottom, backgroundColor: colors.canvas }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  content: { flexGrow: 0 },
});
