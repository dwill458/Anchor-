import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { colors } from '@/theme/v2/colors';
import { typography } from '@/theme/v2/typography';
import { safeHaptics } from '@/utils/haptics';
import { fromHHmm, toHHmm } from '@/utils/reminderTime';
import { useNotificationReduceMotion } from './notificationMotion';
import {
  ROW_HEIGHT,
  WHEEL_HEIGHT,
  WHEEL_PADDING,
  indexFromOffset,
  offsetFromIndex,
} from './timeWheelLayout';

export interface TimeWheelProps {
  /** Local wall-clock `HH:mm` (24h, zero-padded). */
  value: string;
  /** Called with the next `HH:mm` once a column settles (never per frame). */
  onChange: (next: string) => void;
  /** 0-23 hours and no AM/PM column. Defaults to 12-hour. */
  use24h?: boolean;
  /**
   * Optional: true while any column is being dragged or is still decelerating, false once all have
   * settled. Fires per gesture, never per frame. ReminderTimeSheet uses it to hold Done until the
   * in-flight value has landed.
   */
  onSettlingChange?: (settling: boolean) => void;
}

/** Post-drag wait before a release that never started momentum is committed anyway. */
const POST_DRAG_FALLBACK_MS = 250;

type WheelItem = { key: string; label: string };

const pad = (n: number): string => String(n).padStart(2, '0');

const MINUTE_ITEMS: WheelItem[] = Array.from({ length: 60 }, (_, m) => ({ key: String(m), label: pad(m) }));
const HOUR_12_ITEMS: WheelItem[] = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }));
const HOUR_24_ITEMS: WheelItem[] = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: pad(h) }));
const MERIDIEM_ITEMS: WheelItem[] = [
  { key: 'AM', label: 'AM' },
  { key: 'PM', label: 'PM' },
];

const triggerSelectionHaptic = () => {
  void safeHaptics.selection();
};

/* ── Row ───────────────────────────────────────────────────────── */

interface WheelRowProps {
  item: WheelItem;
  index: number;
  scrollY: SharedValue<number>;
  reduceMotion: boolean;
  testID: string;
}

