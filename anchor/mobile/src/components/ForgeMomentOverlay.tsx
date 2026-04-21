import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Polygon,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { RANK_TIERS } from '@/utils/practiceRank';
import type { ForgeMomentMilestone } from '@/stores/forgeMomentStore';

interface ForgeMomentOverlayProps {
  milestone: ForgeMomentMilestone | null;
  onDismiss: () => void;
}

const ENTRY_DURATION_MS = 1600;
const EXIT_START_MS = 7000;
const EXIT_DURATION_MS = 800;
const DISMISS_MS = 7800;

const subtitles: Record<string, string> = {
  Practitioner: 'The practice has taken root.',
  Architect: 'Fifty primes. The thread holds.',
  Sovereign: 'Two hundred. This is who you are now.',
  '100 Days': 'Constancy is the rarest discipline.',
};

function buildCompassRosePoints(size: number): string {
  const center = size / 2;
  const innerRadius = size * 0.18;
  const cardinalRadius = size * 0.46;
  const diagonalRadius = size * 0.28;

  return Array.from({ length: 16 }, (_, index) => {
    const angle = (-90 + index * 22.5) * (Math.PI / 180);
    if (index % 2 === 1) {
      return `${center + innerRadius * Math.cos(angle)},${center + innerRadius * Math.sin(angle)}`;
    }

    const outerIndex = index / 2;
    const radius = outerIndex % 2 === 0 ? cardinalRadius : diagonalRadius;
    return `${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`;
  }).join(' ');
}

const CompassRose: React.FC<{ size: number }> = ({ size }) => {
  const center = size / 2;
  const wheelRadius = size * 0.18;
  const nodeRadius = size * 0.025;
  const tipRadius = size * 0.03;
  const spokeRadius = size * 0.18;
  const tipPoints = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const angle = (-90 + index * 45) * (Math.PI / 180);
        const radius = index % 2 === 0 ? size * 0.46 : size * 0.28;
        return {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
        };
      }),
    [center, size]
  );
  const spokePoints = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const angle = (-90 + index * 45) * (Math.PI / 180);
        return {
          x: center + spokeRadius * Math.cos(angle),
          y: center + spokeRadius * Math.sin(angle),
        };
      }),
    [center, spokeRadius]
  );

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <SvgRadialGradient id="compassGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={withAlpha(colors.gold, 0.22)} />
          <Stop offset="75%" stopColor={withAlpha(colors.gold, 0)} />
        </SvgRadialGradient>
      </Defs>

      <Circle cx={center} cy={center} r={size * 0.5} fill="url(#compassGlow)" />

      <Polygon
        points={buildCompassRosePoints(size)}
        stroke={withAlpha(colors.gold, 0.9)}
        strokeWidth={1.5}
        fill={withAlpha(colors.gold, 0.07)}
      />

      <Circle
        cx={center}
        cy={center}
        r={wheelRadius}
        stroke={withAlpha(colors.gold, 0.72)}
        strokeWidth={1.15}
      />

      <Rect
        x={center - wheelRadius * 0.68}
        y={center - wheelRadius * 0.68}
        width={wheelRadius * 1.36}
        height={wheelRadius * 1.36}
        stroke={withAlpha(colors.gold, 0.46)}
        strokeWidth={1}
        fill="none"
        transform={`rotate(45 ${center} ${center})`}
      />

      {spokePoints.map((point) => (
        <Line
          key={`spoke-${point.x}-${point.y}`}
          x1={center}
          y1={center}
          x2={point.x}
          y2={point.y}
          stroke={withAlpha(colors.gold, 0.42)}
          strokeWidth={1}
        />
      ))}

      {spokePoints.map((point) => (
        <Circle
          key={`node-${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={nodeRadius}
          fill={withAlpha(colors.gold, 0.8)}
        />
      ))}

      {tipPoints.map((point, index) => (
        <Circle
          key={`tip-${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={index % 2 === 0 ? tipRadius : tipRadius * 0.78}
          fill={withAlpha(colors.gold, index % 2 === 0 ? 0.96 : 0.78)}
        />
      ))}

      <Circle
        cx={center}
        cy={center}
        r={size * 0.045}
        stroke={withAlpha(colors.gold, 0.72)}
        strokeWidth={1.1}
      />
      <Circle cx={center} cy={center} r={size * 0.02} fill={colors.gold} />
    </Svg>
  );
};

