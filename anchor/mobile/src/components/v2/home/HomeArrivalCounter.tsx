import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { releaseWindowProgress, useHomeArrivalContext } from './homeArrival';

/** One line of the rolling counter: the prototype's 1.25em, rounded to a whole point. */
const ROLL_LINE_FACTOR = 1.25;

/**
 * The hero's "N OF M" position counter.
 *
 * At rest, and for every arrival but one, it is exactly the plain text it always was. During a release
 * arrival it rolls down by one: M rolls out and the new M rolls in (translateY 0 to minus one line,
 * 800 to 1200ms), but only when Home now counts fewer Anchors than it did before the release. A count
 * that did not decrease, or a Home that does not know the previous count, never rolls.
 */
export function HomeArrivalCounter({ index, total, active, style }: {
  index: number;
  total: number;
  /** Only the centred item rolls; the neighbours' counters are hidden anyway. */
  active: boolean;
  style: StyleProp<TextStyle>;
}) {
  const arrival = useHomeArrivalContext();
  const motion = active ? arrival?.release ?? null : null;
  const before = motion?.countBefore ?? null;
  const counter = motion?.windows.counter;
  if (!motion || !arrival || !counter || before === null || before <= total) {
    return <Text style={style}>{`${index + 1} OF ${total}`}</Text>;
  }
  return (
    <CounterRoll
      index={index}
      before={before}
      total={total}
      style={style}
      start={counter[0]}
      end={counter[1]}
      progress={arrival.progress}
    />
  );
}

function CounterRoll({ index, before, total, style, start, end, progress }: {
  index: number;
  before: number;
  total: number;
  style: StyleProp<TextStyle>;
  start: number;
  end: number;
  progress: { value: number };
}) {
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 10;
  const line = Math.round(fontSize * ROLL_LINE_FACTOR);
  const rollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -line * releaseWindowProgress(progress.value, start, end) }],
  }));
  return (
    <View style={styles.row} testID="v2-home-counter-roll">
      <Text style={style}>{`${index + 1} OF `}</Text>
      <View style={{ height: line, overflow: 'hidden' }}>
        <Animated.View style={rollStyle}>
          <Text testID="v2-home-counter-before" style={[style, { lineHeight: line, height: line }]}>{before}</Text>
          <Text testID="v2-home-counter-after" style={[style, { lineHeight: line, height: line }]}>{total}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
