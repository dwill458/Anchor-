import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Flag } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import type { AnchorExpression } from '@/constants/v2/creation';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import {
  chartArtFor,
  chartFrame,
  pointAt,
  routeLength,
  routePathData,
  toFramePoint,
  waypointFractions,
  type ChartWindow,
} from './chartRouteGeometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Warm lamplight for the travelled route: reads as "lit by use", not as gold ornament. */
export const ROUTE_LIGHT = '#F2E6CB';
const ROUTE_AHEAD = 'rgba(242, 230, 203, 0.5)';

export type ChartMarker = {
  id: string;
  state: 'completed' | 'current' | 'upcoming';
  accessibilityLabel: string;
  number: number;
};

export type ChartAnchorArt = {
  svg: string;
  imageUrl?: string | null;
  category?: string | null;
  expression?: AnchorExpression | null;
};

type Props = {
  width: number;
  category?: string | null;
  window: ChartWindow;
  /** Hide the drawn route entirely (empty state shows only the scene). */
  showRoute?: boolean;
  markers?: ChartMarker[];
  /**
   * Fraction of the route already travelled (0 = at START). Drives the lit
   * trail and the Anchor's position. Animate it to move the Anchor forward.
   */
  travelled?: SharedValue<number>;
  /** 0–1: how much of the trail ahead is drawn (generation reveal). Defaults to fully drawn. */
  routeReveal?: SharedValue<number>;
  /** Markers revealed so far, 0…markers.length (fractional values fade in). */
  markerReveal?: SharedValue<number>;
  /** 0–1 darkness over the scene (generation starts restrained). */
  veil?: SharedValue<number>;
  /** 0–1 opacity of the destination treatment. */
  destinationReveal?: SharedValue<number>;
  anchorArt?: ChartAnchorArt | null;
  /** Real Vision image for the destination. Never a stand-in. */
  destinationImageUrl?: string | null;
  destinationLabel?: string | null;
  /** Labels over START / destination during creation ("HERE" / "THERE"). */
  hereCaption?: string | null;
  thereCaption?: string | null;
  scrimTop?: boolean;
  scrimBottom?: string | null;
  onMarkerPress?: (id: string) => void;
  onDestinationPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function withAlpha(hex: string, alpha: number): string {
  return `${hex.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/**
 * The Chart map: the category landscape with the route embedded in its trail.
 * The art, route geometry and marker placement all come from
 * `chartRouteGeometry`, so every Chart surface agrees on where things are.
 */
export function ChartLandscape({
  width,
  category,
  window,
  showRoute = true,
  markers = [],
  travelled,
  routeReveal,
  markerReveal,
  veil,
  destinationReveal,
  anchorArt,
  destinationImageUrl,
  destinationLabel,
  hereCaption,
  thereCaption,
  scrimTop = false,
  scrimBottom = null,
  onMarkerPress,
  onDestinationPress,
  accessibilityLabel,
  style,
  testID,
}: Props) {
  const art = chartArtFor(category);
  const frame = useMemo(() => chartFrame(width, art, window), [width, art, window]);
  const categoryColor = getCategoryColor(category);
  const fullPath = useMemo(() => routePathData(frame, art, 0, 1), [frame, art]);
  const length = useMemo(() => routeLength(frame, art, 0, 1), [frame, art]);
  const fractions = useMemo(() => waypointFractions(markers.length), [markers.length]);
  const startPoint = useMemo(() => toFramePoint(pointAt(0, art), frame), [art, frame]);
  const endPoint = useMemo(() => toFramePoint(pointAt(1, art), frame), [art, frame]);
  // Lookup table so the Anchor can travel along the trail on the UI thread.
  const lut = useMemo(
    () => Array.from({ length: 101 }, (_, index) => toFramePoint(pointAt(index / 100, art), frame)),
    [art, frame]
  );

  const travelledProps = useAnimatedProps(() => {
    const t = travelled ? travelled.value : 0;
    return { strokeDashoffset: length * (1 - Math.max(0, Math.min(1, t))) };
  });
  const aheadProps = useAnimatedProps(() => {
    const t = routeReveal ? routeReveal.value : 1;
    return { strokeDashoffset: length * (1 - Math.max(0, Math.min(1, t))) };
  });
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil ? veil.value : 0 }));
  const destinationStyle = useAnimatedStyle(() => ({ opacity: destinationReveal ? destinationReveal.value : 1 }));
  const hereStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, travelled ? travelled.value : 0)) * 100;
    const index = Math.floor(t);
    const a = lut[index];
    const b = lut[Math.min(100, index + 1)];
    const local = t - index;
    return {
      transform: [
        { translateX: a.x + (b.x - a.x) * local - HERE_SIZE / 2 },
        { translateY: a.y + (b.y - a.y) * local - HERE_SIZE / 2 },
      ],
    };
  });

  const imageTop = -frame.window.top * frame.imageHeight;
  // Card height from what it actually shows, so it never sits on the trail's end.
  const destinationCardHeight =
    (thereCaption ? 18 : 0) + (destinationImageUrl ? 62 : 0) + (destinationLabel ? 46 : 0);
  // Centred over the end of the trail when there is sky above it; otherwise to its left.
  const roomAbove = endPoint.y - destinationCardHeight - 18 >= 8;
  const destinationCardLeft = roomAbove
    ? Math.min(Math.max(8, endPoint.x - DEST_CARD_WIDTH / 2), frame.width - DEST_CARD_WIDTH - 8)
    : Math.max(8, endPoint.x - DEST_CARD_WIDTH - 20);
  const destinationCardTop = roomAbove
    ? endPoint.y - destinationCardHeight - 18
    : Math.max(8, endPoint.y - destinationCardHeight / 2);

  return (
    <View
      testID={testID}
      accessible={Boolean(accessibilityLabel) && !onMarkerPress}
      accessibilityRole={accessibilityLabel && !onMarkerPress ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: frame.width, height: frame.height }, styles.frame, style]}
    >
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        source={art.source}
        resizeMode="cover"
        fadeDuration={0}
        style={{ position: 'absolute', left: 0, top: imageTop, width: frame.width, height: frame.imageHeight }}
      />
      {art.tintable ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: categoryColor, opacity: 0.13 }]} />
      ) : null}
      {scrimTop ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(colors.ink.base, 0.92), withAlpha(colors.ink.base, 0.55), withAlpha(colors.ink.base, 0)]}
          locations={[0, 0.5, 1]}
          style={[styles.scrim, { top: 0, height: frame.height * 0.45 }]}
        />
      ) : null}
      {scrimBottom ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(scrimBottom, 0), withAlpha(scrimBottom, 0.7), scrimBottom]}
          locations={[0, 0.6, 1]}
          style={[styles.scrim, { bottom: 0, height: frame.height * 0.28 }]}
        />
      ) : null}
      {veil ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} /> : null}

      {showRoute ? (
        <Svg width={frame.width} height={frame.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* The way ahead: a quiet dashed trace along the trail. */}
          <AnimatedPath
            d={fullPath}
            stroke={ROUTE_AHEAD}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[length, length]}
            animatedProps={aheadProps}
          />
          <Path d={fullPath} stroke={colors.ink.deep} strokeOpacity={0.35} strokeWidth={1} strokeDasharray={[3, 7]} fill="none" />
          {/* The travelled route: lit, with a soft (non-blurred) underlay for depth. */}
          <AnimatedPath
            d={fullPath}
            stroke={ROUTE_LIGHT}
            strokeOpacity={0.22}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[length, length]}
            animatedProps={travelledProps}
          />
          <AnimatedPath
            d={fullPath}
            stroke={ROUTE_LIGHT}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[length, length]}
            animatedProps={travelledProps}
          />
        </Svg>
      ) : null}

      {showRoute ? (
        <View pointerEvents="none" style={[styles.startDot, { left: startPoint.x - 4, top: startPoint.y - 4 }]} />
      ) : null}

      {showRoute && hereCaption ? (
        <View pointerEvents="none" style={[styles.caption, { left: startPoint.x + HERE_SIZE / 2 + 8, top: startPoint.y - 8 }]}>
          <Text style={styles.captionTitle}>{hereCaption}</Text>
        </View>
      ) : null}

      {showRoute
        ? markers.map((marker, index) => {
            const point = toFramePoint(pointAt(fractions[index], art), frame);
            const isLast = index === markers.length - 1;
            return (
              <MarkerView
                key={marker.id}
                marker={marker}
                index={index}
                x={point.x}
                y={point.y}
                isDestination={isLast}
                categoryColor={categoryColor}
                reveal={markerReveal}
                onPress={onMarkerPress}
              />
            );
          })
        : null}

      {showRoute && (destinationImageUrl || destinationLabel || thereCaption) ? (
        <Animated.View style={[styles.destination, { left: destinationCardLeft, top: destinationCardTop }, destinationStyle]}>
          <Pressable
            disabled={!onDestinationPress}
            onPress={onDestinationPress}
            accessibilityRole={onDestinationPress ? 'button' : undefined}
            accessibilityLabel={destinationLabel ? `Destination: ${destinationLabel}` : 'Destination'}
            style={styles.destinationInner}
          >
            {thereCaption ? <Text style={styles.thereCaption}>{thereCaption}</Text> : null}
            {destinationImageUrl ? (
              <Image
                source={{ uri: destinationImageUrl }}
                accessibilityIgnoresInvertColors
                style={[styles.destinationImage, { borderColor: withAlpha(ROUTE_LIGHT, 0.9) }]}
              />
            ) : null}
            {destinationLabel ? (
              <View style={styles.destinationTextBox}>
                <Text style={styles.destinationEyebrow}>DESTINATION</Text>
                <Text style={styles.destinationText} numberOfLines={2}>
                  {destinationLabel}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}

      {showRoute && anchorArt ? (
        <Animated.View pointerEvents="none" style={[styles.here, hereStyle]}>
          <CircularAnchorRenderer
            svg={anchorArt.svg}
            imageUrl={anchorArt.imageUrl ?? undefined}
            category={anchorArt.category ?? category}
            expression={anchorArt.expression ?? undefined}
            size={HERE_SIZE}
            appearance="paper"
            accessibilityLabel="Your position"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const HERE_SIZE = 30;
const DEST_CARD_WIDTH = 96;

function MarkerView({
  marker,
  index,
  x,
  y,
  isDestination,
  categoryColor,
  reveal,
  onPress,
}: {
  marker: ChartMarker;
  index: number;
  x: number;
  y: number;
  isDestination: boolean;
  categoryColor: string;
  reveal?: SharedValue<number>;
  onPress?: (id: string) => void;
}) {
  const revealStyle = useAnimatedStyle(() => {
    const value = reveal ? Math.max(0, Math.min(1, reveal.value - index)) : 1;
    return { opacity: value, transform: [{ scale: 0.8 + value * 0.2 }] };
  });
  const size =
    marker.state === 'current' ? 28 : isDestination ? 22 : marker.state === 'completed' ? 16 : 13;
  const hit = Math.max(size, 36);
  return (
    <Animated.View style={[styles.markerSlot, { left: x - hit / 2, top: y - hit / 2, width: hit, height: hit }, revealStyle]}>
      <Pressable
        disabled={!onPress}
        onPress={() => onPress?.(marker.id)}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={marker.accessibilityLabel}
        accessibilityState={{ selected: marker.state === 'current' }}
        hitSlop={4}
        style={styles.markerHit}
      >
        {marker.state === 'current' ? <View style={[styles.currentHalo, { borderColor: withAlpha(ROUTE_LIGHT, 0.35) }]} /> : null}
        <View
          style={[
            styles.markerDot,
            { width: size, height: size, borderRadius: size / 2 },
            marker.state === 'completed' && styles.markerCompleted,
            marker.state === 'current' && [styles.markerCurrent, { backgroundColor: categoryColor }],
            marker.state === 'upcoming' && styles.markerUpcoming,
            isDestination && marker.state !== 'current' && styles.markerDestination,
          ]}
        >
          {marker.state === 'completed' ? (
            <Check size={10} color={colors.ink.base} strokeWidth={3} />
          ) : marker.state === 'current' ? (
            <Text style={styles.markerNumber}>{marker.number}</Text>
          ) : isDestination ? (
            <Flag size={11} color={ROUTE_LIGHT} strokeWidth={2.4} />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.ink.deep },
  scrim: { position: 'absolute', left: 0, right: 0 },
  veil: { backgroundColor: colors.ink.deep },
  startDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ROUTE_LIGHT,
  },
  caption: { position: 'absolute' },
  captionTitle: { ...typography.labelSM, color: ROUTE_LIGHT, letterSpacing: 1.2 },
  markerSlot: { position: 'absolute' },
  markerHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markerDot: { alignItems: 'center', justifyContent: 'center' },
  markerCompleted: { backgroundColor: ROUTE_LIGHT },
  markerCurrent: { borderWidth: 2, borderColor: ROUTE_LIGHT },
  markerUpcoming: { backgroundColor: 'rgba(14, 21, 28, 0.7)', borderWidth: 1.5, borderColor: ROUTE_AHEAD },
  markerDestination: { backgroundColor: 'rgba(14, 21, 28, 0.85)', borderWidth: 1.5, borderColor: ROUTE_LIGHT },
  markerNumber: { ...typography.labelMD, fontSize: 12, color: '#FFFFFF' },
  currentHalo: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 6 },
  here: { position: 'absolute', left: 0, top: 0 },
  destination: { position: 'absolute', width: DEST_CARD_WIDTH },
  destinationInner: { alignItems: 'flex-start', gap: 4 },
  thereCaption: { ...typography.labelSM, color: ROUTE_LIGHT, letterSpacing: 1.2 },
  destinationImage: { width: DEST_CARD_WIDTH, height: 58, borderRadius: 10, borderWidth: 1.5 },
  destinationTextBox: {
    backgroundColor: 'rgba(14, 21, 28, 0.72)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    maxWidth: DEST_CARD_WIDTH,
  },
  destinationEyebrow: { ...typography.labelSM, fontSize: 9, color: colors.ink.text.secondary, letterSpacing: 1 },
  destinationText: { ...typography.caption, fontSize: 11, lineHeight: 14, color: colors.ink.text.primary },
});
