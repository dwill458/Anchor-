import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionGenerationCandidate, VisionGenerationJob } from '@/hooks/v2/vision';
import { VisionHeaderRow, VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { VisionEnvironment } from './environment/VisionEnvironment';
import { VisionBoardIntentionCard } from './board/VisionBoardIntentionCard';
import { VisionDevelopingPhoto } from './VisionDevelopingPhoto';
import { VisionBoardPhoto } from './board/VisionBoardPhoto';
import { BOARD_DECOR_IMAGES, VISION_BOARD_IMAGES } from './board/visionBoardAssets';
import {
  boardSizeForWidth,
  decorAspect,
  selectBoardLayout,
  toSceneRect,
  type BoardDecorAsset,
  type BoardDecorItem,
  type SceneRect,
  type Size,
} from './board/visionBoardLayouts';
import { useVisionBoardScene } from './board/useVisionBoardScene';

const DECOR_ASSETS = Object.keys(BOARD_DECOR_IMAGES) as BoardDecorAsset[];

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

const ATMOSPHERIC_MESSAGES = [
  'Understanding your moment…',
  'Building the scene…',
  'Finding the first moment…',
  'Creating another perspective…',
  'Turning your words into an image…',
];

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const isInitial = mode === 'initial';

  // Board dimensions
  const boardWidth = Math.min(windowWidth - spacing[4] * 2, 400);
  const viewport = useMemo(() => boardSizeForWidth(boardWidth), [boardWidth]);
  const scene = viewport;

  // Candidates from job
  const candidates = useMemo(() => job?.candidates ?? [], [job?.candidates]);
  const readyCandidates = useMemo(
    () => candidates.filter(c => Boolean(c.imageUrl)),
    [candidates],
  );

  // Status message rotation
  const [statusIndex, setStatusIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % ATMOSPHERIC_MESSAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const currentStatusText = useMemo(() => {
    if (statusMessage) return statusMessage;
    if (job?.status === 'PARTIAL' || (job?.candidates && job.candidates.length > 1)) {
      return 'Finding another moment…';
    }
    if (readyCandidates.length >= 2) return 'Two perspectives are ready…';
    if (readyCandidates.length === 1) return 'Creating another perspective…';
    return ATMOSPHERIC_MESSAGES[statusIndex];
  }, [job?.candidates, job?.status, readyCandidates.length, statusIndex, statusMessage]);

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

  // Layout resolution
  // For Initial mode: Mockup 1 shows intention card pinned at top, and 2 candidate photos pinned side-by-side
  const initialCardRect: SceneRect = useMemo(() => {
    return toSceneRect({ x: 0.5, y: 0.35, width: 0.44, aspectRatio: 1.25, rotation: -0.8, zIndex: 40 }, scene);
  }, [scene]);

  const initialSlot1Rect: SceneRect = useMemo(() => {
    return toSceneRect({ x: 0.3, y: 0.74, width: 0.45, aspectRatio: 0.82, rotation: -3, zIndex: 15 }, scene);
  }, [scene]);

  const initialSlot2Rect: SceneRect = useMemo(() => {
    return toSceneRect({ x: 0.7, y: 0.75, width: 0.45, aspectRatio: 0.82, rotation: 2.5, zIndex: 16 }, scene);
  }, [scene]);

  // For Add mode: board has existing tiles + 1 new developing slot
  const totalCount = existingTiles.length + 1;
  const addLayout = useMemo(() => selectBoardLayout(Math.min(6, totalCount)), [totalCount]);
  const addCardRect = useMemo(() => toSceneRect(addLayout.card, scene), [addLayout.card, scene]);
  const existingBoard = useVisionBoardScene(existingTiles, scene, 1);

  // Incoming empty slot is placed at the newly added slot position
  const incomingSlotIndex = Math.min(existingTiles.length, addLayout.photos.length - 1);
  const incomingSlotRect: SceneRect = useMemo(() => {
    const slot = addLayout.photos[incomingSlotIndex];
    return slot ? toSceneRect(slot, scene) : initialSlot1Rect;
  }, [addLayout.photos, incomingSlotIndex, initialSlot1Rect, scene]);

  const decorByAsset = useMemo(() => {
    const decorList = isInitial
      ? [
          { asset: 'leaf-large' as BoardDecorAsset, x: 0.12, y: 0.72, width: 0.16, rotation: -14, opacity: 1, zIndex: 2 },
          { asset: 'map-corner' as BoardDecorAsset, x: 0.86, y: 0.32, width: 0.2, rotation: 8, opacity: 0.9, zIndex: 2 },
        ]
      : addLayout.decor;
    return new Map(decorList.map(item => [item.asset, item]));
  }, [addLayout.decor, isInitial]);

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

        {/* Physical Vision Board in Dark Environment */}
        <View style={[styles.boardWrapper, { width: scene.width, height: scene.height }]}>
          {/* Surrounding environmental pen-line illustration */}
          <VisionEnvironment
            category={anchorCategory}
            boardWidth={boardWidth}
            reduceMotion={reduceMotion}
          />

          {/* Wooden board background */}
          <Image
            source={VISION_BOARD_IMAGES.board}
            resizeMode="stretch"
            accessible={false}
            style={styles.fill}
          />

          {/* Decor Ephemera */}
          {DECOR_ASSETS.map(asset => {
            const item = decorByAsset.get(asset);
            if (!item) return null;
            const target = toSceneRect({ ...item, aspectRatio: decorAspect(item) }, scene);
            return (
              <Image
                key={asset}
                source={BOARD_DECOR_IMAGES[asset]}
                resizeMode="stretch"
                accessible={false}
                style={[
                  styles.decor,
                  {
                    left: target.x,
                    top: target.y,
                    width: target.width,
                    height: target.height,
                    opacity: item.opacity,
                    transform: [{ rotate: `${target.rotation}deg` }],
                    zIndex: item.zIndex,
                  },
                ]}
              />
            );
          })}

          {/* Real Intention Card with canonical SVG Anchor */}
          <VisionBoardIntentionCard
            rect={isInitial ? initialCardRect : addCardRect}
            intention={anchorIntention}
            category={anchorCategory}
            art={anchorArt}
            reduceMotion={reduceMotion}
          />

          {/* Board Content: FLOW A (Initial) */}
          {isInitial ? (
            <>
              {/* Candidate 1 Developing Slot */}
              <VisionDevelopingPhoto
                testID="developing-photo-candidate-0"
                rect={initialSlot1Rect}
                sceneId="candidate-0"
                category={anchorCategory}
                imageUrl={candidates[0]?.imageUrl}
                isReady={Boolean(candidates[0]?.imageUrl)}
                frame="landscape"
                reduceMotion={reduceMotion}
                delayMs={0}
              />

              {/* Candidate 2 Developing Slot */}
              <VisionDevelopingPhoto
                testID="developing-photo-candidate-1"
                rect={initialSlot2Rect}
                sceneId="candidate-1"
                category={anchorCategory}
                imageUrl={candidates[1]?.imageUrl}
                isReady={Boolean(candidates[1]?.imageUrl)}
                frame="landscape"
                reduceMotion={reduceMotion}
                delayMs={350}
              />
            </>
          ) : (
            /* Board Content: FLOW B (Add Image) */
            <>
              {/* Existing Persisted Photos */}
              {existingBoard.roster.map(({ tile }) => (
                <VisionBoardPhoto
                  key={tile.sceneId}
                  testID={`vision-board-photo-${tile.sceneId}`}
                  sceneId={tile.sceneId}
                  imageUrl={tile.imageUrl}
                  accessibilityLabel="Existing Vision photo"
                  initialRect={existingBoard.initialRectFor(tile.sceneId)}
                  entering={false}
                  exiting={false}
                  shared={existingBoard.shared}
                  reduceMotion={reduceMotion}
                  interactive={false}
                  dragEnabled={false}
                />
              ))}

              {/* Incoming New Moment Developing Slot */}
              <VisionDevelopingPhoto
                testID="developing-photo-incoming"
                rect={incomingSlotRect}
                sceneId="incoming-scene"
                category={anchorCategory}
                imageUrl={candidates[0]?.imageUrl}
                isReady={Boolean(candidates[0]?.imageUrl)}
                frame="landscape"
                reduceMotion={reduceMotion}
              />
            </>
          )}
        </View>

        {/* Candidate stage indicator for tests */}
        <View testID="vision-generation-stage" pointerEvents="none" style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}>
          {readyCandidates.map(c => (
            <Image key={c.id} source={{ uri: c.imageUrl }} />
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
