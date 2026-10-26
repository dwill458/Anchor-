import type { ScrollViewInstance } from 'react-native';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Platform,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { spacing } from '@/theme/v2';

type Props = {
  children: React.ReactNode;
  /** Pinned under the scroll, riding directly above the keyboard when it is open. */
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  /** Extra space kept under the footer when the keyboard is closed. */
  restingBottom?: number;
  /** A native modal may move its whole surface above the keyboard itself. */
  externalKeyboard?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** A new proposal always opens at its headline, regardless of prior scroll. */
  resetKey?: string | number;
  /** Review can also live in a native modal, outside the activity keyboard observer. */
  nativeKeyboardFallback?: boolean;
};

/** Breathing room kept between a focused field and the action bar. */
const CLEARANCE = spacing[4];

/**
 * Keyboard-aware layout for Chart's inputs, identical on iOS and Android.
 *
 * The app draws edge to edge, so Android no longer resizes the window for the
 * keyboard (and `KeyboardAvoidingView` has no reliable Android behaviour). The
 * keyboard height is read on the UI thread and applied as the footer's bottom
 * padding, so the action bar tracks the keyboard frame by frame and the scroll
 * viewport shrinks with it — no hardcoded offsets. When the viewport shrinks,
 * the focused field is scrolled into view only if it would otherwise be hidden.
 */
export function ChartKeyboardFrame({
  children,
  footer,
  contentContainerStyle,
  footerStyle,
  restingBottom = spacing[3],
  externalKeyboard = false,
  style,
  testID,
  resetKey,
  nativeKeyboardFallback = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const fallbackHeight = useSharedValue(0);
  useEffect(() => {
    if (!nativeKeyboardFallback) return;
    fallbackHeight.value = keyboard.height.value === 0 ? Keyboard.metrics()?.height ?? 0 : 0;
    const show = Keyboard.addListener('keyboardDidShow', event => {
      // The UI-thread observer remains authoritative whenever it is receiving frames.
      fallbackHeight.value = keyboard.height.value === 0 ? event.endCoordinates.height : 0;
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => { fallbackHeight.value = 0; });
    return () => { show.remove(); hide.remove(); };
  }, [nativeKeyboardFallback, keyboard.height, fallbackHeight]);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const viewport = useRef(0);
  const focusedWithin = useRef(resetKey === undefined);
  useLayoutEffect(() => {
    if (resetKey === undefined) return;
    focusedWithin.current = false;
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [resetKey]);

  const revealFocused = useCallback(() => {
    // Ask stays mounted during hand-off. Its global focused input must never scroll a new review.
    if (!focusedWithin.current) return;
    const focused = TextInput.State.currentlyFocusedInput?.() as unknown as
      | { measureLayout?: (relativeTo: unknown, onSuccess: (x: number, y: number, w: number, h: number) => void, onFail?: () => void) => void }
      | null;
    const scroll = scrollRef.current as unknown as { getInnerViewRef?: () => unknown } | null;
    const inner = scroll?.getInnerViewRef?.();
    if (!focused?.measureLayout || !inner || viewport.current <= 0) return;
    focused.measureLayout(
      inner,
      (_x, y, _w, h) => {
        const visibleTop = scrollY.current;
        const visibleBottom = scrollY.current + viewport.current - CLEARANCE;
        if (y >= visibleTop && y + h <= visibleBottom) return;
        // Show the whole field if it fits, otherwise its top (where typing starts to read).
        const target = h + CLEARANCE * 2 > viewport.current ? y - spacing[2] : y + h - viewport.current + CLEARANCE;
        scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false });
      },
      () => undefined
    );
  }, []);

  const footerAnimated = useAnimatedStyle(() => ({
    paddingBottom: externalKeyboard ? restingBottom : Math.max(keyboard.height.value || fallbackHeight.value, insets.bottom) + restingBottom,
  }));

  return (
    <Animated.View style={[styles.flex, style]} testID={testID}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        onLayout={(event: LayoutChangeEvent) => {
          // The viewport shrinks as the footer rides up with the keyboard.
          viewport.current = event.nativeEvent.layout.height;
          revealFocused();
        }}
        onContentSizeChange={revealFocused}
        onFocus={() => { focusedWithin.current = true; revealFocused(); }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <Animated.View style={[footerStyle, footerAnimated]}>{footer}</Animated.View>
      ) : (
        // No action bar: keep the same keyboard clearance with an empty spacer.
        <Animated.View style={footerAnimated} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