const ConstancyRose: React.FC<{ size: number }> = ({ size }) => {
  const center = size / 2;
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (-90 + index * 36) * (Math.PI / 180);
    const radius = index % 2 === 0 ? size * 0.4 : size * 0.16;
    return `${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`;
  }).join(' ');

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={size * 0.43}
        stroke={withAlpha(colors.gold, 0.24)}
        strokeWidth={1}
        strokeDasharray="2 6"
      />
      <Circle
        cx={center}
        cy={center}
        r={size * 0.34}
        stroke={withAlpha(colors.gold, 0.36)}
        strokeWidth={1}
      />
      <Polygon
        points={points}
        stroke={withAlpha(colors.gold, 0.88)}
        strokeWidth={1.6}
        fill={withAlpha(colors.gold, 0.1)}
      />
      <Circle cx={center} cy={center} r={size * 0.04} fill={colors.gold} />
    </Svg>
  );
};

const RankIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 24 }) => {
  const center = size / 2;
  const stroke = withAlpha(colors.gold, 0.88);

  if (name === 'Architect') {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect
          x={size * 0.23}
          y={size * 0.23}
          width={size * 0.54}
          height={size * 0.54}
          stroke={stroke}
          strokeWidth={1}
          fill="none"
          transform={`rotate(13 ${center} ${center})`}
        />
        <Line x1={center} y1={size * 0.12} x2={center} y2={size * 0.88} stroke={stroke} strokeWidth={1} />
        <Line x1={size * 0.12} y1={center} x2={size * 0.88} y2={center} stroke={stroke} strokeWidth={1} />
        <Circle cx={center} cy={center} r={size * 0.075} fill={colors.gold} />
      </Svg>
    );
  }

  if (name === 'Practitioner') {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={size * 0.36} stroke={stroke} strokeWidth={0.9} opacity={0.56} />
        <Line x1={center} y1={size * 0.14} x2={center} y2={size * 0.86} stroke={stroke} strokeWidth={1} />
        <Line x1={size * 0.14} y1={center} x2={size * 0.86} y2={center} stroke={stroke} strokeWidth={1} />
        <Line x1={size * 0.25} y1={size * 0.25} x2={size * 0.75} y2={size * 0.75} stroke={stroke} strokeWidth={0.8} opacity={0.7} />
        <Line x1={size * 0.75} y1={size * 0.25} x2={size * 0.25} y2={size * 0.75} stroke={stroke} strokeWidth={0.8} opacity={0.7} />
        <Circle cx={center} cy={center} r={size * 0.08} fill={colors.gold} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={size * 0.32} stroke={stroke} strokeWidth={1} opacity={0.5} />
      <Circle cx={center} cy={center} r={size * 0.1} fill={colors.gold} opacity={0.82} />
    </Svg>
  );
};

