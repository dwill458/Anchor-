import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';

/**
 * The static pieces of the cream Intention screen. The live screen composes these with real
 * behaviour; the creation flow composes the same pieces, inert, as the "ghost" that fades out
 * while the typed words glide into the flow — so the two can never drift apart.
 */

export const INTENTION_FONTS = {
  serif: 'EBGaramond-Regular',
  serifItalic: 'EBGaramond-Italic',
  sans: 'Figtree-Regular',
  sansBold: 'Figtree-SemiBold',
} as const;

export const INTENTION_SIDE_PADDING = 24;

export function IntentionHeader() {
  const [hereWidth, setHereWidth] = useState(0);
  const onHereLayout = (event: LayoutChangeEvent) => setHereWidth(event.nativeEvent.layout.width);

  return (
    <View>
      <Text style={styles.eyebrow}>INTENTION</Text>
      <Text style={styles.headline} accessibilityRole="header">
        Every Anchor starts
      </Text>
      <View style={styles.hereWrap} onLayout={onHereLayout}>
        <Text style={styles.headline}>here.</Text>
        {hereWidth > 0 ? (
          // A single hand-drawn stroke under the last word.
          <Svg width={hereWidth + 8} height={10} style={styles.underline}>
            <Path
              d={`M 1 6 C ${hereWidth * 0.3} 9 ${hereWidth * 0.6} 1 ${hereWidth + 4} 4`}
              stroke={colors.creation.ink}
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        ) : null}
      </View>
      <Text style={styles.subcopy}>Write one clear intention.</Text>
    </View>
  );
}

export function IntentionFieldLabel({ count, max }: { count: number; max: number }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.fieldLabel}>YOUR INTENTION</Text>
      <Text style={styles.count}>{`${count}/${max}`}</Text>
    </View>
  );
}

export function IntentionRule() {
  return <View style={styles.rule} />;
}

export function StaticHints() {
  return (
    <View style={styles.hints}>
      <Text style={styles.insteadOf}>
        {'Instead of '}
        <Text style={styles.insteadOfQuote}>“I want to stop getting distracted.”</Text>
      </Text>
      <Text style={styles.tryLine}>
        <Text style={styles.tryLabel}>{'TRY  '}</Text>
        <Text style={styles.tryQuote}>“I am fully present with my work.”</Text>
      </Text>
    </View>
  );
}

export function RulesLine({ trailing }: { trailing?: React.ReactNode }) {
  return (
    <View>
      <View style={styles.rulesRow}>
        <Text style={styles.rules}>SHORT  ·  PRESENT  ·  FELT</Text>
        {trailing}
      </View>
      <Text style={styles.rulesCopy}>Three rules for a stronger intention.</Text>
    </View>
  );
}

export function ContinueButtonFace({ enabled }: { enabled: boolean }) {
  return (
    <View style={[styles.cta, enabled ? styles.ctaEnabled : styles.ctaDisabled]}>
      <Text style={[styles.ctaText, enabled ? styles.ctaTextEnabled : styles.ctaTextDisabled]}>Continue →</Text>
    </View>
  );
}

export function DrawLinkFace({ enabled }: { enabled: boolean }) {
  return (
    <View style={styles.drawLinkWrap}>
      <Text style={[styles.drawLink, !enabled && styles.drawLinkDisabled]}>Or draw it yourself</Text>
      <View style={[styles.drawUnderline, !enabled && styles.drawLinkDisabled]} />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: INTENTION_FONTS.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: colors.creation.muted,
    marginBottom: 14,
  },
  headline: {
    fontFamily: INTENTION_FONTS.serif,
    fontSize: 32,
    lineHeight: 38,
    color: colors.creation.ink,
  },
  hereWrap: { alignSelf: 'flex-start' },
  underline: { position: 'absolute', left: -2, bottom: -4 },
  subcopy: {
    fontFamily: INTENTION_FONTS.sans,
    fontSize: 15,
    color: colors.creation.muted,
    marginTop: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  fieldLabel: {
    fontFamily: INTENTION_FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.creation.muted,
  },
  count: {
    fontFamily: INTENTION_FONTS.sans,
    fontSize: 12,
    color: colors.creation.muted,
  },
  rule: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.creation.ink,
    opacity: 0.5,
    marginTop: 10,
  },
  hints: { marginTop: 22, gap: 8 },
  insteadOf: {
    fontFamily: INTENTION_FONTS.sans,
    fontSize: 14,
    color: colors.creation.muted,
  },
  insteadOfQuote: {
    fontFamily: INTENTION_FONTS.serifItalic,
    fontSize: 17,
    color: colors.creation.muted,
  },
  tryLine: { fontFamily: INTENTION_FONTS.serif, fontSize: 18, color: colors.creation.ink },
  tryLabel: {
    fontFamily: INTENTION_FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.creation.muted,
  },
  tryQuote: { fontFamily: INTENTION_FONTS.serif, fontSize: 18, color: colors.creation.ink },
  rulesRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rules: {
    fontFamily: INTENTION_FONTS.sansBold,
    // DEFERRED: the 11 px principles label was too small at this reading distance.
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.creation.muted,
  },
  rulesCopy: {
    fontFamily: INTENTION_FONTS.sans,
    fontSize: 14,
    color: colors.creation.muted,
    marginTop: 8,
  },
  cta: {
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaEnabled: { backgroundColor: colors.creation.ink },
  ctaDisabled: { backgroundColor: colors.creation.disabledFill },
  ctaText: { fontFamily: INTENTION_FONTS.sansBold, fontSize: 16 },
  ctaTextEnabled: { color: colors.creation.cream },
  ctaTextDisabled: { color: colors.creation.placeholder },
  // DEFERRED: 6 px bottom padding left the draw link below the 44 pt target.
  drawLinkWrap: { alignItems: 'center', paddingTop: 14, paddingBottom: 12, minHeight: 44 },
  drawLink: {
    fontFamily: INTENTION_FONTS.sans,
    // DEFERRED: 13 px muted link treatment; the link now reads as an action.
    fontSize: 14,
    color: colors.creation.ink,
    opacity: 0.8,
  },
  drawUnderline: {
    marginTop: 3,
    width: 120,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.creation.ink,
    opacity: 0.8,
  },
  drawLinkDisabled: { opacity: 0.45 },
});
