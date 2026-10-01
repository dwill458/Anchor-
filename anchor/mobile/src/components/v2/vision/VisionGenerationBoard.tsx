import { memo, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, spacing, typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionGenerationJob } from '@/hooks/v2/vision';
import { VisionHeaderRow, VisionIdentity, VisionStatusBarScrim, type VisionAnchorArt } from './VisionChrome';

import { VisionDevelopingPhoto } from './VisionDevelopingPhoto';

import { VISION_HERO_ASPECT } from './board/visionBoardLayouts';



export interface VisionGenerationBoardProps {
  mode: 'initial' | 'add';
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  job: VisionGenerationJob | null;
  existingTiles?: V2VisionTile[];
  statusMessage?: string;
  onBack: () => void;
  onRetry?: () => void;
  onEditDescription?: () => void;
  onReadyToSelect?: () => void;
  testID?: string;
}

function IndeterminateProgressBar({ reduceMotion }: { reduceMotion: boolean }) {
  const travel = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    travel.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [reduceMotion, travel]);

  const barStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { left: '30%', width: '40%' };
    const left = interpolate(travel.value, [0, 1], [-30, 100]);
    return {
      left: `${left}%`,
      width: '35%',
    };
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.indicator, barStyle]}>
        <LinearGradient
          colors={['rgba(217, 119, 6, 0.2)', '#D97706', '#FDE68A', '#D97706', 'rgba(217, 119, 6, 0.2)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export const VisionGenerationBoard = memo(function VisionGenerationBoard({
  mode,
  anchorIntention,
  anchorCategory,
  anchorArt,
  anchorImageUrl,
  job,
  existingTiles = [],
  statusMessage,
  onBack,
  onRetry,
  onEditDescription,
  onReadyToSelect,
  testID = 'vision-generation-board',
}: VisionGenerationBoardProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const isInitial = mode === 'initial';

  // Board dimensions
  const boardWidth = Math.min(windowWidth - spacing[4] * 2, 400);

  // Candidates from job
  const candidates = useMemo(() => job?.candidates ?? [], [job?.candidates]);
  const readyCandidates = useMemo(
    () => candidates.filter(c => Boolean(c.imageUrl)),
    [candidates],
  );

  const currentStatusText = statusMessage ?? (job?.status === 'FAILED' ? 'Image generation paused.' :
    job?.status === 'COMPLETE' ? 'Your images are ready.' : job?.status === 'QUEUED' ? 'Waiting to generate your images.' : 'Generating your images.');

  // Transition to selection once ready candidates arrive
  const readyToSelectTriggered = useRef(false);
  useEffect(() => {
    if (job?.status === 'COMPLETE' && readyCandidates.length > 0 && !readyToSelectTriggered.current) {
      readyToSelectTriggered.current = true;
      const delay = reduceMotion ? 400 : 1600;
      const timer = setTimeout(() => {
        onReadyToSelect?.();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [job?.status, onReadyToSelect, readyCandidates.length, reduceMotion]);

  const isFailed = job?.status === 'FAILED';

  return (
    <View testID={testID} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />

      {/* Atmospheric dark background */}
      <LinearGradient
        colors={[colors.ink.base, '#0E151C', '#090D12']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollPage,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header without circular Anchor avatar */}
        <View style={styles.headerSlot}>
          <VisionHeaderRow title="Creating your Vision" onBack={onBack} tone="light" />
          <VisionIdentity
            intention={anchorIntention}
            category={anchorCategory}
            art={anchorArt}
            imageUrl={anchorImageUrl}
            showAnchor={false}
            tone="light"
          />
        </View>

        {/* Cinematic headline */}
        <View style={styles.headlineWrapper}>
          <Text accessibilityRole="header" style={styles.title}>
            {isInitial ? 'Your future\nis taking shape.' : 'Bringing this\nmoment to life.'}
          </Text>
          <Text style={styles.subtitle}>
            {isInitial ? 'Finding the moments that make it real.' : 'Turning your words into a real image.'}
          </Text>
        </View>

        <View style={[styles.boardWrapper, { width: boardWidth, height: boardWidth / VISION_HERO_ASPECT }]}>
          <VisionDevelopingPhoto testID={isInitial ? 'developing-photo-candidate-0' : 'developing-photo-incoming'}
            rect={{ x: 0, y: 0, width: boardWidth, height: boardWidth / VISION_HERO_ASPECT, rotation: 0, zIndex: 1 }}
            sceneId="incoming-scene" category={anchorCategory} imageUrl={candidates[0]?.imageUrl}
            isReady={Boolean(candidates[0]?.imageUrl)} reduceMotion={reduceMotion} />
        </View>

        {/* Candidate stage indicator for tests */}
        <View testID="vision-generation-stage" pointerEvents="none" style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}>
          {readyCandidates.map(c => (
            <View key={c.id} />
          ))}
        </View>

        {/* Footer Area: Atmospheric Status & Indeterminate Progress */}
        <View style={styles.footerSection}>
          <Text accessibilityLiveRegion="polite" style={styles.statusCopy}>
            {currentStatusText}
          </Text>

          {!isFailed && <IndeterminateProgressBar reduceMotion={reduceMotion} />}

          {/* Calm Failure / Retry Handling */}
          {isFailed ? (
            <View style={styles.failureBox}>
              <Text style={styles.failureTitle}>Your Vision needs another moment.</Text>
              <Text style={styles.failureBody}>
                {readyCandidates.length > 0
                  ? 'The moments already here are ready to choose from. You can also try again.'
                  : 'We could not bring your Vision into view just yet. Please try again.'}
              </Text>

              <View style={styles.failureActions}>
                {onRetry && (
                  <V2Button variant="secondary" onPress={onRetry} style={styles.failureButton}>
                    Retry this set
                  </V2Button>
                )}
                {onEditDescription && (
                  <Pressable onPress={onEditDescription} style={styles.linkButton}>
                    <Text style={styles.linkText}>Edit description</Text>
                  </Pressable>
                )}
                {readyCandidates.length > 0 && onReadyToSelect && (
                  <Pressable onPress={onReadyToSelect} style={styles.linkButton}>
                    <Text style={styles.linkText}>Choose available images</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <VisionStatusBarScrim />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink.base,
  },
  scrollPage: {
    flexGrow: 1,
    alignItems: 'center',
  },
  headerSlot: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing[5],
    gap: spacing[2],
  },
  headlineWrapper: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[5],
    marginTop: spacing[3],
    marginBottom: spacing[3],
    gap: 4,
  },
  title: {
    ...typography.displayMedium,
    color: colors.ink.text.primary,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.bodyMD,
    color: colors.ink.text.secondary,
    lineHeight: 22,
  },
  boardWrapper: {
    marginVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  decor: {
    position: 'absolute',
  },
  footerSection: {
    width: '100%',
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    marginTop: spacing[3],
    gap: spacing[3],
  },
  statusCopy: {
    ...typography.bodyMD,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
  },
  track: {
    width: 220,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  failureBox: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
  },
  failureTitle: {
    ...typography.headingMD,
    color: colors.ink.text.primary,
    textAlign: 'center',
  },
  failureBody: {
    ...typography.bodyMD,
    color: colors.ink.text.secondary,
    textAlign: 'center',
  },
  failureActions: {
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  failureButton: {
    minWidth: 160,
  },
  linkButton: {
    paddingVertical: spacing[2],
  },
  linkText: {
    ...typography.labelMD,
    color: colors.ink.text.primary,
    textDecorationLine: 'underline',
  },
});
