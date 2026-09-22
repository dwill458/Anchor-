import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, type PanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { AnchorMotion } from '@/theme/v2';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  reduceMotion?: boolean;
  scrimColor?: string;
  scrimAccessibilityLabel?: string;
  testID?: string;
};

/** Released past this share of the sheet's height (or faster than the velocity), a drag dismisses. */
const DISMISS_FRACTION = 0.3;
const DISMISS_VELOCITY = 900;
/** Upward drags are resisted; the sheet never lifts off the screen edge. */
const UPWARD_RESISTANCE = 0.18;
const EXIT_MS = AnchorMotion.duration.standard - 60;
/** Longer than any exit, including a slow drag release. */
const EXIT_FALLBACK_MS = 700;

/**
 * How far a sheet's surface must continue below the screen edge (negative
 * bottom margin + matching padding), so spring overshoot never shows a gap.
 */
export const V2_SHEET_SKIRT = 48;

const GrabGestureContext = createContext<PanGesture | null>(null);

/** Android Modals open a separate native root that gesture handlers must be re-rooted in; iOS does not need it. */
const ModalGestureRoot = Platform.OS === 'android' ? GestureHandlerRootView : View;

/**
 * The part of a sheet that can be dragged (its handle and header). Kept off
 * the sheet's scrolling content so dragging never fights the list's scroll.
 */
export function V2SheetGrabZone({ children }: { children: React.ReactNode }) {
  const gesture = useContext(GrabGestureContext);
  if (!gesture) return <>{children}</>;
  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

/**
 * A bottom sheet on a native Modal whose motion runs on the UI thread.
 *
 * `Modal animationType="slide"` moved the dimmed backdrop up with the sheet,
 * as one slab. Here the backdrop only fades, the sheet springs up on the
 * shared V2 physics, tracks the finger when dragged by its grab zone, and a
 * release carries its velocity into either the dismissal or the snap back.
 *
 * The child is the sheet surface itself. Give it `flexShrink: 1` (this
 * wrapper caps the height at 80%) and extend it by `V2_SHEET_SKIRT`.
 */
export function V2SheetModal({
  visible,
  onClose,
  children,
  reduceMotion = false,
  scrimColor = 'rgba(23, 23, 20, 0.38)',
  scrimAccessibilityLabel = 'Close',
  testID,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const sheetHeight = useSharedValue(0);
  // Starts off-screen, so the frame before the first layout never shows the sheet in place.
  const translateY = useSharedValue(windowHeight);
  const scrim = useSharedValue(0);
  const presented = useSharedValue(false);
  const dragDismissing = useSharedValue(false);

  if (visible && !mounted) setMounted(true);
  // Read by the close paths, which can complete after the sheet was reopened.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const finishClose = useCallback(() => {
    if (visibleRef.current) return;
    presented.value = false;
    dragDismissing.value = false;
    translateY.value = windowHeight;
    setMounted(false);
  }, [dragDismissing, presented, translateY, windowHeight]);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      scrim.value = withTiming(1, { duration: AnchorMotion.duration.quick, easing: AnchorMotion.easing.enter });
      return;
    }
    scrim.value = withTiming(0, { duration: AnchorMotion.duration.quick, easing: AnchorMotion.easing.exit });
    // A drag dismissal is already travelling with the finger's velocity.
    if (dragDismissing.value) return;
    translateY.value = withTiming(
      reduceMotion ? translateY.value : sheetHeight.value + V2_SHEET_SKIRT,
      { duration: reduceMotion ? AnchorMotion.duration.micro : EXIT_MS, easing: AnchorMotion.easing.exit },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [dragDismissing, finishClose, mounted, reduceMotion, scrim, sheetHeight, translateY, visible]);

  // Normally the exit animation's completion unmounts the Modal. This timer
  // guarantees it if that UI-thread callback never arrives, so an invisible
  // Modal can never be left intercepting touches. Reopening cancels it. Keyed
  // on visibility alone, so unrelated re-renders cannot keep restarting it.
  useEffect(() => {
    if (!mounted || visible) return;
    const fallback = setTimeout(finishClose, EXIT_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [finishClose, mounted, visible]);

  /** The first layout gives the travel distance; the entrance starts from exactly off-screen. */
  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      sheetHeight.value = height;
      if (presented.value || !visible) return;
      presented.value = true;
      if (reduceMotion) {
        translateY.value = 0;
        return;
      }
      translateY.value = height + V2_SHEET_SKIRT;
      translateY.value = withSpring(0, AnchorMotion.spring.sheet);
    },
    [presented, reduceMotion, sheetHeight, translateY, visible],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .onUpdate((event) => {
          translateY.value = event.translationY >= 0 ? event.translationY : event.translationY * UPWARD_RESISTANCE;
        })
        .onEnd((event) => {
          const dismiss =
            event.translationY > sheetHeight.value * DISMISS_FRACTION || event.velocityY > DISMISS_VELOCITY;
          if (!dismiss) {
            translateY.value = withSpring(0, { ...AnchorMotion.spring.sheet, velocity: event.velocityY });
            return;
          }
          dragDismissing.value = true;
          translateY.value = withSpring(
            sheetHeight.value + V2_SHEET_SKIRT,
            // No bounce at the bottom: the sheet is leaving, not landing.
            { ...AnchorMotion.spring.sheet, velocity: event.velocityY, overshootClamping: true },
            (finished) => {
              if (finished) runOnJS(finishClose)();
            },
          );
          runOnJS(onClose)();
        }),
    [dragDismissing, finishClose, onClose, sheetHeight, translateY],
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} testID={testID}>
      <ModalGestureRoot style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, scrimStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={scrimAccessibilityLabel}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, sheetStyle]} onLayout={handleSheetLayout}>
          <GrabGestureContext.Provider value={pan}>{children}</GrabGestureContext.Provider>
        </Animated.View>
      </ModalGestureRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%' },
});
