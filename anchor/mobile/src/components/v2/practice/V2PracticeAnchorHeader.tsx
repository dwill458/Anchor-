import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { HandDrawnThreadLine } from '@/components/v2/thread/HandDrawnThreadLine';
import type { V2ThreadPresentation } from '@/adapters/v2/home/threadAdapter';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';

type Props = {
  anchor: Anchor;
  thread?: V2ThreadPresentation | null;
  onPress?: () => void;
  testID?: string;
};

/**
 * The Anchor reads as an object on the page, not as an account avatar, so it
 * is rendered `bare`: no disc, no rim, no badge. Large enough to be the mark
 * this header is about, small enough to stay subordinate to the Today hero.
 */
const ARTWORK_SIZE = 60;
/** The gutter between the mark and the text column it introduces. */
const ARTWORK_GUTTER = spacing[3];
/**
 * The chevron rides the first line of the intention rather than the centre of
 * a row whose height moves with the wrap, so it stays put as intentions grow.
 * Half of (line height - icon) drops it onto that line's optical centre.
 */
const INTENTION_LINE_HEIGHT = 22;
const CHEVRON_SIZE = 18;
const CHEVRON_TOP_OFFSET = (INTENTION_LINE_HEIGHT - CHEVRON_SIZE) / 2;

export function V2PracticeAnchorHeader({
  anchor,
  thread,
  onPress,
  testID = 'v2-practice-anchor-header',
}: Props) {
  const categoryColor = getCategoryColor(anchor.category);
  const isMeasured = Boolean(thread && !thread.unmeasured && typeof thread.value === 'number');

  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Active Anchor: ${anchor.intentionText}, category ${categoryLabel(anchor.category)}${
        isMeasured ? `, Consistency ${thread?.value}%` : ', Consistency not established yet'
      }. Tap to switch Anchor.`}
      style={({ pressed }) => [styles.container, pressed && onPress && styles.pressed]}
    >
      {/* Contextual metadata, aligned to the text column it labels. */}
      <Text style={styles.eyebrow}>ACTIVE ANCHOR</Text>

      <View style={styles.row}>
        <View style={styles.artworkWrapper}>
          <CircularAnchorRenderer
            {...anchorRenderProps(anchor)}
            size={ARTWORK_SIZE}
            appearance="bare"
            accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
          />
        </View>

        <View style={styles.info}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.intention}>
            {anchor.intentionText}
          </Text>

          <View style={styles.threadBlock}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaCategory, { color: categoryColor }]}>{categoryLabel(anchor.category)}</Text>
              {!isMeasured ? <Text style={styles.metaStatus}>Baseline not established</Text> : null}
            </View>
            {/* DEFERRED: braided multi-strand ThreadStrength replaced here by the single hand-drawn line; other screens still use it.
            <ThreadStrength percent={isMeasured ? thread!.value! : 0} color={colors.text.secondary} height={18} showMetrics={false} reduceMotion inactiveColor={colors.text.disabled} inactiveOpacity={0.35} testID="v2-practice-thread-strength" style={styles.threadStrength} /> */}
            <HandDrawnThreadLine
              percent={isMeasured ? thread!.value! : 0}
              unmeasured={!isMeasured}
              color={categoryColor}
              trackColor="rgba(255, 255, 255, 0.18)"
              labelColor={colors.ink.text.primary}
              testID="v2-practice-thread-strength"
              style={styles.threadStrength}
            />
          </View>
        </View>

        <View style={styles.chevronWrapper}>
          <ChevronDown size={CHEVRON_SIZE} color={colors.ink.text.secondary} strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // No card, no glass, no rule: this is type set directly on the dark canvas.
    backgroundColor: 'transparent',
    paddingVertical: spacing[1],
  },
  pressed: {
    opacity: 0.72,
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.ink.text.secondary,
    fontSize: 9.5,
    letterSpacing: 1,
    fontWeight: '700',
    textTransform: 'uppercase',
    // Sits over the text column, not over the mark.
    marginLeft: ARTWORK_SIZE + ARTWORK_GUTTER,
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    // Top-aligned so a wrapping intention pushes downward and nothing drifts.
    alignItems: 'flex-start',
    gap: ARTWORK_GUTTER,
    minHeight: 44,
  },
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  intention: {
    fontFamily: typography.displayBold,
    fontSize: 17,
    lineHeight: INTENTION_LINE_HEIGHT,
    letterSpacing: -0.3,
    color: colors.ink.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  threadBlock: { marginTop: 4 },
  threadStrength: { marginTop: 1 },
  /** The only colour in the group — category accent at punctuation weight. */
  metaCategory: {
    ...typography.labelSM,
    fontSize: 12,
    letterSpacing: 0.2,
    fontWeight: '600',
    textTransform: 'none',
  },
  metaStatus: {
    ...typography.caption,
    color: colors.ink.text.secondary,
    fontSize: 12.5,
    flexShrink: 1,
  },
  chevronWrapper: {
    alignItems: 'center',
    // Aligned to the intention's first line; padding keeps the touch area wide
    // even though the glyph itself stays quiet.
    paddingTop: CHEVRON_TOP_OFFSET,
    paddingLeft: spacing[2],
  },
});
