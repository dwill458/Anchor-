import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SigilSvg } from '@/components/common/SigilSvg';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const CARD_SIZE = 390;
const CARD_PADDING = 26;
const RULE_GOLD = 'rgba(212,175,55,0.35)';
const RULE_GOLD_SOFT = 'rgba(212,175,55,0.2)';
const BORDER_COLOR = 'rgba(212,175,55,0.22)';
const TEXT_BONE_DIM = 'rgba(245,245,220,0.65)';
const TEXT_SILVER_DIM = 'rgba(192,192,192,0.5)';
const TEXT_GOLD_DIM = 'rgba(212,175,55,0.5)';
const TEXT_GOLD_SOFT = 'rgba(212,175,55,0.35)';
const POSITIVE = '#62C27A';
const NEGATIVE = '#E05C5C';
const PLACEHOLDER_SIGIL = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" stroke="#D4AF37" stroke-width="0.8" opacity="0.28"/>
  <path d="M20 7V33" stroke="#D4AF37" stroke-width="1" opacity="0.7"/>
  <path d="M10 14H30" stroke="#D4AF37" stroke-width="0.9" opacity="0.58"/>
  <path d="M12 28L28 12" stroke="#D4AF37" stroke-width="0.7" opacity="0.4"/>
  <path d="M12 12L28 28" stroke="#D4AF37" stroke-width="0.7" opacity="0.25"/>
  <circle cx="20" cy="20" r="5.5" stroke="#D4AF37" stroke-width="0.9" fill="rgba(212,175,55,0.08)"/>
