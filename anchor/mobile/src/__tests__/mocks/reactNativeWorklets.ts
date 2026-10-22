/**
 * Jest stand-in for react-native-worklets. Reanimated 4 initializes Worklets native
 * runtimes at import time, which Jest does not provide. Worklet entry points run inline;
 * anything else resolves to an inert stub so Reanimated modules can load.
 */
type Fn = (...args: unknown[]) => unknown;

const inline = (fn: Fn) => (...args: unknown[]) => fn(...args);

const stub = (): unknown =>
  new Proxy(function stubbed() {}, {
    get: (_target, prop) => (prop === '__esModule' ? false : prop === Symbol.toPrimitive ? () => 0 : stub()),
    apply: () => stub(),
    construct: () => stub() as object,
  });

const impl: Record<string, unknown> = {
  __esModule: true,
  runOnUISync: inline,
  runOnUI: (fn: Fn) => fn,
  scheduleOnUI: inline,
  runOnJS: (fn: Fn) => fn,
  scheduleOnRN: inline,
  executeOnUIRuntimeSync: (fn: Fn) => fn,
  isWorkletFunction: () => false,
  serializableMappingCache: new Map(),
};

export default new Proxy(impl, {
  get: (target, prop) => (prop in target ? target[prop as string] : stub()),
});
