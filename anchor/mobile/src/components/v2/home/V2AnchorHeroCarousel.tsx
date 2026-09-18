import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { V2SelectedAnchorHero } from './V2SelectedAnchorHero';
import { V2ThreadStrength } from '@/components/v2/thread/V2ThreadStrength';
import { v2Haptics, useV2ReduceMotion } from '@/hooks/v2';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';
import type { V2ThreadPresentation } from '@/adapters/v2/home/threadAdapter';

const DEFAULT_WIDTH = (Number.isFinite(Dimensions.get('window').width) ? Dimensions.get('window').width : 375) - 48;
const SWIPE_VELOCITY_THRESHOLD = 500;
const SWIPE_DISTANCE_RATIO = 0.22;

const SPRING_CONFIG = {
  damping: 32,
  stiffness: 280,
  mass: 0.9,
  overshootClamping: true,
};

type Props = {
  anchors: V2HomeAnchorSummary[];
  selectedAnchorId: string | null;
  onSelectAnchor: (anchorId: string) => void;
  onOpenDetails: (anchorId: string) => void;
  onOpenProgress: (anchorId: string) => void;
  onOpenAllAnchors: () => void;
  currentAnchorThread?: V2ThreadPresentation | null;
  reduceMotion?: boolean;
  testID?: string;
  heroTestID?: string;
  threadTestID?: string;
};

