import { Skia } from '@shopify/react-native-skia';

// The shared Jest Skia stub predates the PathBuilder API used by the paywall.
// Add only the chainable builder methods needed by these render tests.
const makePath = jest.fn((): any => {
  const path: Record<string, any> = {};
  for (const operation of ['moveTo', 'lineTo', 'quadTo', 'cubicTo', 'close']) {
    path[operation] = jest.fn(() => path);
  }
  path.detach = jest.fn(() => ({ __pathBuilderStub: true }));
  return path;
});

(Skia as any).PathBuilder = { Make: makePath };