export const ForgeMomentOverlay: React.FC<ForgeMomentOverlayProps> = ({
  milestone,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const entry = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!milestone) {
      return;
    }

    entry.setValue(0);
    fadeOut.setValue(1);

    Animated.timing(entry, {
      toValue: 1,
      duration: ENTRY_DURATION_MS,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();

    const fadeTimer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, EXIT_START_MS);

    const dismissTimer = setTimeout(onDismiss, DISMISS_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [entry, fadeOut, milestone, onDismiss]);

  const containerSize = Math.min(width * 0.82, 320);
  const outerRingSize = containerSize * 0.94;
  const secondRingSize = containerSize * 0.79;
  const thirdRingSize = containerSize * 0.64;
  const sigilSize = containerSize * 0.5;

  const ringOpacity = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const ringScale = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });
  const textOpacity = entry.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0.25, 1],
  });
  const textShift = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const overlayOpacity = Animated.multiply(ringOpacity, fadeOut);

  if (!milestone) {
    return null;
  }

  const isRank = milestone.type === 'rank';
  const milestonePrimeCount =
    milestone.primeCount ??
    RANK_TIERS.find((tier) => tier.name === milestone.name)?.minPrimes ??
    100;
  const previousRanks = RANK_TIERS.filter(
    (tier) => tier.minPrimes > 0 && tier.minPrimes < milestonePrimeCount
  );

  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}>
      <Pressable style={styles.overlayRoot} onPress={onDismiss}>
        <LinearGradient
          colors={['#1a0a30', '#110620', '#0d0518', colors.black]}
          locations={[0, 0.35, 0.68, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={[styles.nebulaGlow, styles.nebulaLeft]} />
        <View style={[styles.nebulaGlow, styles.nebulaRight]} />
        <View style={[styles.goldBloom, { top: height * 0.22 }]} />

        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${Math.max(width, 390)} ${Math.max(height, 844)}`}
          style={StyleSheet.absoluteFillObject}
        >
          {Array.from({ length: 14 }, (_, index) => {
            const startX = (index / 13) * width;
            return (
              <React.Fragment key={`diag-a-${index}`}>
                <Line
                  x1={startX}
                  y1="0"
                  x2={Math.min(width, startX + width * 0.72)}
                  y2={height}
                  stroke={withAlpha(colors.gold, 0.14)}
                  strokeWidth={0.6}
                />
                <Circle
                  cx={Math.min(width, startX + width * 0.38)}
                  cy={height * 0.42}
                  r={1.4}
                  fill={withAlpha(colors.gold, 0.34)}
                />
              </React.Fragment>
            );
          })}
          {Array.from({ length: 14 }, (_, index) => {
            const startX = (index / 13) * width;
            return (
              <React.Fragment key={`diag-b-${index}`}>
                <Line
                  x1={startX}
                  y1="0"
                  x2={Math.max(0, startX - width * 0.72)}
                  y2={height}
                  stroke={withAlpha(colors.gold, 0.12)}
                  strokeWidth={0.6}
                />
                <Circle
                  cx={Math.max(0, startX - width * 0.22)}
                  cy={height * 0.7}
                  r={1.1}
                  fill={withAlpha(colors.gold, 0.28)}
                />
              </React.Fragment>
            );
          })}
        </Svg>

        <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
          <Animated.View
            style={[
              styles.ringContainer,
              {
                width: containerSize,
                height: containerSize,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          >
            <View
              style={[
                styles.outerRing,
                {
                  width: outerRingSize,
                  height: outerRingSize,
                  borderRadius: outerRingSize / 2,
                  marginLeft: -outerRingSize / 2,
                  marginTop: -outerRingSize / 2,
                },
              ]}
            >
              <Svg width={outerRingSize} height={outerRingSize} viewBox={`0 0 ${outerRingSize} ${outerRingSize}`}>
                {Array.from({ length: 80 }, (_, index) => {
                  const angle = (index / 80) * Math.PI * 2 - Math.PI / 2;
                  const center = outerRingSize / 2;
                  const outerRadius = outerRingSize / 2 - 2;
                  const innerRadius = outerRadius - (index % 10 === 0 ? 12 : 7);
                  return (
                    <Line
                      key={index}
                      x1={center + outerRadius * Math.cos(angle)}
                      y1={center + outerRadius * Math.sin(angle)}
                      x2={center + innerRadius * Math.cos(angle)}
                      y2={center + innerRadius * Math.sin(angle)}
                      stroke={withAlpha(colors.gold, index % 10 === 0 ? 0.8 : 0.4)}
                      strokeWidth={index % 10 === 0 ? 1.5 : 0.7}
                    />
                  );
                })}
              </Svg>
            </View>

            <View
              style={[
                styles.secondaryRing,
                {
                  width: secondRingSize,
                  height: secondRingSize,
                  borderRadius: secondRingSize / 2,
                  marginLeft: -secondRingSize / 2,
                  marginTop: -secondRingSize / 2,
                },
              ]}
            />
            <View
              style={[
                styles.tertiaryRing,
                {
                  width: thirdRingSize,
                  height: thirdRingSize,
                  borderRadius: thirdRingSize / 2,
                  marginLeft: -thirdRingSize / 2,
                  marginTop: -thirdRingSize / 2,
                },
              ]}
            />

            <View
              style={[
                styles.sigilWrap,
                {
                  width: sigilSize,
                  height: sigilSize,
                  marginLeft: -sigilSize / 2,
                  marginTop: -sigilSize / 2,
                },
              ]}
            >
              {isRank ? <CompassRose size={sigilSize} /> : <ConstancyRose size={sigilSize} />}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.textBlock,
              {
                opacity: textOpacity,
                transform: [{ translateY: textShift }],
              },
            ]}
          >
            <Text style={styles.eyebrow}>
              {isRank ? 'RANK ACHIEVED' : 'CONSTANCY MARK FORGED'}
            </Text>
            <Text style={styles.title}>{milestone.name}</Text>

            {isRank ? (
              <View style={styles.rankMetrics}>
                <Text style={styles.primeCountLabel}>{`Prime Count: ${milestonePrimeCount}`}</Text>
                <View style={styles.progressRodRow}>
                  <View style={styles.arrowCapLeft} />
                  <View style={styles.progressRod}>
                    <LinearGradient
                      colors={[colors.gold, withAlpha(colors.gold, 0.62), withAlpha(colors.gold, 0)]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <View style={styles.centerTick} />
                    <View style={[styles.sideTick, styles.sideTickLeft]} />
                    <View style={[styles.sideTick, styles.sideTickRight]} />
                  </View>
                  <View style={styles.arrowCapRight} />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressLeftLabel}>{milestonePrimeCount}</Text>
                  <Text style={styles.progressRightLabel}>Total Primes</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.subtitle}>{subtitles[milestone.name] ?? ''}</Text>
          </Animated.View>
        </View>

        {isRank && previousRanks.length > 0 ? (
          <Animated.View
            style={[
              styles.historyFooter,
              {
                bottom: insets.bottom + 68,
                opacity: textOpacity,
              },
            ]}
          >
            <Text style={styles.historyLabel}>Ranks Unlocked:</Text>
            {previousRanks.map((rank) => (
              <View key={rank.name} style={styles.historyRow}>
                <RankIcon name={rank.name} />
                <Text style={styles.historyText}>{`- ${rank.name}`}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.dismissHintWrap, { opacity: textOpacity }]}>
          <Text style={styles.dismissHint}>Tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nebulaGlow: {
    position: 'absolute',
    borderRadius: 999,
  },
  nebulaLeft: {
    width: 360,
    height: 300,
    left: -80,
    top: 90,
    backgroundColor: withAlpha(colors.purple, 0.38),
    opacity: 0.86,
  },
  nebulaRight: {
    width: 320,
    height: 260,
    right: -70,
    top: 260,
    backgroundColor: withAlpha(colors.purple, 0.24),
    opacity: 0.72,
  },
  goldBloom: {
    position: 'absolute',
    width: 260,
    height: 180,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.08),
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  outerRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 1.5,
    borderColor: withAlpha(colors.gold, 0.85),
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  secondaryRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
  },
  tertiaryRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.25),
  },
  sigilWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 16,
    elevation: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    width: '100%',
  },
  eyebrow: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 2.8,
    color: withAlpha(colors.gold, 0.75),
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 46,
    color: colors.gold,
    letterSpacing: 1,
    textShadowColor: withAlpha(colors.gold, 0.48),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 18,
  },
  rankMetrics: {
    width: '76%',
    minWidth: 240,
    marginBottom: 18,
  },
  primeCountLabel: {
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerif,
    fontSize: 15,
    color: withAlpha(colors.gold, 0.82),
    marginBottom: 12,
  },
  progressRodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowCapLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: withAlpha(colors.gold, 0.72),
  },
  arrowCapRight: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: withAlpha(colors.gold, 0.46),
  },
  progressRod: {
    flex: 1,
    height: 3,
    backgroundColor: withAlpha(colors.gold, 0.14),
    marginHorizontal: 4,
    overflow: 'visible',
  },
  centerTick: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 1,
    height: 9,
    backgroundColor: withAlpha(colors.gold, 0.56),
    transform: [{ translateX: -0.5 }, { translateY: -4.5 }],
  },
  sideTick: {
    position: 'absolute',
    top: '50%',
    width: 1,
    height: 6,
    backgroundColor: withAlpha(colors.gold, 0.28),
    transform: [{ translateY: -3 }],
  },
  sideTickLeft: {
    left: '25%',
  },
  sideTickRight: {
    left: '75%',
  },
  progressLabels: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLeftLabel: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    color: withAlpha(colors.gold, 0.7),
  },
  progressRightLabel: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.62),
  },
  subtitle: {
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 18,
    color: withAlpha(colors.silver, 0.72),
    lineHeight: 26,
  },
  historyFooter: {
    position: 'absolute',
    left: 24,
  },
  historyLabel: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    color: withAlpha(colors.gold, 0.6),
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  historyText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    color: withAlpha(colors.silver, 0.74),
  },
  dismissHintWrap: {
    position: 'absolute',
    bottom: 38,
  },
  dismissHint: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: withAlpha(colors.silver, 0.36),
  },
});
