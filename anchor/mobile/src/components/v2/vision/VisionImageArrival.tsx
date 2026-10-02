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
type Arrival = { id: number; url: string; source: VisionImageRect; target?: VisionImageRect; anchor?: AnchorFlight; resolved?: boolean };
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

/**
 * The flight is a courtesy on top of a save that has already happened, so it can
 * never be what the screen waits on. Every phase has an exit that does not depend
 * on a native callback, an image event, or the board measuring itself:
 *   begun, not saved  -> gives way to the stage (which shows it is saving) after SAVE_WAIT_MS
 *   saved, not landed -> dissolves into the board after LAND_WAIT_MS
 *   landing           -> cleared SETTLE_BACKSTOP_MS after the settle should have ended
 */
export const ARRIVAL_SAVE_WAIT_MS = 20000;
export const ARRIVAL_LAND_WAIT_MS = 1600;
export const ARRIVAL_SOURCE_WAIT_MS = 700;
export const ARRIVAL_DISSOLVE_MS = 260;
const SETTLE_BACKSTOP_MS = 500;
let arrivalSequence = 0;
const trace = (event: string, detail?: unknown) => {
  if (__DEV__ && !process.env.JEST_WORKER_ID) console.log(`[VisionArrival] ${event}`, detail ?? '');
};

/** Keeps one selected photograph alive across persistence and the mode change. */
export function VisionImageArrivalProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const reduced = useV2ReduceMotion();
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const expand = useSharedValue(0);
  const settle = useSharedValue(0);
  const fade = useSharedValue(0);
  const [imageAspect, setImageAspect] = useState(1);
  const [sourceReady, setSourceReady] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const clear = useCallback(() => { trace('clear'); setArrival(null); setSourceReady(false); setDissolving(false); }, []);
  const begin = useCallback((url: string, source: VisionImageRect, anchor?: VisionArrivalAnchor) => {
    if (!url || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0) return;
    const flight: AnchorFlight | undefined = anchor?.svg && anchor.rect.width > 0 && anchor.rect.height > 0
      ? { svg: anchor.svg, category: anchor.category, source: anchor.rect } : undefined;
    trace('begin', { anchorFlight: Boolean(flight) });
    expand.value = 0; settle.value = 0; fade.value = 0;
    setImageAspect(source.width / source.height); setSourceReady(false); setDissolving(false);
    setArrival({ id: ++arrivalSequence, url, source, anchor: flight });
  }, [expand, fade, settle]);
  const landAnchor = useCallback((target: VisionImageRect) => {
    if (target.width <= 0 || target.height <= 0) return;
    setArrival(current => current?.anchor && !current.anchor.target ? { ...current, anchor: { ...current.anchor, target } } : current);
  }, []);
  const resolve = useCallback((url: string) => {
    trace('resolve');
    setArrival(current => current ? { ...current, url, resolved: true } : null);
  }, []);
  const land = useCallback((url: string, target: VisionImageRect) => {
    if (target.width <= 0 || target.height <= 0) return;
    trace('land', target);
    setArrival(current => current?.url === url && !current.target ? { ...current, target } : current);
  }, []);
  const arrivalId = arrival?.id ?? 0;
  const resolved = Boolean(arrival?.resolved);
  const landed = Boolean(arrival?.target);
  // The source image normally reports itself; if it never does, the flight begins anyway.
  useEffect(() => {
    if (!arrivalId || sourceReady) return;
    const timer = setTimeout(() => { trace('source-timeout'); setSourceReady(true); }, ARRIVAL_SOURCE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [arrivalId, sourceReady]);
  useEffect(() => {
    if (!arrivalId || !sourceReady) return;
    expand.value = withTiming(1, { duration: reduced ? 0 : 280 });
  }, [arrivalId, expand, reduced, sourceReady]);
  useEffect(() => {
    if (!arrivalId || !sourceReady || !landed) return;
    const duration = reduced ? 160 : 760;
    settle.value = withTiming(1, { duration }, finished => {
      if (finished) runOnJS(clear)();
    });
    const backstop = setTimeout(clear, duration + SETTLE_BACKSTOP_MS);
    return () => clearTimeout(backstop);
  }, [arrivalId, clear, landed, reduced, settle, sourceReady]);
  // Phase deadlines, each independent of animation callbacks and of the board.
  useEffect(() => {
    if (!arrivalId || landed) return;
    const timer = setTimeout(() => {
      if (resolved) { trace('land-timeout: dissolving'); setDissolving(true); } else { trace('save-timeout'); clear(); }
    }, resolved ? ARRIVAL_LAND_WAIT_MS : ARRIVAL_SAVE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [arrivalId, clear, landed, resolved]);
  useEffect(() => {
    if (!dissolving) return;
    fade.value = withTiming(1, { duration: reduced ? 0 : ARRIVAL_DISSOLVE_MS });
    const timer = setTimeout(clear, (reduced ? 0 : ARRIVAL_DISSOLVE_MS) + SETTLE_BACKSTOP_MS);
    return () => clearTimeout(timer);
  }, [clear, dissolving, fade, reduced]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
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
    {arrival ? <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents={dissolving ? 'none' : 'auto'} accessibilityElementsHidden>
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
    </Animated.View> : null}
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
