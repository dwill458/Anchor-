import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolateColor, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { SigilSvg } from '@/components/common/SigilSvg';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryColor } from '@/theme/v2';

export type VisionImageRect = { x: number; y: number; width: number; height: number };
/** The person's real Anchor, carried from where it was on screen to where the board holds it. */
export type VisionArrivalAnchor = { svg: string; category?: string | null; rect: VisionImageRect };
type AnchorFlight = { svg: string; category?: string | null; source: VisionImageRect; target?: VisionImageRect };
type Arrival = { url: string; source: VisionImageRect; target?: VisionImageRect; anchor?: AnchorFlight };
type ArrivalContext = {
  url: string | null;
  /** True while a real Anchor is in flight and the board should report where it holds it. */
  anchorInFlight: boolean;
  begin: (url: string, source: VisionImageRect, anchor?: VisionArrivalAnchor) => void;
  cancel: () => void;
  resolve: (url: string) => void;
  land: (url: string, target: VisionImageRect) => void;
  landAnchor: (target: VisionImageRect) => void;
};

/** The Anchor's strokes on ink; they hand over to the board's category colour as it lands. */
const ANCHOR_CREAM = '#F1E8D6';
const Context = createContext<ArrivalContext | null>(null);
export const useVisionImageArrival = () => useContext(Context);

