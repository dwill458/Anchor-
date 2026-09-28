import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@babel/parser';
import { burnFraction, flameContact, frontHeight, releaseArtworkRect, releaseSeed, seededUnit, createReleaseParticles } from '../releaseBurn';
import { RELEASE_CEREMONY_TIMELINE_MS as T } from '@/constants/v2/release';

it('keeps seeded initialization outside UI-thread callbacks (Android crash regression)', () => {
  const ast = parse(readFileSync(resolve(__dirname, '../V2ReleaseArtwork.tsx'), 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const uiCallbacks: any[] = [];
  const walk = (node: any, visitor: (node: any) => void) => {
    if (!node || typeof node !== 'object') return;
    visitor(node);
    for (const [key, child] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (Array.isArray(child)) child.forEach(value => walk(value, visitor));
      else if (child && typeof child === 'object') walk(child, visitor);
    }
  };
  walk(ast, node => { if (node.type === 'CallExpression' && ['useDerivedValue', 'useAnimatedStyle'].includes(node.callee?.name)) uiCallbacks.push(node.arguments[0]); });
  expect(uiCallbacks.length).toBeGreaterThan(0);
  for (const callback of uiCallbacks) walk(callback, node => {
    if (node.type === 'CallExpression') expect(['seededUnit', 'releaseSeed', 'createReleaseParticles'].includes(node.callee?.name)).toBe(false);
  });
});

it('has finite seeded geometry and monotonic consumed area for every ceremony frame', () => {
  for (const id of ['image-anchor', 'svg-anchor', '', 'long-id-123']) {
    const phase = seededUnit(releaseSeed(id), 13) * Math.PI * 2;
    let previous = 0;
    for (let time = 0; time <= T.completion; time += 16) {
      const fraction = burnFraction(time);
      expect(fraction).toBeGreaterThanOrEqual(previous);
      expect(fraction).toBeLessThanOrEqual(1);
      previous = fraction;
      expect(Number.isFinite(frontHeight(time, 244))).toBe(true);
      for (const slot of [0, 0.5, 1]) {
        const contact = flameContact(slot, time, 244, phase);
        expect(Number.isFinite(contact.x) && Number.isFinite(contact.y)).toBe(true);
        if (time >= T.emptyPause) expect(contact.visible).toBe(false);
      }
    }
    expect(createReleaseParticles(releaseSeed(id), 244).every(p => p.death <= T.emptyPause)).toBe(true);
  }
});

it.each([[393, 852], [384, 832]])('fits the iPhone 14 Pro and Galaxy S24 logical viewport %sx%s', (width, height) => {
  const rect = releaseArtworkRect(width, height);
  expect(rect.width).toBe(rect.height);
  expect(rect.x + rect.width / 2).toBe(width / 2);
  expect(rect.y).toBeGreaterThan(height * 0.34);
  expect(rect.y + rect.height).toBeLessThan(height - 140);
});