export function V2AnchorHeroCarousel({
  anchors,
  selectedAnchorId,
  onSelectAnchor,
  onOpenDetails,
  onOpenProgress,
  onOpenAllAnchors,
  currentAnchorThread,
  reduceMotion: reduceMotionProp,
  testID = 'v2-home-carousel',
  heroTestID = 'v2-home-hero',
  threadTestID = 'v2-home-thread',
}: Props) {
  const systemReduceMotion = useV2ReduceMotion();
  const reduceMotion = reduceMotionProp ?? systemReduceMotion;

  const [containerWidth, setContainerWidth] = useState(DEFAULT_WIDTH);
  const isSettlingRef = useRef(false);

  const count = anchors.length;

  const currentIndex = useMemo(() => {
    if (count === 0) return 0;
    const found = anchors.findIndex(
      (a) => a.anchor.id === selectedAnchorId || a.anchor.localId === selectedAnchorId
    );
    return found >= 0 ? found : 0;
  }, [anchors, count, selectedAnchorId]);

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  // Sync translation when selected Anchor changes externally
  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;
    isSettlingRef.current = false;
  }, [selectedAnchorId, translateX]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  const handleCommitNewIndex = useCallback(
    (nextIndex: number) => {
      isSettlingRef.current = false;
      const wrappedIndex = ((nextIndex % count) + count) % count;
      if (wrappedIndex !== currentIndex) {
        v2Haptics.selection();
        const nextAnchor = anchors[wrappedIndex];
        const nextId = nextAnchor.anchor.localId ?? nextAnchor.anchor.id;
        onSelectAnchor(nextId);
      }
    },
    [anchors, count, currentIndex, onSelectAnchor]
  );

  const handleResetPosition = useCallback(() => {
    isSettlingRef.current = false;
  }, []);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(count > 1)
      .activeOffsetX([-20, 20])
      .failOffsetY([-15, 15])
      .onStart(() => {
        'worklet';
        cancelAnimation(translateX);
        startX.value = translateX.value;
        isGestureActive.value = true;
      })
      .onUpdate((event) => {
        'worklet';
        if (!isGestureActive.value) return;

        let newX = startX.value + event.translationX;

        translateX.value = newX;
      })
      .onEnd((event) => {
        'worklet';
        isGestureActive.value = false;

        const distanceThreshold = containerWidth * SWIPE_DISTANCE_RATIO;
        const velocity = event?.velocityX ?? 0;
        const translation = event?.translationX !== undefined ? event.translationX : translateX.value;

        let targetIndex = currentIndex;

        if (velocity < -SWIPE_VELOCITY_THRESHOLD || translation < -distanceThreshold) {
          targetIndex = currentIndex + 1;
        } else if (velocity > SWIPE_VELOCITY_THRESHOLD || translation > distanceThreshold) {
          targetIndex = currentIndex - 1;
        }

        const deltaIndex = targetIndex - currentIndex;

        if (deltaIndex !== 0) {
          const finalX = -deltaIndex * Math.min(72, containerWidth * 0.22);
          if (reduceMotion) {
            translateX.value = 0;
            runOnJS(handleCommitNewIndex)(targetIndex);
          } else {
            translateX.value = withSpring(finalX, SPRING_CONFIG, (finished) => {
              if (finished) {
                translateX.value = 0;
                runOnJS(handleCommitNewIndex)(targetIndex);
              }
            });
          }
        } else {
          if (reduceMotion) {
            translateX.value = 0;
            runOnJS(handleResetPosition)();
          } else {
            translateX.value = withSpring(0, SPRING_CONFIG, (finished) => {
              if (finished) {
                runOnJS(handleResetPosition)();
              }
            });
          }
        }
      })
      .onFinalize(() => {
        'worklet';
        isGestureActive.value = false;
      });
  }, [
    containerWidth,
    count,
    currentIndex,
    handleCommitNewIndex,
    handleResetPosition,
    isGestureActive,
    reduceMotion,
    startX,
    translateX,
  ]);

  const animatedDeckStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const handleNext = useCallback(() => {
    if (count > 1) {
      handleCommitNewIndex(currentIndex + 1);
    }
  }, [count, currentIndex, handleCommitNewIndex]);

  const handlePrev = useCallback(() => {
    if (count > 1) {
      handleCommitNewIndex(currentIndex - 1);
    }
  }, [count, currentIndex, handleCommitNewIndex]);

  if (count === 0) {
    return null;
  }

  // Single Anchor: Render stationary without gesture wrapper
  if (count === 1) {
    const single = anchors[0];
    const anchor = single.anchor;
    const thread = currentAnchorThread ?? single.thread;
    const anchorId = anchor.localId ?? anchor.id;

    return (
      <View testID={testID} style={styles.carouselContainer} onLayout={handleLayout}>
        <V2SelectedAnchorHero
          testID={heroTestID}
          anchor={anchor}
          threadValue={thread?.value ?? undefined}
          positionText={null}
          onOpenAllAnchors={onOpenAllAnchors}
          onPress={() => onOpenDetails(anchorId)}
        />
        {thread ? (
          <View testID={threadTestID} style={styles.threadSection}>
            <V2ThreadStrength
              testID="v2-home-thread-strength"
              value={thread.value}
              category={thread.category}
              delta={thread.delta}
              trend={thread.trend}
              detail={thread.detail}
              reduceMotion={reduceMotion}
              onPress={() => onOpenProgress(anchorId)}
            />
          </View>
        ) : null}
      </View>
    );
  }

  const activeAnchor = anchors[currentIndex].anchor;
  const activeId = activeAnchor.localId ?? activeAnchor.id;
  const activeThread = currentAnchorThread ?? anchors[currentIndex].thread;
  const a11yLabel = `Active Anchor: ${activeAnchor.intentionText}. ${categoryLabel(activeAnchor.category)}. Anchor ${currentIndex + 1} of ${count}.`;

  return (
    <View
      testID={testID}
      style={styles.carouselContainer}
      onLayout={handleLayout}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={a11yLabel}
      accessibilityActions={[
        { name: 'increment', label: 'Next Anchor' },
        { name: 'decrement', label: 'Previous Anchor' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          handleNext();
        } else if (event.nativeEvent.actionName === 'decrement') {
          handlePrev();
        }
      }}
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.window}>
          <Animated.View style={animatedDeckStyle}>
            <V2SelectedAnchorHero
              testID={heroTestID}
              anchor={activeAnchor}
              previousAnchor={anchors[(currentIndex - 1 + count) % count].anchor}
              nextAnchor={anchors[(currentIndex + 1) % count].anchor}
              onSelectNeighbor={(id) => {
                const index = anchors.findIndex((item) => item.anchor.id === id || item.anchor.localId === id);
                handleCommitNewIndex(index);
              }}
              threadValue={activeThread?.value ?? undefined}
              positionText={`${currentIndex + 1} OF ${count}`}
              onOpenAllAnchors={onOpenAllAnchors}
              onPress={() => onOpenDetails(activeId)}
            />
          </Animated.View>
        </View>
      </GestureDetector>
      {activeThread ? <View testID={threadTestID} style={styles.threadSection}>
        <V2ThreadStrength testID="v2-home-thread-strength" value={activeThread.value} category={activeThread.category} delta={activeThread.delta} trend={activeThread.trend} detail={activeThread.detail} reduceMotion={reduceMotion} onPress={() => onOpenProgress(activeId)} />
      </View> : null}

      {/* Screen-reader accessible buttons */}
      <View style={styles.srOnly}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous Anchor"
          disabled={false}
          onPress={handlePrev}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next Anchor"
          disabled={false}
          onPress={handleNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    width: '100%',
  },
  window: {
    overflow: 'visible',
    position: 'relative',
  },
  deck: {
    width: '100%',
    position: 'relative',
  },
  card: {
    position: 'absolute',
    top: 0,
  },
  threadSection: {
    marginTop: 0,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});
