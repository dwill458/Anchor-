/**
 * Jest stand-in for react-native-reanimated. Reanimated 4 loads its native runtime
 * (CSS handler, Worklets) at import time, which Jest cannot provide. This stub keeps
 * shared values as plain objects, runs animation callbacks inline, and returns the
 * target value for animation builders. Unknown exports resolve to inert functions.
 */
import * as React from 'react';
import * as RN from 'react-native';

type AnyFn = (...args: unknown[]) => unknown;

const identity = <T>(value: T): T => value;
const inert: AnyFn = () => undefined;

const useSharedValue = <T>(initial: T) => {
  const ref = React.useRef({ value: initial });
  return ref.current;
};
const useDerivedValue = <T>(compute: () => T) => ({ value: compute() });
// Animated styles and props are plain objects that components apply directly.
// Reanimated keeps an animated-style handle stable across renders; updating a
// fresh object here creates artificial prop churn in memoized screen sections.
const useAnimatedStyle = (compute: () => unknown) => {
  const next = compute();
  const ref = React.useRef(next);
  if (next && typeof next === 'object' && ref.current && typeof ref.current === 'object') {
    const current = ref.current as Record<string, unknown>;
    const updated = next as Record<string, unknown>;
    Object.keys(current).forEach((key) => { if (!(key in updated)) delete current[key]; });
    Object.assign(current, updated);
  } else {
    ref.current = next;
  }
  return ref.current;
};
const useAnimatedProps = (compute: () => unknown) => compute();
const withTiming = jest.fn(<T>(toValue: T, _config?: unknown, done?: (finished: boolean) => void) => {
  done?.(true);
  return toValue;
});
const withSpring = jest.fn(withTiming);
const withDelay = <T>(_delay: number, value: T) => value;
const withRepeat = <T>(value: T) => value;
const withSequence = (...values: unknown[]) => values[values.length - 1];

const layoutBuilder = (): unknown => new Proxy(function builder() {}, {
  get: (_t, prop) => (prop === '__esModule' ? false : layoutBuilder()),
  apply: () => layoutBuilder(),
});

const stubs: Record<string, unknown> = {
  __esModule: true,
  default: { View: RN.View, Text: RN.Text, Image: RN.Image, ScrollView: RN.ScrollView, createAnimatedComponent: identity },
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useAnimatedReaction: inert,
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => ({}),
  scrollTo: inert,
  ZoomIn: layoutBuilder(),
  FadeInDown: layoutBuilder(),
  FadeOutUp: layoutBuilder(),
  useFrameCallback: () => ({ setActive: inert, isActive: false }),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({ height: { value: 0 } }),
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  withDecay: identity,
  cancelAnimation: inert,
  runOnJS: (fn: AnyFn) => fn,
  runOnUI: (fn: AnyFn) => fn,
  makeMutable: <T>(value: T) => ({ value }),
  createAnimatedComponent: identity,
  // Easing.bezier(...) and friends return easing functions; keep them identity.
  Easing: new Proxy({}, { get: () => () => (t: number) => t }),
  ReduceMotion: { Never: 'never', Always: 'always', System: 'system' },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate: (value: number, _in: number[], out: number[]) => out[0],
  Keyframe: layoutBuilder(),
  LinearTransition: layoutBuilder(),
  FadeIn: layoutBuilder(),
  FadeOut: layoutBuilder(),
  SlideInDown: layoutBuilder(),
  SlideOutDown: layoutBuilder(),
  interpolateColor: (_value: number, _in: number[], out: string[]) => out[0],
};

export default new Proxy(stubs, {
  // Layout animations are capitalised builders (FadeInUp.duration(...).delay(...)).
  get: (target, prop) => {
    if (prop in target) return target[prop as string];
    return typeof prop === 'string' && /^[A-Z]/.test(prop) ? layoutBuilder() : inert;
  },
});
