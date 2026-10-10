import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/v2/colors';
import { typography } from '@/theme/v2/typography';
import { NOTIFICATION_MOTION, useNotificationReduceMotion, usePressScale } from './notificationMotion';
import { TimeWheel } from './TimeWheel';
import { sheetBottomPadding, sheetMaxHeight } from './timeWheelLayout';

export interface ReminderTimeSheetProps {
  open: boolean;
  /** Current reminder time, local wall-clock `HH:mm`. */
  value: string;
  /** Called with the chosen `HH:mm` when Done is pressed. The parent closes the sheet. */
  onConfirm: (time: string) => void;
  onClose: () => void;
  use24h?: boolean;
}

/** Done waits at most this long for a still-settling wheel before confirming the latest value. */
const SETTLE_TIMEOUT_MS = 600;

/**
 * Bottom-anchored time picker. Renders as an absolute overlay, so mount it inside a full-screen
 * parent. Rises with a spring (opacity-only under Reduced Motion).
 */
export const ReminderTimeSheet: React.FC<ReminderTimeSheetProps> = ({
  open,
  value,
  onConfirm,
  onClose,
  use24h = false,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useNotificationReduceMotion();
  const press = usePressScale(reduceMotion);
  const titleRef = useRef<Text>(null);

  const [mounted, setMounted] = useState(open);
  const [donePending, setDonePending] = useState(false);
  const bottomPadding = sheetBottomPadding(insets.bottom);
  const maxHeight = sheetMaxHeight(windowHeight, insets.top, bottomPadding);
  const travel = maxHeight;
  const progress = useSharedValue(0);
  const translateY = useSharedValue(travel);

  const draftRef = useRef(value);
  // Latest props, read by effects that must not re-run when they change.
  const valueRef = useRef(value);
  valueRef.current = value;
  const travelRef = useRef(travel);
  travelRef.current = travel;
  const confirmedRef = useRef(false);
  const settlingRef = useRef(false);
  const pendingConfirmRef = useRef(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A fresh wheel per opening, so reopening mid-exit shows the new value rather than stale scroll state.
  const wasOpenRef = useRef(false);
  const openSeqRef = useRef(0);
  if (open && !wasOpenRef.current) openSeqRef.current += 1;
  wasOpenRef.current = open;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const clearSettleTimeout = useCallback(() => {
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
  }, []);
  useEffect(() => clearSettleTimeout, [clearSettleTimeout]);

  /** Drops any Done that is waiting on a settling wheel (close, reopen). */
  const cancelPending = useCallback(() => {
    clearSettleTimeout();
    pendingConfirmRef.current = false;
    settlingRef.current = false;
    setDonePending(false);
  }, [clearSettleTimeout]);

  const requestClose = useCallback(() => {
    cancelPending();
    onCloseRef.current();
  }, [cancelPending]);

  // Draft reset happens once per open/close transition only. Layout changes while open
  // (window rotation, inset changes) must not reset the user's wheel pick or drop a pending Done.
  useEffect(() => {
    cancelPending();
    if (open) {
      draftRef.current = valueRef.current;
      confirmedRef.current = false;
    }
  }, [open, cancelPending]);

  // Open / close animation.
  useEffect(() => {
    const duration = reduceMotion ? NOTIFICATION_MOTION.reducedMs : NOTIFICATION_MOTION.screenMs;
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
      translateY.value = reduceMotion ? 0 : withSpring(0, { ...NOTIFICATION_MOTION.settleSpring, overshootClamping: true });
      return;
    }
    translateY.value = reduceMotion ? 0 : withTiming(travelRef.current, { duration, easing: Easing.out(Easing.cubic) });
    progress.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [open, reduceMotion, progress, translateY]);

  // Move screen-reader focus into the sheet once it is up.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      try {
        const handle = titleRef.current ? findNodeHandle(titleRef.current) : null;
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      } catch {
        // Focus is a nicety; never fail the sheet over it.
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [open]);

  // Hardware back closes the sheet and is consumed.
  useEffect(() => {
    if (!open) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, requestClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value } : { transform: [{ translateY: translateY.value }] },
  );

  const confirmNow = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    pendingConfirmRef.current = false;
    setDonePending(false);
    clearSettleTimeout();
    onConfirm(draftRef.current);
  }, [clearSettleTimeout, onConfirm]);

  const handleChange = useCallback((next: string) => {
    draftRef.current = next;
  }, []);

  const handleSettlingChange = useCallback(
    (settling: boolean) => {
      settlingRef.current = settling;
      if (!settling && pendingConfirmRef.current) confirmNow();
    },
    [confirmNow],
  );

  // Done while a wheel is still moving waits for it to land (bounded), then confirms the final value.
  const handleDone = useCallback(() => {
    if (confirmedRef.current) return;
    if (!settlingRef.current) {
      confirmNow();
      return;
    }
    pendingConfirmRef.current = true;
    setDonePending(true);
    if (!settleTimeoutRef.current) {
      settleTimeoutRef.current = setTimeout(() => {
        settleTimeoutRef.current = null;
        confirmNow();
      }, SETTLE_TIMEOUT_MS);
    }
  }, [confirmNow]);

  if (!mounted && !open) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable
          testID="reminder-time-sheet-backdrop"
          style={styles.backdrop}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Close time picker"
        />
      </Animated.View>
      <Animated.View
        testID="reminder-time-sheet"
        accessibilityViewIsModal
        importantForAccessibility="yes"
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.sheet, { paddingBottom: bottomPadding, maxHeight }, sheetStyle]}
      >
        <View style={styles.handle} />
        <Text ref={titleRef} style={styles.title} accessibilityRole="header">
          Reminder time
        </Text>
        <View style={styles.wheelWrap}>
          <TimeWheel
            key={openSeqRef.current}
            value={value}
            onChange={handleChange}
            onSettlingChange={handleSettlingChange}
            use24h={use24h}
          />
        </View>
        <Animated.View style={press.style}>
          <Pressable
            testID="reminder-time-sheet-done"
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={handleDone}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            style={[styles.done, donePending && styles.donePending]}
            accessibilityState={{ busy: donePending }}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 32, 62, 0.38)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.strong,
    marginBottom: 12,
  },
  title: {
    ...typography.utilitySemibold,
    fontSize: 17,
    lineHeight: 28,
    textAlign: 'center',
    color: colors.text.primary,
    marginBottom: 16,
  },
  wheelWrap: {
    marginBottom: 20,
    flexShrink: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  done: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePending: {
    opacity: 0.6,
  },
  doneText: {
    ...typography.utilitySemibold,
    fontSize: 16,
    color: colors.text.inverse,
  },
});
