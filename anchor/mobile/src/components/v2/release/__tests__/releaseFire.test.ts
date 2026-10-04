import { resolveReleaseFire } from '../releaseFire';
import { artworkHasInk, buildReleaseArtworkSvg } from '../releaseArtworkImage';

const base = { reduceMotion: false, effectAvailable: true, texture: 'valid' as const };

describe('resolveReleaseFire', () => {
  it('runs only when the effect compiled and the texture validated', () => {
    expect(resolveReleaseFire(base)).toEqual({ enabled: true, fallback: null });
  });

  it('a blank capture falls back to the fade and says why', () => {
    expect(resolveReleaseFire({ ...base, texture: 'blank' })).toEqual({ enabled: false, fallback: 'capture_blank' });
  });

  it('an uncompiled effect falls back', () => {
    expect(resolveReleaseFire({ ...base, effectAvailable: false })).toEqual({ enabled: false, fallback: 'effect_unavailable' });
  });

  it('honors the kill switch even with a valid texture', () => {
    expect(resolveReleaseFire({ ...base, killSwitch: true })).toEqual({ enabled: false, fallback: 'effect_unavailable' });
  });

  it('Reduced Motion never burns, whatever else is true', () => {
    expect(resolveReleaseFire({ ...base, reduceMotion: true })).toEqual({ enabled: false, fallback: 'reduced_motion' });
  });

  it('a texture still being built is neither usable nor a failure', () => {
    expect(resolveReleaseFire({ ...base, texture: 'pending' })).toEqual({ enabled: false, fallback: null });
  });
});

describe('artworkHasInk (blank capture detection)', () => {
  const size = 40;
  const fill = (rgba: [number, number, number, number]) => {
    const pixels = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i += 1) pixels.set(rgba, i * 4);
    return pixels;
  };

  it('rejects null, short and fully transparent buffers (the Android blank handoff)', () => {
    expect(artworkHasInk(null, size, size)).toBe(false);
    expect(artworkHasInk(new Uint8Array(8), size, size)).toBe(false);
    expect(artworkHasInk(fill([0, 0, 0, 0]), size, size)).toBe(false);
  });

  it('rejects a paper-only disc', () => {
    expect(artworkHasInk(fill([244, 237, 224, 255]), size, size)).toBe(false);
  });

  it('accepts a disc that carries a mark', () => {
    const pixels = fill([244, 237, 224, 255]);
    for (let y = 10; y < 30; y += 1) pixels.set([20, 24, 43, 255], (y * size + 20) * 4);
    for (let y = 10; y < 30; y += 1) pixels.set([20, 24, 43, 255], (y * size + 22) * 4);
    expect(artworkHasInk(pixels, size, size)).toBe(true);
  });
});

describe('buildReleaseArtworkSvg', () => {
  const svg = '<svg viewBox="0 0 100 100"><path d="M10 10 L90 90" stroke="#123456" stroke-width="3" fill="none"/></svg>';

  it('draws the paper disc and the stored path unchanged', () => {
    const out = buildReleaseArtworkSvg({ svg, category: 'creativity', expression: 'monoline', size: 244 });
    expect(out).toContain('<circle');
    expect(out).toContain('d="M10 10 L90 90"');
  });

  it('draws a stored SVG without an expression as stored', () => {
    const out = buildReleaseArtworkSvg({ svg, category: 'creativity', size: 244 });
    expect(out).toContain('M10 10 L90 90');
  });

  it('returns null for artwork it cannot represent so the native art stays', () => {
    expect(buildReleaseArtworkSvg({ svg: '', size: 244 })).toBeNull();
    expect(buildReleaseArtworkSvg({ svg: 'not svg', size: 244 })).toBeNull();
  });
});
