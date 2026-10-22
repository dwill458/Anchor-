import { resolveNoteAssetFrame } from '../noteAssetGeometry';

describe('paper asset alpha geometry', () => {
  it.each(['tornPaper', 'handmadePaper'] as const)('centers all visible alpha bounds for %s without cropping', asset => {
    const width = 240;
    const height = 180;
    const frame = resolveNoteAssetFrame(asset, width, height);
    expect(frame.position).toBe('absolute');
    const measured = asset === 'tornPaper'
      ? { left: 13 / 512, top: 14 / 512, right: 501 / 512, bottom: 502 / 512 }
      : { left: 19 / 512, top: 20 / 512, right: 501 / 512, bottom: 499 / 512 };
    const visibleLeft = frame.left + measured.left * frame.width;
    const visibleRight = frame.left + measured.right * frame.width;
    const visibleTop = frame.top + measured.top * frame.height;
    const visibleBottom = frame.top + measured.bottom * frame.height;
    expect(visibleLeft).toBeGreaterThanOrEqual(-0.001);
    expect(visibleRight).toBeLessThanOrEqual(width + 0.001);
    expect(visibleTop).toBeGreaterThanOrEqual(-0.001);
    expect(visibleBottom).toBeLessThanOrEqual(height + 0.001);
    expect((visibleLeft + visibleRight) / 2).toBeCloseTo(width / 2, 2);
    expect((visibleTop + visibleBottom) / 2).toBeCloseTo(height / 2, 2);
  });
});