/** One entry. Opacity (and scale, unless Reduced Motion) are derived on the UI thread from scroll position. */
const WheelRow = memo(({ item, index, scrollY, reduceMotion, testID }: WheelRowProps) => {
  const rowStyle = useAnimatedStyle(() => {
    const d = Math.abs(scrollY.value / ROW_HEIGHT - index);
    const opacity = interpolate(d, [0, 1, 2, 3], [1, 0.5, 0.24, 0.1], Extrapolation.CLAMP);
    if (reduceMotion) return { opacity };
    const scale = interpolate(d, [0, 1, 2], [1, 0.9, 0.8], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });
  // The bold face cross-fades in only for the centred row, so neighbours read lighter.
  const boldStyle = useAnimatedStyle(() => {
    const d = Math.abs(scrollY.value / ROW_HEIGHT - index);
    return { opacity: interpolate(d, [0, 0.6], [1, 0], Extrapolation.CLAMP) };
  });

  return (
    <Animated.View testID={testID} style={[styles.row, rowStyle]}>
      <Text style={[styles.rowText, styles.rowTextRegular]}>{item.label}</Text>
      <Animated.View style={[StyleSheet.absoluteFill, styles.rowBold, boldStyle]}>
        <Text style={[styles.rowText, styles.rowTextBold]}>{item.label}</Text>
      </Animated.View>
    </Animated.View>
  );
});
WheelRow.displayName = 'WheelRow';

/* ── Column ────────────────────────────────────────────────────── */

interface WheelColumnProps {
  testID: string;
  label: string;
  items: WheelItem[];
  /** Index the wheel should show; re-applied when it changes from outside. */
  index: number;
  onSettle: (index: number) => void;
  onSettlingChange: (settling: boolean) => void;
  reduceMotion: boolean;
  flex?: number;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  testID,
  label,
  items,
  index,
  onSettle,
  onSettlingChange,
  reduceMotion,
  flex = 1,
}) => {
  const count = items.length;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(offsetFromIndex(index));
  const lastIndex = useSharedValue(index);
  const committedRef = useRef(index);
  const initialContentOffset = useRef({ x: 0, y: offsetFromIndex(index) }).current;
  // Updated once per settle, never per scroll frame.
  const [announcedIndex, setAnnouncedIndex] = useState(index);

  const scrollToIndex = useCallback(
    (target: number) => {
      const y = offsetFromIndex(target);
      scrollY.value = y;
      lastIndex.value = target;
      scrollRef.current?.scrollTo?.({ y, animated: false });
    },
    [lastIndex, scrollY],
  );

  // Settling gate: set on drag begin, cleared once the final value is committed.
  const settlingRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDragIndexRef = useRef(index);
  const setSettling = useCallback(
    (next: boolean) => {
      if (settlingRef.current === next) return;
      settlingRef.current = next;
      onSettlingChange(next);
    },
    [onSettlingChange],
  );
  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);
  useEffect(() => clearFallback, [clearFallback]);

  // Initial position: `contentOffset` places the wheel on first layout; once the content has a size
  // (Android clamps a scrollTo issued before that to 0) scroll once more, guarded so it runs once.
  // scrollY/lastIndex already hold the target, so neither step fires a selection haptic.
  const initialScrolledRef = useRef(false);
  const handleContentSizeChange = useCallback(() => {
    if (initialScrolledRef.current) return;
    initialScrolledRef.current = true;
    scrollRef.current?.scrollTo?.({ y: offsetFromIndex(committedRef.current), animated: false });
  }, []);

  // External value change (e.g. the sheet reopened with another time).
  const propIndexRef = useRef(index);
  useEffect(() => {
    // Only a change of the prop itself counts; a parent that ignores onChange must not undo the user's pick.
    if (index === propIndexRef.current) return;
    propIndexRef.current = index;
    if (index === committedRef.current) return;
    committedRef.current = index;
    setAnnouncedIndex(index);
    scrollToIndex(index);
  }, [index, scrollToIndex]);

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(count - 1, Math.max(0, next));
      if (clamped === committedRef.current) return;
      committedRef.current = clamped;
      setAnnouncedIndex(clamped);
      onSettle(clamped);
    },
    [count, onSettle],
  );

  // UI-thread scroll handler: drives row styling and fires the selection haptic only when the centred row changes.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const next = indexFromOffset(event.contentOffset.y, count);
      if (next !== lastIndex.value) {
        lastIndex.value = next;
        runOnJS(triggerSelectionHaptic)();
      }
    },
  });

  const handleBeginDrag = useCallback(() => {
    clearFallback();
    setSettling(true);
  }, [clearFallback, setSettling]);

  const handleMomentumBegin = useCallback(() => {
    clearFallback();
  }, [clearFallback]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearFallback();
      commit(indexFromOffset(e.nativeEvent.contentOffset.y, count));
      setSettling(false);
    },
    [clearFallback, commit, count, setSettling],
  );

  const handleDragEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearFallback();
      const dragIndex = indexFromOffset(e.nativeEvent.contentOffset.y, count);
      lastDragIndexRef.current = dragIndex;
      // A release with velocity starts momentum, whose end commits. A stationary release settles here.
      const vy = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(vy) < 0.05) {
        commit(dragIndex);
        setSettling(false);
        return;
      }
      // Safety net: if momentum never begins, commit where the finger left the wheel.
      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null;
        commit(lastDragIndexRef.current);
        setSettling(false);
      }, POST_DRAG_FALLBACK_MS);
    },
    [clearFallback, commit, count, setSettling],
  );

  const handleAccessibilityAction = useCallback(
    (e: { nativeEvent: { actionName: string } }) => {
      const step = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
      if (!step) return;
      const target = Math.min(count - 1, Math.max(0, committedRef.current + step));
      if (target === committedRef.current) return;
      scrollToIndex(target);
      commit(target);
    },
    [commit, count, scrollToIndex],
  );

  const accessibilityActions = useMemo(
    () => [{ name: 'increment' as const }, { name: 'decrement' as const }],
    [],
  );

  return (
    <Animated.ScrollView
      ref={scrollRef}
      testID={testID}
      style={[styles.column, { flex }]}
      contentContainerStyle={styles.columnContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      scrollEventThrottle={16}
      snapToInterval={ROW_HEIGHT}
      snapToAlignment="start"
      decelerationRate="fast"
      contentOffset={initialContentOffset}
      onContentSizeChange={handleContentSizeChange}
      onScroll={scrollHandler}
      onScrollBeginDrag={handleBeginDrag}
      onMomentumScrollBegin={handleMomentumBegin}
      onMomentumScrollEnd={handleMomentumEnd}
      onScrollEndDrag={handleDragEnd}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[announcedIndex]?.label ?? '' }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
    >
      {items.map((item, i) => (
        <WheelRow
          key={item.key}
          item={item}
          index={i}
          scrollY={scrollY}
          reduceMotion={reduceMotion}
          testID={`${testID}-row-${item.key}`}
        />
      ))}
    </Animated.ScrollView>
  );
};

