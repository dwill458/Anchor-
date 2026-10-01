import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolateColor, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors } from '@/theme/v2';

export type VisionImageRect = { x: number; y: number; width: number; height: number };
type Arrival = { url: string; source: VisionImageRect; target?: VisionImageRect };
type ArrivalContext = {
  url: string | null;
  begin: (url: string, source: VisionImageRect) => void;
  cancel: () => void;
  resolve: (url: string) => void;
  land: (url: string, target: VisionImageRect) => void;
};
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
  const begin = useCallback((url: string, source: VisionImageRect) => {
    if (!url || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0) return;
    expand.value = 0; settle.value = 0; setImageAspect(source.width / source.height); setSourceReady(false); setArrival({ url, source });
  }, [expand, settle]);
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
  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(settle.value, [0, 0.6], [colors.ink.base, colors.canvas]),
    opacity: 1 - Math.max(0, (settle.value - 0.65) / 0.35),
  }));
  return <Context.Provider value={{ url: arrival?.url ?? null, begin, cancel: clear, resolve, land }}>
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
