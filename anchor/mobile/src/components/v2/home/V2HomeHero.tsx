import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import { anchorPositionLabel } from '@/constants/v2/home';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary, V2ThreadPresentation } from '@/adapters/v2/home';
import { V2HomeAnchorCarousel } from './V2HomeAnchorCarousel';

type Props = {
  anchors: V2HomeAnchorSummary[];
  selectedIndex: number;
  onSelect: (anchorId: string) => void;
  onOpenActive?: (anchorId: string) => void;
  onOpenProgress?: () => void;
  /** Opens the full Anchor library. Home is the only entry point to it. */
  onOpenAllAnchors?: () => void;
  thread: V2ThreadPresentation | null;
  reduceMotion?: boolean;
  testID?: string;
};

/**
 * One restrained hand-drawn accent under the intention. It is intentionally
 * short, off-centre and slightly uneven — a mark, not an underline rule.
 */
function IntentionMark({ color }: { color: string }) {
  return (
    <Svg width={88} height={7} viewBox="0 0 88 7" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M1.5 4.4C22 2.1 47 1.3 86 2.6" stroke={color} strokeWidth={2.1} strokeLinecap="round" opacity={0.72} />
      <Path d="M8 5.8C29 4.4 52 4.1 74 4.9" stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.34} />
    </Svg>
  );
}

/**
 * Compact contextual Thread Strength reading. The brief is explicit that this
 * belongs inside the cream hero and that "Not yet measured" must never be the
 * largest typography on Home, so the null state stays in this same small row.
 * `value` and `delta` are server-authoritative; nothing here derives movement.
 */
function ThreadReading({ thread, accent }: { thread: V2ThreadPresentation; accent: string }) {
  const measured = thread.value !== null;
  const delta = thread.delta;
  const hasDelta = measured && typeof delta === 'number' && Number.isFinite(delta);
  return (
    <View testID="v2-home-thread-reading" style={styles.threadRow}>
      {measured ? (
        <Text testID="v2-home-thread-value" style={[styles.threadValue, { color: accent }]}>
          {`${thread.value}%`}
        </Text>
      ) : null}
      <Text style={styles.threadLabel}>Thread Strength</Text>
      {measured ? (
        hasDelta ? (
          <Text testID="v2-home-thread-delta" style={styles.threadDelta}>
            {`· ${(delta as number) > 0 ? '+' : ''}${delta} this week`}
          </Text>
        ) : null
      ) : (
        <Text testID="v2-home-thread-unmeasured" style={styles.threadDelta}>
          · Not yet measured
        </Text>
      )}
    </View>
  );
}

/**
 * The cream hero world: category + position, the Anchor carousel, the active
 * intention, and a compact strength reading. Everything here re-derives from
 * the selected Anchor, so a swipe replaces the whole block at once.
 */
export function V2HomeHero({ anchors, selectedIndex, onSelect, onOpenActive, onOpenProgress, onOpenAllAnchors, thread, reduceMotion, testID }: Props) {
  const index = selectedIndex >= 0 && selectedIndex < anchors.length ? selectedIndex : 0;
  const active = anchors[index];
  if (!active) return null;

  const anchor = active.anchor;
  const accent = getCategoryColor(anchor.category);

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.contextRow}>
        <View style={styles.categoryGroup}>
          <View style={[styles.categoryDash, { backgroundColor: accent }]} />
          <Text style={styles.categoryText}>{categoryLabel(anchor.category).toUpperCase()}</Text>
        </View>
        {anchors.length > 1 ? (
          /**
           * The numeric position is authoritative (the brief forbids a row of
           * dots), and it doubles as the only route into the Anchor library
           * now that the "Your Anchors" rail is gone.
           */
          <Pressable
            testID="v2-home-anchor-position"
            accessibilityRole={onOpenAllAnchors ? 'button' : undefined}
            accessibilityLabel={
              onOpenAllAnchors
                ? `Anchor ${index + 1} of ${anchors.length}. View all Anchors.`
                : `Anchor ${index + 1} of ${anchors.length}.`
            }
            onPress={onOpenAllAnchors}
            disabled={!onOpenAllAnchors}
            hitSlop={12}
            style={({ pressed }) => (pressed && onOpenAllAnchors ? styles.pressed : undefined)}
          >
            <Text style={styles.positionText}>{anchorPositionLabel(index, anchors.length)}</Text>
          </Pressable>
        ) : onOpenAllAnchors ? (
          /**
           * A single Anchor has no position to report, but the library still
           * holds released Anchors, so the route must stay reachable.
           */
          <Pressable
            testID="v2-home-all-anchors"
            accessibilityRole="button"
            accessibilityLabel="View all Anchors"
            onPress={onOpenAllAnchors}
            hitSlop={12}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={styles.positionText}>ALL ANCHORS</Text>
          </Pressable>
        ) : null}
      </View>

      <V2HomeAnchorCarousel
        testID="v2-home-carousel"
        anchors={anchors}
        selectedIndex={index}
        onSelect={onSelect}
        onOpenActive={onOpenActive}
        reduceMotion={reduceMotion}
      />

      <View style={styles.intentionBlock}>
        <Text testID="v2-home-intention" style={styles.intention}>
          {anchor.intentionText}
        </Text>
        <View style={styles.intentionMark}>
          <IntentionMark color={accent} />
        </View>
      </View>

      {thread ? (
        <Pressable
          testID="v2-home-thread"
          accessibilityRole={onOpenProgress ? 'button' : undefined}
          accessibilityLabel={
            thread.value === null
              ? 'Thread Strength not yet measured. Open Progress.'
              : `Thread Strength ${thread.value} percent. Open Progress.`
          }
          onPress={onOpenProgress}
          disabled={!onOpenProgress}
          style={({ pressed }) => (pressed && onOpenProgress ? styles.pressed : undefined)}
        >
          <ThreadReading thread={thread} accent={accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  categoryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  categoryDash: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  categoryText: {
    fontFamily: typography.bodyBold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.text.secondary,
  },
  positionText: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  intentionBlock: {
    marginTop: 18,
  },
  intention: {
    fontFamily: typography.displayBold,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -1.3,
    color: colors.text.primary,
  },
  intentionMark: {
    marginTop: 7,
    marginLeft: 3,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 18,
  },
  threadValue: {
    fontFamily: typography.displayBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  threadLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.primary,
  },
  threadDelta: {
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