/** Keeps one selected photograph alive across persistence and the mode change. */
export function VisionImageArrivalProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const reduced = useV2ReduceMotion();
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const expand = useSharedValue(0);
  const settle = useSharedValue(0);
  const [imageAspect, setImageAspect] = useState(1);
  const [sourceReady, setSourceReady] = useState(false);
  const clear = useCallback(() => { setArrival(null); setSourceReady(false); }, []);
  const begin = useCallback((url: string, source: VisionImageRect, anchor?: VisionArrivalAnchor) => {
    if (!url || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0) return;
    const flight: AnchorFlight | undefined = anchor?.svg && anchor.rect.width > 0 && anchor.rect.height > 0
      ? { svg: anchor.svg, category: anchor.category, source: anchor.rect } : undefined;
    expand.value = 0; settle.value = 0; setImageAspect(source.width / source.height); setSourceReady(false); setArrival({ url, source, anchor: flight });
  }, [expand, settle]);
  const landAnchor = useCallback((target: VisionImageRect) => {
    if (target.width <= 0 || target.height <= 0) return;
    setArrival(current => current?.anchor && !current.anchor.target ? { ...current, anchor: { ...current.anchor, target } } : current);
  }, []);
  const resolve = useCallback((url: string) => setArrival(current => current ? { ...current, url } : null), []);
  const land = useCallback((url: string, target: VisionImageRect) => {
    if (target.width <= 0 || target.height <= 0) return;
    setArrival(current => current?.url === url && !current.target ? { ...current, target } : current);
  }, []);
  useEffect(() => {
    if (!arrival || !sourceReady) return;
    expand.value = withTiming(1, { duration: reduced ? 0 : 280 });
    if (!arrival.target) return;
    settle.value = withTiming(1, { duration: reduced ? 160 : 760 }, finished => {
      if (finished) runOnJS(clear)();
    });
  }, [arrival, clear, expand, reduced, settle, sourceReady]);
  const imageGeometry = useDerivedValue(() => {
    if (!arrival) return { x: 0, y: 0, w: 1, h: 1 };
    const source = arrival.source;
    const target = arrival.target ?? source;
    const expandedX = source.x * (1 - expand.value);
    const expandedY = source.y + (height * 0.12 - source.y) * expand.value;
    const expandedWidth = source.width + (width - source.width) * expand.value;
    const expandedHeight = source.height + (Math.min(height * 0.75, width * 1.25) - source.height) * expand.value;
    return { w: expandedWidth + (target.width - expandedWidth) * settle.value,
      h: expandedHeight + (target.height - expandedHeight) * settle.value,
      x: expandedX + (target.x - expandedX) * settle.value,
      y: expandedY + (target.y - expandedY) * settle.value };
  });
  const imageStyle = useAnimatedStyle(() => {
    if (!arrival) return {};
    const { x, y, w, h } = imageGeometry.value;
    return { transform: [{ translateX: x + (w - arrival.source.width) / 2 }, { translateY: y + (h - arrival.source.height) / 2 },
      { scaleX: w / arrival.source.width }, { scaleY: h / arrival.source.height }] };
  });
  const photoStyle = useAnimatedStyle(() => {
    if (!arrival) return {};
    const { w, h } = imageGeometry.value;
    const rawWidth = arrival.source.width;
    const rawHeight = rawWidth / imageAspect;
    const cover = Math.max(w / rawWidth, h / rawHeight);
    return { transform: [{ scaleX: cover / (w / arrival.source.width) }, { scaleY: cover / (h / arrival.source.height) }] };
  });
  // The Anchor waits while the photograph opens, then travels with it to the board's mark.
  const anchorStyle = useAnimatedStyle(() => {
    const flight = arrival?.anchor;
    if (!flight) return {};
    const target = flight.target ?? flight.source;
    const t = flight.target ? settle.value : 0;
    const w = flight.source.width + (target.width - flight.source.width) * t;
    const h = flight.source.height + (target.height - flight.source.height) * t;
    const x = flight.source.x + (target.x - flight.source.x) * t;
    const y = flight.source.y + (target.y - flight.source.y) * t;
    return { transform: [{ translateX: x + (w - flight.source.width) / 2 }, { translateY: y + (h - flight.source.height) / 2 },
      { scaleX: w / flight.source.width }, { scaleY: h / flight.source.height }] };
  });
  const anchorCreamStyle = useAnimatedStyle(() => {
    const handedOver = Math.min(1, Math.max(0, (settle.value - 0.2) / 0.5));
    return { opacity: arrival?.anchor?.target ? 1 - handedOver : 1 - settle.value };
  });
  const anchorColorStyle = useAnimatedStyle(() => ({
    opacity: arrival?.anchor?.target ? Math.min(1, Math.max(0, (settle.value - 0.3) / 0.5)) : 0,
  }));
  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(settle.value, [0, 0.6], [colors.ink.base, colors.canvas]),
    opacity: 1 - Math.max(0, (settle.value - 0.65) / 0.35),
  }));
  return <Context.Provider value={{ url: arrival?.url ?? null, anchorInFlight: Boolean(arrival?.anchor && !arrival.anchor.target), begin, cancel: clear, resolve, land, landAnchor }}>
    {children}
    {arrival ? <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessibilityElementsHidden>
      <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]} />
      <Animated.View style={[{ position: 'absolute', width: arrival.source.width, height: arrival.source.height, overflow: 'hidden' }, imageStyle]}>
        <Animated.Image testID="vision-arrival-image" source={{ uri: arrival.url }} resizeMode="stretch" onLoad={event => {
          const source = event.nativeEvent.source;
          if (source?.width > 0 && source?.height > 0) setImageAspect(source.width / source.height);
          setSourceReady(true);
        }} onError={clear} style={[{ position: 'absolute', width: arrival.source.width,
          height: arrival.source.width / imageAspect, top: (arrival.source.height - arrival.source.width / imageAspect) / 2 }, photoStyle]} />
      </Animated.View>
      {arrival.anchor ? <Animated.View testID="vision-arrival-anchor" pointerEvents="none"
        style={[{ position: 'absolute', left: 0, top: 0, width: arrival.anchor.source.width, height: arrival.anchor.source.height }, anchorStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, anchorCreamStyle]}><SigilSvg xml={arrival.anchor.svg} width="100%" height="100%" color={ANCHOR_CREAM} /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, anchorColorStyle]}><SigilSvg xml={arrival.anchor.svg} width="100%" height="100%" color={getCategoryColor(arrival.anchor.category)} /></Animated.View>
      </Animated.View> : null}
    </View> : null}
  </Context.Provider>;
}

/** Measures the persisted collection destination after its layout commits. */
export function VisionArrivalDestination({ url, children, style }: {
  url?: string | null; children: React.ReactNode; style?: any;
}) {
  const arrival = useVisionImageArrival();
  const ref = useRef<View>(null);
  const measure = () => {
    if (url && arrival?.url === url) ref.current?.measureInWindow?.((x, y, width, height) => arrival.land(url, { x, y, width, height }));
  };
  useEffect(measure, [url, arrival?.url]);
  return <View ref={ref} collapsable={false} onLayout={measure} style={style}>{children}</View>;
}