/* ── Wheel ─────────────────────────────────────────────────────── */

export const TimeWheel: React.FC<TimeWheelProps> = ({ value, onChange, use24h = false, onSettlingChange }) => {
  const reduceMotion = useNotificationReduceMotion();

  const parts = useMemo(() => {
    const t = fromHHmm(value);
    const hour24 = t.meridiem === 'PM' ? (t.hour12 % 12) + 12 : t.hour12 % 12;
    return {
      hourIndex: use24h ? hour24 : t.hour12 - 1,
      minuteIndex: t.minute,
      meridiemIndex: t.meridiem === 'PM' ? 1 : 0,
    };
  }, [value, use24h]);

  // Latest selection across columns; columns settle independently, so keep it out of React state.
  const selectionRef = useRef(parts);
  useEffect(() => {
    selectionRef.current = parts;
  }, [parts]);

  const emit = useCallback(
    (next: { hourIndex: number; minuteIndex: number; meridiemIndex: number }) => {
      selectionRef.current = next;
      if (use24h) {
        onChange(`${pad(next.hourIndex)}:${pad(next.minuteIndex)}`);
      } else {
        onChange(
          toHHmm({
            hour12: next.hourIndex + 1,
            minute: next.minuteIndex,
            meridiem: next.meridiemIndex === 1 ? 'PM' : 'AM',
          }),
        );
      }
    },
    [onChange, use24h],
  );

  // Aggregate per-column settling into one flag.
  const settlingColumnsRef = useRef(new Set<string>());
  const onSettlingRef = useRef(onSettlingChange);
  onSettlingRef.current = onSettlingChange;
  const makeSettlingHandler = useCallback(
    (id: string) => (settling: boolean) => {
      const set = settlingColumnsRef.current;
      const before = set.size > 0;
      if (settling) set.add(id);
      else set.delete(id);
      const after = set.size > 0;
      if (before !== after) onSettlingRef.current?.(after);
    },
    [],
  );
  const hourSettling = useMemo(() => makeSettlingHandler('hour'), [makeSettlingHandler]);
  const minuteSettling = useMemo(() => makeSettlingHandler('minute'), [makeSettlingHandler]);
  const meridiemSettling = useMemo(() => makeSettlingHandler('meridiem'), [makeSettlingHandler]);

  const onHour = useCallback((i: number) => emit({ ...selectionRef.current, hourIndex: i }), [emit]);
  const onMinute = useCallback((i: number) => emit({ ...selectionRef.current, minuteIndex: i }), [emit]);
  const onMeridiem = useCallback((i: number) => emit({ ...selectionRef.current, meridiemIndex: i }), [emit]);

  return (
    <View style={styles.wheel} testID="time-wheel">
      <View pointerEvents="none" style={styles.band} />
      <WheelColumn
        testID="time-wheel-hour"
        label="Hour"
        items={use24h ? HOUR_24_ITEMS : HOUR_12_ITEMS}
        index={parts.hourIndex}
        onSettle={onHour}
        onSettlingChange={hourSettling}
        reduceMotion={reduceMotion}
      />
      <View pointerEvents="none" style={styles.divider} />
      <WheelColumn
        testID="time-wheel-minute"
        label="Minute"
        items={MINUTE_ITEMS}
        index={parts.minuteIndex}
        onSettle={onMinute}
        onSettlingChange={minuteSettling}
        reduceMotion={reduceMotion}
      />
      {use24h ? null : (
        <>
          <View pointerEvents="none" style={styles.divider} />
          <WheelColumn
            testID="time-wheel-meridiem"
            label="AM or PM"
            items={MERIDIEM_ITEMS}
            index={parts.meridiemIndex}
            onSettle={onMeridiem}
            onSettlingChange={meridiemSettling}
            reduceMotion={reduceMotion}
            flex={0.9}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wheel: {
    height: WHEEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: ROW_HEIGHT,
    borderRadius: 14,
    backgroundColor: colors.grouped,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    height: ROW_HEIGHT * 3,
    backgroundColor: colors.border.default,
  },
  column: {
    height: WHEEL_HEIGHT,
  },
  columnContent: {
    paddingVertical: WHEEL_PADDING,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBold: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 22,
    lineHeight: 28,
    color: colors.text.primary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rowTextRegular: {
    ...typography.utility,
  },
  rowTextBold: {
    ...typography.utilityBold,
    fontWeight: '700',
  },
});
