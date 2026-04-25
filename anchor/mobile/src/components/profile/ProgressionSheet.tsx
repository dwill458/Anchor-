import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useProgressionData } from '@/hooks/useProgressionData';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { backfillMilestoneDates } from '@/utils/milestoneTracking';

interface ProgressionSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface TrackProps {
  label: string;
  tiers: Array<{
    name: string;
    min: number;
    color: string;
    isCurrent: boolean;
    isReached: boolean;
  }>;
  totalPrimes: number;
  maxPrimes: number;
  positionLabel: string;
  fillAnimation: Animated.Value;
  pulseAnimation: Animated.Value;
  shape: 'circle' | 'square';
}

const SHEET_NAVY = '#131c27';
const SHEET_GOLD = '#D4AF37';
const SHEET_GOLD_DIM = '#8a7120';
const SHEET_SILVER = '#C0C0C0';
const SHEET_BONE = '#F5F5DC';
const PRE_LAUNCH_SENTINEL = 'pre-launch';
const RANK_MAX = 200;
const DEPTH_MAX = 300;

function trackPct(primes: number, maxPrimes: number): number {
  if (maxPrimes <= 0) {
    return 0;
  }

  return Math.min(100, Math.pow(Math.max(0, primes) / maxPrimes, 0.65) * 100);
}

function formatMilestoneDate(date: string | null): string | null {
  if (!date) {
    return null;
  }

  if (date === PRE_LAUNCH_SENTINEL) {
    return 'Before tracking';
  }

  return date;
}

