import { threadAuraTexture } from './threadAuraTexture';
import { Skia } from '@shopify/react-native-skia';

const mockDrawSvg = jest.fn();
const mockSnapshot = { width: () => 1600 };
jest.mock('@shopify/react-native-skia', () => ({
  TileMode: { Decal: 3 },
  ClipOp: { Intersect: 1 },
  Skia: {
    SVG: { MakeFromString: jest.fn(() => ({ dispose: jest.fn() })) },
    Surface: { MakeOffscreen: jest.fn(() => ({ getCanvas: () => ({ clear: jest.fn(), save: jest.fn(), translate: jest.fn(), clipRect: jest.fn(),
      saveLayer: jest.fn(), drawSvg: mockDrawSvg, restore: jest.fn() }), flush: jest.fn(), makeImageSnapshot: () => mockSnapshot, dispose: jest.fn() })) },
    Color: () => [0, 0, 0, 0],
    Paint: () => ({ setImageFilter: jest.fn(), dispose: jest.fn() }),
    ImageFilter: { MakeBlur: () => ({ dispose: jest.fn() }) },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
  },
}));

it('passes the exact XML to Skia, rasterizes only once, preserves alignment and bounds texture size', () => {
  const svg = '<svg viewBox="10 20 200 80"><path d="M10 20 L210 100"/></svg>';
  expect(threadAuraTexture(svg, 300, 216)).toBe(mockSnapshot);
  expect(Skia.SVG.MakeFromString).toHaveBeenCalledWith(svg);
  expect(mockDrawSvg).toHaveBeenCalledTimes(5);
  expect(mockDrawSvg.mock.calls[0].slice(1)).toEqual([172.8, 172.8]);
  expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(1920, 384);
  expect(threadAuraTexture(svg, 300, 216)).toBe(mockSnapshot);
  expect(mockDrawSvg).toHaveBeenCalledTimes(5);
});

it.each(['<image href="art.png"/>', '<filter/>', '<foreignObject/>', '<text>kept</text>'])('uses the native SVG fallback for unsupported %s', tag => {
  expect(threadAuraTexture(`<svg>${tag}</svg>`, 200, 144)).toBeNull();
});

it('falls back when Skia cannot parse an SVG', () => {
  jest.mocked(Skia.SVG.MakeFromString).mockReturnValueOnce(null);
  expect(threadAuraTexture('unparseable', 200, 144)).toBeNull();
});