</svg>`;
const THREAD_TRACK_WIDTH = 132;
const THREAD_TRACK_HEIGHT = 4;

export interface WeeklyShareCardProps {
  weekNumber: number;
  dateRange: string;
  dominantIntention: string;
  dominantAnchorImageUri?: string;
  primesThisWeek: number;
  threadStrength: number;
  totalPrimes: number;
  daysShownUp: number;
  threadGained: number;
  insightLine1: string;
  insightLine2: string;
  insightHighlight: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function OrnamentalRule({ opacity = 0.35 }: { opacity?: number }) {
  const gold = `rgba(212,175,55,${opacity})`;

  return (
    <View style={styles.ruleWrap}>
      <LinearGradient
        colors={['rgba(212,175,55,0)', gold, gold, 'rgba(212,175,55,0)']}
        locations={[0, 0.22, 0.78, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.ruleLine}
      />
      <View style={[styles.rulePip, { backgroundColor: `rgba(212,175,55,${Math.min(opacity + 0.3, 0.65)})` }]} />
    </View>
  );
}

function HighlightedLine({
  text,
  highlight,
}: {
  text: string;
  highlight: string;
}) {
  const index = highlight ? text.indexOf(highlight) : -1;

  if (index === -1) {
    return <Text style={styles.insightText}>{text}</Text>;
  }

  const before = text.slice(0, index);
  const after = text.slice(index + highlight.length);

  return (
    <Text style={styles.insightText}>
      {before}
      <Text style={styles.insightHighlight}>{highlight}</Text>
      {after}
    </Text>
  );
}

function ThreadGainValue({ threadGained }: { threadGained: number }) {
  const valueColor =
    threadGained > 0
      ? POSITIVE
      : threadGained < 0
        ? NEGATIVE
        : colors.silver;
  const prefix = threadGained > 0 ? '+' : '';

  return (
    <Text style={[styles.statValue, { color: valueColor }]}>
      {`${prefix}${threadGained}`}
    </Text>
  );
}

export function WeeklyShareCard({
  weekNumber,
  dateRange,
  dominantIntention,
  dominantAnchorImageUri,
  primesThisWeek,
  threadStrength,
  totalPrimes,
  daysShownUp,
  threadGained,
  insightLine1,
  insightLine2,
  insightHighlight,
}: WeeklyShareCardProps) {
  const clampedThreadStrength = clamp(threadStrength, 0, 100);
  const threadFillWidth = (THREAD_TRACK_WIDTH * clampedThreadStrength) / 100;
  const focusText = dominantIntention.trim() || ' ';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>ANCHOR</Text>
        <Text style={styles.weekMeta}>{`WEEK ${weekNumber} · ${dateRange}`}</Text>
      </View>

      <OrnamentalRule />

      <View style={styles.focusRow}>
        <View style={styles.symbolRing}>
          {dominantAnchorImageUri ? (
            <Image
              source={{ uri: dominantAnchorImageUri }}
              style={styles.symbolImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.symbolPlaceholder}>
              <SigilSvg xml={PLACEHOLDER_SIGIL} width={38} height={38} />
            </View>
          )}
        </View>

        <View style={styles.focusTextWrap}>
          <Text style={styles.focusMeta}>{`DOMINANT FOCUS · ${primesThisWeek} PRIMES`}</Text>
          <Text style={styles.focusIntention}>{`"${focusText.replace(/^"|"$/g, '')}"`}</Text>
          <View style={styles.threadRow}>
            <View style={styles.threadTrack}>
              <LinearGradient
                colors={['rgba(212,175,55,0.16)', 'rgba(212,175,55,0.3)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.threadTrackBase}
              />
              <LinearGradient
                colors={['rgba(212,175,55,0.42)', colors.gold]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.threadFill,
                  { width: Math.max(threadFillWidth, clampedThreadStrength > 0 ? 4 : 0) },
                ]}
              />
            </View>
            <Text style={styles.threadLabel}>{`${clampedThreadStrength} thread`}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{totalPrimes}</Text>
          <Text style={styles.statLabel}>TOTAL{'\n'}PRIMES</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{`${daysShownUp}/7`}</Text>
          <Text style={styles.statLabel}>DAYS SHOWN{'\n'}UP</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <ThreadGainValue threadGained={threadGained} />
          <Text style={styles.statLabel}>THREAD{'\n'}GAINED</Text>
        </View>
      </View>

      <View style={styles.insightBlock}>
        <HighlightedLine text={insightLine1} highlight={insightHighlight} />
        <Text style={styles.insightText}>
          {'\n'}
        </Text>
        <HighlightedLine text={insightLine2} highlight={insightHighlight} />
      </View>

      <OrnamentalRule opacity={0.2} />

      <View style={styles.footerRow}>
        <Text style={styles.footerBrand}>ANCHOR</Text>
        <View style={styles.footerDot} />
        <Text style={styles.footerUrl}>anchorintentions.com</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    paddingHorizontal: CARD_PADDING,
    paddingTop: CARD_PADDING,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10,
    letterSpacing: 3.5,
    color: colors.gold,
  },
  weekMeta: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 9,
    letterSpacing: 2.25,
    color: 'rgba(212,175,55,0.5)',
  },
  ruleWrap: {
    height: 14,
    justifyContent: 'center',
    marginTop: 14,
  },
  ruleLine: {
    height: 1,
    width: '100%',
  },
  rulePip: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 4,
    height: 4,
    marginLeft: -2,
    marginTop: -2,
    transform: [{ rotate: '45deg' }],
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    minHeight: 92,
  },
  symbolRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: RULE_GOLD,
    backgroundColor: colors.deepPurple,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  symbolImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    position: 'absolute',
  },
  symbolPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,25,0.65)',
  },
  focusTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  focusMeta: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 2.24,
    color: TEXT_GOLD_DIM,
    marginBottom: 6,
  },
  focusIntention: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    lineHeight: 20,
    color: colors.bone,
    marginBottom: 12,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threadTrack: {
    width: THREAD_TRACK_WIDTH,
    height: THREAD_TRACK_HEIGHT,
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  threadTrackBase: {
    ...StyleSheet.absoluteFillObject,
  },
  threadFill: {
    height: THREAD_TRACK_HEIGHT,
    borderRadius: 999,
  },
  threadLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 9.5,
    letterSpacing: 0.2,
    color: colors.gold,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(212,175,55,0.08)',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: 6,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(212,175,55,0.18)',
  },
  statValue: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 22,
    lineHeight: 24,
    color: colors.bone,
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 10,
    lineHeight: 11,
    color: TEXT_SILVER_DIM,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  insightBlock: {
    paddingHorizontal: 8,
    marginTop: 18,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  insightText: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13.5,
    lineHeight: 18,
    color: TEXT_BONE_DIM,
    textAlign: 'center',
  },
  insightHighlight: {
    color: colors.gold,
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '400',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  footerBrand: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 9,
    letterSpacing: 2.4,
    color: TEXT_GOLD_SOFT,
  },
  footerDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  footerUrl: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 10,
    color: 'rgba(192,192,192,0.25)',
  },
});
