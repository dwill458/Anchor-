import { resolveHomeHeroLayout } from '../homeHeroLayout';

const intentions = [
  'Complete focus in gym',
  'I am strong and healthy',
  'Anchor has ten thousand users',
  ...Array.from({ length: 38 }, (_, index) => index === 20
    ? 'A deliberately long intention elsewhere in the library that must not enlarge the selected Home hero'
    : 'Another Anchor'),
];

describe('Home hero sizing', () => {
  it('uses the compact geometry on an iPhone 14 Pro viewport', () => {
    const iphone = resolveHomeHeroLayout({ platform: 'ios', width: 393, height: 852, topInset: 59, bottomInset: 34, selectedIndex: 0, intentions });
    const android = resolveHomeHeroLayout({ platform: 'android', width: 412, height: 915, topInset: 24, bottomInset: 24, selectedIndex: 0, intentions });
    expect(iphone.anchorSize).toBe(188);
    expect(iphone.trackHeight).toBe(393);
    expect(android.anchorSize).toBe(224);
    expect(android.trackHeight).toBe(429);
  });

  it('keeps the construction ring centred behind the coin', () => {
    const iphone = resolveHomeHeroLayout({ platform: 'ios', width: 393, height: 852, topInset: 59, bottomInset: 34, selectedIndex: 0, intentions });
    const android = resolveHomeHeroLayout({ platform: 'android', width: 412, height: 915, topInset: 24, bottomInset: 24, selectedIndex: 0, intentions });

    expect((iphone.artworkBoxHeight - iphone.constructionSize) / 2).toBe(11);
    expect((android.artworkBoxHeight - android.constructionSize) / 2).toBe(11);
  });

  it('holds the coin to the usable height on an S24-class Android dp viewport', () => {
    const android = resolveHomeHeroLayout({ platform: 'android', width: 384, height: 832, topInset: 24, bottomInset: 24, selectedIndex: 3, intentions });
    // 784dp usable: the height share, not the tuned tier, sets the size, so the text rows keep their room.
    expect(android.anchorSize).toBe(208);
    expect(android.constructionSize).toBe(238);
    expect(android.artworkBoxHeight).toBe(260);
    expect(android.trackHeight).toBe(413);
  });

  it('never changes height with the intention, so the divider cannot jump between Anchors', () => {
    const common = { platform: 'android', width: 384, height: 832, topInset: 24, bottomInset: 24, intentions };
    const heights = new Set([0, 1, 2, 3, 20, 23].map((selectedIndex) => resolveHomeHeroLayout({ ...common, selectedIndex }).trackHeight));
    expect(heights.size).toBe(1);
  });
});

describe('Home hero scales with the screen', () => {
  const common = { topInset: 24, bottomInset: 24, selectedIndex: 0, intentions: ['I am free'] };

  it('shrinks the coin on shorter screens and never exceeds its tuned size on tall ones', () => {
    const sizes = [700, 760, 832, 915, 1000].map((height) => resolveHomeHeroLayout({ platform: 'android', width: 412, height, ...common }).anchorSize);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(224);
  });

  it('keeps room above the coin for the status ring, clear of the context row', () => {
    const layout = resolveHomeHeroLayout({ platform: 'android', width: 384, height: 832, ...common });
    const ringReach = (layout.anchorSize + 14) / 2 + 8 + 2;
    expect(layout.artworkBoxHeight / 2 - ringReach).toBeGreaterThanOrEqual(8);
  });
});

describe('hero intention label size', () => {
  it('is 23 up to 25 characters and 20 beyond, so a long intention keeps its two lines', () => {
    const { heroIntentionFontSize } = jest.requireActual('../homeHeroLayout') as typeof import('../homeHeroLayout');
    expect(heroIntentionFontSize('a'.repeat(25))).toBe(23);
    expect(heroIntentionFontSize('a'.repeat(26))).toBe(20);
    expect(heroIntentionFontSize('')).toBe(23);
  });
});


describe('EV1 line owns its space', () => {
  it('reserves a full scaled row at 1.3x without taking the existing Thread row slack', () => {
    const input = { platform: 'android', width: 384, height: 832, topInset: 24, bottomInset: 24 };
    const resting = resolveHomeHeroLayout(input);
    const scene = resolveHomeHeroLayout({ ...input, evolvedScene: true, fontScale: 1.3 });
    expect(scene.trackHeight - resting.trackHeight).toBe(34);
    expect(scene.artworkBoxHeight).toBe(resting.artworkBoxHeight);
    expect(scene.trackHeight - resting.trackHeight - 8).toBeGreaterThanOrEqual(20 * 1.3);
    expect(resolveHomeHeroLayout({ ...input, evolvedScene: false, fontScale: 1.3 }).trackHeight).toBe(resting.trackHeight);
  });
});