const ProgressTrack: React.FC<TrackProps> = ({
  label,
  tiers,
  totalPrimes,
  maxPrimes,
  positionLabel,
  fillAnimation,
  pulseAnimation,
  shape,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const fillPercent = trackPct(totalPrimes, maxPrimes);
  const cursorPercent = trackPct(Math.min(totalPrimes, maxPrimes), maxPrimes);
  const nextTier = tiers.find((tier) => tier.min > totalPrimes) ?? null;

  useEffect(() => {
    if (trackWidth <= 0) {
      return;
    }

    Animated.timing(fillAnimation, {
      toValue: (trackWidth * fillPercent) / 100,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillAnimation, fillPercent, trackWidth]);

  return (
    <View style={styles.trackBlock}>
      <View style={styles.trackHeader}>
        <Text style={styles.trackSystemLabel}>{label}</Text>
        <Text style={styles.trackPositionLabel}>{positionLabel}</Text>
      </View>

      <View
        style={styles.trackBar}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.trackBackground} />
        <Animated.View style={[styles.trackFillWrap, { width: fillAnimation }]}>
          <LinearGradient
            colors={[SHEET_GOLD_DIM, SHEET_GOLD]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.trackFill}
          />
        </Animated.View>

        {tiers.map((tier) => {
          const left = `${trackPct(tier.min, maxPrimes)}%` as `${number}%`;
          const isNext = nextTier?.name === tier.name;

          return (
            <View
              key={`${label}-${tier.name}`}
              style={[
                styles.trackDot,
                shape === 'square' ? styles.trackDotSquare : null,
                {
                  left,
                  backgroundColor: tier.isReached
                    ? tier.color
                    : 'rgba(255,255,255,0.12)',
                  borderColor: tier.isReached ? SHEET_NAVY : 'transparent',
                },
                isNext
                  ? {
                      shadowColor: tier.color,
                      shadowOpacity: 0.6,
                      shadowRadius: 4,
                      elevation: 3,
                    }
                  : null,
              ]}
            />
          );
        })}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.cursorGlow,
            {
              left: `${cursorPercent}%`,
              opacity: pulseAnimation,
              transform: [
                {
                  scale: pulseAnimation.interpolate({
                    inputRange: [0.4, 0.9],
                    outputRange: [1, 1.22],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={[styles.trackCursor, { left: `${cursorPercent}%` }]} />
      </View>

      <View style={styles.trackLabels}>
        {tiers.map((tier, index) => (
          <View
            key={`${label}-label-${tier.name}`}
            style={[
              styles.trackLabelItem,
              { left: `${trackPct(tier.min, maxPrimes)}%` as `${number}%` },
            ]}
          >
            <View
              style={[
                styles.trackTick,
                index % 2 === 1 ? styles.trackTickHigh : null,
              ]}
            />
            <Text
              style={[
                styles.trackLabelText,
                tier.isReached ? styles.trackLabelReached : null,
                tier.isCurrent ? styles.trackLabelCurrent : null,
              ]}
            >
              {tier.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const ProgressionSheet: React.FC<ProgressionSheetProps> = ({
  visible,
  onClose,
}) => {
  const {
    totalPrimes,
    rankTiers,
    nextRank,
    primesToNextRank,
    depthTiers,
    nextDepth,
    primesToNextDepth,
  } = useProgressionData();

  const rankFillAnimation = useRef(new Animated.Value(0)).current;
  const depthFillAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) {
      rankFillAnimation.setValue(0);
      depthFillAnimation.setValue(0);
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(0.4);
      return;
    }

    backfillMilestoneDates(totalPrimes).catch(() => {});

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.9,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0.4,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      pulseAnimation.setValue(0.4);
    };
  }, [depthFillAnimation, pulseAnimation, rankFillAnimation, totalPrimes, visible]);

  const nearestMilestone = useMemo(() => {
    const upcoming = [
      nextRank && primesToNextRank != null
        ? { name: nextRank.name, distance: primesToNextRank }
        : null,
      nextDepth && primesToNextDepth != null
        ? { name: nextDepth.name, distance: primesToNextDepth }
        : null,
    ].filter((item): item is { name: string; distance: number } => item !== null);

    return upcoming.sort((left, right) => left.distance - right.distance)[0] ?? null;
  }, [nextDepth, nextRank, primesToNextDepth, primesToNextRank]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Your Progression</Text>
              <Text style={styles.subtitle}>
                Every prime compounds. None are lost.
              </Text>
            </View>

            <View style={styles.heroCard}>
              <View>
                <Text style={styles.heroPrimeCount}>{totalPrimes}</Text>
                <Text style={styles.heroLabel}>TOTAL PRIMES</Text>
              </View>

              <View style={styles.heroAside}>
                {nearestMilestone ? (
                  <>
                    <Text style={styles.heroDelta}>{`+${nearestMilestone.distance}`}</Text>
                    <Text style={styles.heroAsideLabel}>primes to</Text>
                    <Text style={styles.heroAsideName}>{nearestMilestone.name}</Text>
                  </>
                ) : (
                  <Text style={styles.heroAsideName}>Peak reached</Text>
                )}
              </View>
            </View>

            <View style={styles.tracksSection}>
              <ProgressTrack
                label="RANK"
                tiers={rankTiers}
                totalPrimes={totalPrimes}
                maxPrimes={RANK_MAX}
                positionLabel={
                  nextRank && primesToNextRank != null
                    ? `${primesToNextRank} to ${nextRank.name}`
                    : 'Max reached'
                }
                fillAnimation={rankFillAnimation}
                pulseAnimation={pulseAnimation}
                shape="circle"
              />

              <ProgressTrack
                label="PRACTICE DEPTH"
                tiers={depthTiers}
                totalPrimes={totalPrimes}
                maxPrimes={DEPTH_MAX}
                positionLabel={
                  nextDepth && primesToNextDepth != null
                    ? `${primesToNextDepth} to ${nextDepth.name}`
                    : 'Max reached'
                }
                fillAnimation={depthFillAnimation}
                pulseAnimation={pulseAnimation}
                shape="square"
              />
            </View>

            <View style={styles.copySection}>
              <View style={styles.copySectionHeader}>
                <Text style={styles.copySectionTitle}>RANK</Text>
                <Text style={styles.copySectionTagline}>
                  Your standing through depth + consistency
                </Text>
              </View>

              {rankTiers.map((tier) => {
                const isNextTier = nextRank?.name === tier.name;
                const achievedDate = formatMilestoneDate(tier.achievedDate);
                const thresholdText = tier.isReached
                  ? achievedDate
                    ? `From ${tier.min} primes · ${achievedDate}`
                    : `From ${tier.min} primes`
                  : isNextTier
                    ? `From ${tier.min} primes · ${tier.min - totalPrimes} away`
                    : `From ${tier.min} primes`;

                return (
                  <View
                    key={`rank-copy-${tier.name}`}
                    style={[
                      styles.tierRow,
                      !tier.isReached ? styles.tierRowUnreached : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.tierDot,
                        {
                          backgroundColor: tier.isReached ? tier.color : 'transparent',
                          borderColor: tier.color,
                        },
                      ]}
                    />

                    <View style={styles.tierContent}>
                      <Text style={[styles.tierName, { color: tier.color }]}>
                        {tier.name}
                        {tier.isCurrent ? (
                          <Text style={styles.currentBadge}> CURRENT</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.tierCopy}>{tier.copy}</Text>
                      <Text style={styles.tierThreshold}>{thresholdText}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.copySection}>
              <View style={styles.copySectionHeader}>
                <Text style={styles.copySectionTitle}>PRACTICE DEPTH</Text>
                <Text style={styles.copySectionTagline}>
                  Your relationship with the symbol
                </Text>
              </View>

              {depthTiers.map((tier) => {
                const isNextTier = nextDepth?.name === tier.name;
                const achievedDate = formatMilestoneDate(tier.achievedDate);
                const thresholdText = tier.isReached
                  ? achievedDate
                    ? `From ${tier.min} primes · ${achievedDate}`
                    : `From ${tier.min} primes`
                  : isNextTier
                    ? `From ${tier.min} primes · ${tier.min - totalPrimes} away`
                    : `From ${tier.min} primes`;

                return (
                  <View
                    key={`depth-copy-${tier.name}`}
                    style={[
                      styles.tierRow,
                      !tier.isReached ? styles.tierRowUnreached : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.tierDot,
                        styles.tierDotSquare,
                        {
                          backgroundColor: tier.isReached ? tier.color : 'transparent',
                          borderColor: tier.color,
                        },
                      ]}
                    />

                    <View style={styles.tierContent}>
                      <Text style={[styles.tierName, { color: tier.color }]}>
                        {tier.name}
                        {tier.isCurrent ? (
                          <Text style={styles.currentBadge}> CURRENT</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.tierCopy}>{tier.copy}</Text>
                      <Text style={styles.tierThreshold}>{thresholdText}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <Text style={styles.finePrint}>
              Cumulative across all anchors · never resets
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: SHEET_NAVY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.18)',
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 14,
    backgroundColor: 'rgba(212,175,55,0.22)',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 34,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 18,
    color: SHEET_BONE,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: SHEET_SILVER,
  },
  heroCard: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(212,175,55,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroPrimeCount: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 48,
    lineHeight: 50,
    color: SHEET_GOLD,
  },
  heroLabel: {
    marginTop: 4,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    letterSpacing: 1.3,
    color: SHEET_SILVER,
  },
  heroAside: {
    alignItems: 'flex-end',
  },
  heroDelta: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 22,
    color: 'rgba(212,175,55,0.5)',
  },
  heroAsideLabel: {
    marginTop: 2,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    color: 'rgba(192,192,192,0.6)',
  },
  heroAsideName: {
    marginTop: 1,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: SHEET_GOLD,
  },
  tracksSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  trackBlock: {
    gap: 10,
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  trackSystemLabel: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 9,
    letterSpacing: 1.6,
    color: SHEET_SILVER,
  },
  trackPositionLabel: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: 'rgba(192,192,192,0.7)',
  },
  trackBar: {
    position: 'relative',
    height: 14,
    justifyContent: 'center',
  },
  trackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  trackFillWrap: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    flex: 1,
  },
  trackDot: {
    position: 'absolute',
    top: '50%',
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    zIndex: 3,
  },
  trackDotSquare: {
    borderRadius: 2,
  },
  cursorGlow: {
    position: 'absolute',
    top: '50%',
    marginLeft: -12,
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.gold, 0.18),
    zIndex: 4,
  },
  trackCursor: {
    position: 'absolute',
    top: '50%',
    marginLeft: -7,
    marginTop: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: SHEET_GOLD,
    borderWidth: 2,
    borderColor: SHEET_NAVY,
    zIndex: 5,
  },
  trackLabels: {
    position: 'relative',
    height: 36,
    marginTop: 2,
  },
  trackLabelItem: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }],
    width: 40,
  },
  trackTick: {
    width: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trackTickHigh: {
    height: 10,
  },
  trackLabelText: {
    marginTop: 2,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(192,192,192,0.3)',
    textAlign: 'center',
  },
  trackLabelReached: {
    color: 'rgba(192,192,192,0.65)',
  },
  trackLabelCurrent: {
    color: SHEET_GOLD,
  },
  copySection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  copySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    marginBottom: 14,
  },
  copySectionTitle: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 10,
    letterSpacing: 1.6,
    color: SHEET_SILVER,
  },
  copySectionTagline: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 10,
    color: 'rgba(192,192,192,0.45)',
  },
  tierRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    opacity: 1,
  },
  tierRowUnreached: {
    opacity: 0.35,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 4,
  },
  tierDotSquare: {
    borderRadius: 2,
  },
  tierContent: {
    flex: 1,
  },
  tierName: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 14,
  },
  currentBadge: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 8,
    letterSpacing: 0.9,
    color: SHEET_GOLD,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.25)',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tierCopy: {
    marginTop: 3,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(192,192,192,0.76)',
  },
  tierThreshold: {
    marginTop: 4,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(192,192,192,0.3)',
    textTransform: 'uppercase',
  },
  sectionDivider: {
    marginTop: 24,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  finePrint: {
    paddingTop: 16,
    paddingHorizontal: 20,
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: 'rgba(192,192,192,0.3)',
  },
});
