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
    expect(iphone.anchorSize).toBe(152);
    expect(iphone.trackHeight).toBe(290);
    expect(android.anchorSize).toBe(184);
    expect(android.trackHeight).toBe(328);
  });

  it('keeps the construction ring centred when compact artwork is shorter than the ring', () => {
    const iphone = resolveHomeHeroLayout({ platform: 'ios', width: 393, height: 852, topInset: 59, bottomInset: 34, selectedIndex: 0, intentions });
    const android = resolveHomeHeroLayout({ platform: 'android', width: 412, height: 915, topInset: 24, bottomInset: 24, selectedIndex: 0, intentions });

    expect((iphone.artworkBoxHeight - iphone.constructionSize) / 2).toBe(-4);
    expect((android.artworkBoxHeight - android.constructionSize) / 2).toBe(0);
  });

  it('keeps the Anchor substantial on a compact Android dp viewport', () => {
    const android = resolveHomeHeroLayout({ platform: 'android', width: 384, height: 832, topInset: 24, bottomInset: 24, selectedIndex: 3, intentions });
    expect(android.anchorSize).toBe(184);
    expect(android.constructionSize).toBe(214);
    expect(android.artworkBoxHeight).toBe(214);
    expect(android.trackHeight).toBe(328);
  });

  it('reserves extra lines only for the visible carousel window', () => {
    const common = { platform: 'ios', width: 393, height: 852, topInset: 59, bottomInset: 34, intentions };
    expect(resolveHomeHeroLayout({ ...common, selectedIndex: 0 }).trackHeight).toBe(290);
    expect(resolveHomeHeroLayout({ ...common, selectedIndex: 23 }).trackHeight).toBeGreaterThan(290);
  });

});
