/**
 * Jest stand-in for react-native-reanimated. Reanimated 4 loads its native runtime
 * (CSS handler, Worklets) at import time, which Jest cannot provide. This stub keeps
 * shared values as plain objects, runs animation callbacks inline, and returns the
 * target value for animation builders. Unknown exports resolve to inert functions.
 */
import * as React from 'react';
import * as RN from 'react-native';

type AnyFn = (...args: unknown[]) => unknown;
type MockSharedValue<T = unknown> = { value: T; listeners: Set<() => void> };

let trackingSharedValues: Set<MockSharedValue> | null = null;
const observeSharedValue = <T>(initial: T): MockSharedValue<T> => {
  let current = initial;
  const shared: MockSharedValue<T> = { listeners: new Set(), get value() {
    trackingSharedValues?.add(shared as MockSharedValue);
    return current;
  }, set value(value: T) {
    current = value;
    [...shared.listeners].forEach(listener => listener());
  } };
  return shared;
};

const identity = <T>(value: T): T => value;
const inert: AnyFn = () => undefined;

const useSharedValue = <T>(initial: T) => {
  const ref = React.useRef<MockSharedValue<T> | null>(null);
  if (!ref.current) ref.current = observeSharedValue(initial);
  return ref.current;
};
const useDerivedValue = <T>(compute: () => T) => ({ value: compute() });
// Animated styles and props are plain objects that components apply directly.
// Reanimated keeps an animated-style handle stable across renders; updating a
// fresh object here creates artificial prop churn in memoized screen sections.
const useAnimatedStyle = (compute: () => unknown) => {
  const styleRef = React.useRef<unknown>(undefined);
  const computeRef = React.useRef(compute);
  computeRef.current = compute;
  const update = React.useCallback(() => {
    const observed = new Set<MockSharedValue>();
    trackingSharedValues = observed;
    let next: unknown;
    try {
      next = computeRef.current();
    } finally {
      trackingSharedValues = null;
    }
    if (next && typeof next === 'object' && styleRef.current && typeof styleRef.current === 'object') {
      const current = styleRef.current as Record<string, unknown>;
      const updated = next as Record<string, unknown>;
      Object.keys(current).forEach((key) => { if (!(key in updated)) delete current[key]; });
      Object.assign(current, updated);
    } else {
      styleRef.current = next;
    }
    return observed;
  }, []);
  const observedRef = React.useRef<Set<MockSharedValue>>(new Set());
  update();
  React.useEffect(() => {
    const refresh = () => {
      observedRef.current.forEach(shared => shared.listeners.delete(refresh));
      observedRef.current = update();
      observedRef.current.forEach(shared => shared.listeners.add(refresh));
    };
    observedRef.current = update();
    observedRef.current.forEach(shared => shared.listeners.add(refresh));
    return () => observedRef.current.forEach(shared => shared.listeners.delete(refresh));
  }, [update]);
  return styleRef.current;
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
const useAnimatedReaction = (
  prepare: () => unknown,
  react: (current: unknown, previous: unknown) => void,
  dependencies: React.DependencyList = [],
) => {
  const prepareRef = React.useRef(prepare);
  const reactRef = React.useRef(react);
  prepareRef.current = prepare;
  reactRef.current = react;
  React.useEffect(() => {
    const observed = new Set<MockSharedValue>();
    trackingSharedValues = observed;
    let previous: unknown;
    let hasPrevious = false;
    try {
      const initial = prepareRef.current();
      reactRef.current(initial, undefined);
      previous = initial;
      hasPrevious = true;
    } finally {
      trackingSharedValues = null;
    }
    const update = () => {
      const nextObserved = new Set<MockSharedValue>();
      trackingSharedValues = nextObserved;
      try {
        const current = prepareRef.current();
        reactRef.current(current, hasPrevious ? previous : undefined);
        previous = current;
        hasPrevious = true;
      } finally {
        trackingSharedValues = null;
      }
      nextObserved.forEach(shared => {
        if (observed.has(shared)) return;
        observed.add(shared);
        shared.listeners.add(update);
      });
    };
    observed.forEach(shared => shared.listeners.add(update));
    return () => observed.forEach(shared => shared.listeners.delete(update));
  // Reanimated reactions are registered once and observe shared-value updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};

const layoutBuilder = (): unknown => new Proxy(function builder() {}, {
  get: (_t, prop) => (prop === '__esModule' ? false : layoutBuilder()),
  apply: () => layoutBuilder(),
});

const interpolate = (value: number, input: number[], output: number[], extrapolation?: unknown) => {
  if (input.length < 2 || output.length !== input.length) return output[0];
  let segment = 0;
  if (value <= input[0]) segment = 0;
  else if (value >= input[input.length - 1]) segment = input.length - 2;
  else while (segment < input.length - 2 && value > input[segment + 1]) segment += 1;
  const start = input[segment];
  const end = input[segment + 1];
  const progress = (value - start) / (end - start);
  const result = output[segment] + (output[segment + 1] - output[segment]) * progress;
  if (extrapolation === 'clamp') {
    if (value < input[0]) return output[0];
    if (value > input[input.length - 1]) return output[output.length - 1];
  }
  return result;
};
const easing = {
  linear: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  ease: (t: number) => t * t * (3 - 2 * t),
  sin: (t: number) => (1 - Math.cos(Math.PI * t)) / 2,
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => (t: number) => 1 - fn(1 - t),
  inOut: (fn: (t: number) => number) => (t: number) => t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2,
  back: (overshoot = 1.5) => (t: number) => t * t * ((overshoot + 1) * t - overshoot),
  bezier: (_x1: number, y1: number, _x2: number, y2: number) => (t: number) => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t;
  },
  bezierFn: (_x1: number, y1: number, _x2: number, y2: number) => (t: number) => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t;
  },
};

const stubs: Record<string, unknown> = {
  __esModule: true,
  default: { View: RN.View, Text: RN.Text, Image: RN.Image, ScrollView: RN.ScrollView, createAnimatedComponent: identity },
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useAnimatedReaction,
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
  makeMutable: <T>(value: T) => observeSharedValue(value),
  createAnimatedComponent: identity,
  // Match the easing functions used by the app so animation tests can inspect progress.
  Easing: easing,
  ReduceMotion: { Never: 'never', Always: 'always', System: 'system' },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate,
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
