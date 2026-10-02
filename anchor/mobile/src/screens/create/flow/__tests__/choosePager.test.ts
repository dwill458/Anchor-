import { MIN_HAPTIC_GAP_MS, SEAL_HOLD_MS } from '../creationFlowConfig';
import {
  CARD,
  HOLD,
  PAGE_PITCH,
  advanceHold,
  beginTouch,
  holdCenter,
  holdHapticInterval,
  holdHapticStrength,
  isSettled,
  moveTouch,
  snapPage,
} from '../choosePager';
import { buildCreationTimeline, mapLetterEventTimes } from '../useCreationTimeline';
import { normalizeGeneratedForms } from '../generatedForms';

describe('hold to seal', () => {
  it('starts only on a settled page, inside the hold circle', () => {
    expect(beginTouch(195, 400, 0).holding).toBe(true);
    expect(beginTouch(195, 400 + HOLD.radius + 1, 0).holding).toBe(false);
    expect(beginTouch(195, 400, 0.4).holding).toBe(false);
    expect(isSettled(0.04)).toBe(true);
    expect(isSettled(0.06)).toBe(false);
  });

  it('follows the visible card as the pager moves', () => {
    expect(holdCenter(0).x).toBeCloseTo(CARD.x + CARD.width / 2, 5);
    expect(holdCenter(1).x).toBeCloseTo(CARD.x + CARD.width / 2, 5);
    expect(holdCenter(0.5).x).not.toBeCloseTo(CARD.x + CARD.width / 2, 1);
  });

  it('fills over exactly 1.1 s and then completes', () => {
    let step = { progress: 0, complete: false };
    const frame = 1 / 60;
    let elapsed = 0;
    while (!step.complete && elapsed < 3) {
      step = advanceHold(step.progress, frame, true);
      elapsed += frame;
    }
    expect(elapsed * 1000).toBeGreaterThanOrEqual(SEAL_HOLD_MS - 20);
    expect(elapsed * 1000).toBeLessThanOrEqual(SEAL_HOLD_MS + 20);
    expect(step.complete).toBe(true);
  });

  it('does not complete before 1.1 s', () => {
    const step = advanceHold(0, 1.0, true);
    expect(step.complete).toBe(false);
    expect(step.progress).toBeCloseTo(1 / 1.1, 5);
  });

  it('drains 2.6x faster than it fills when released early', () => {
    expect(advanceHold(0.8, 0.1, false).progress).toBeCloseTo(0.8 - 0.26, 5);
    expect(advanceHold(0.1, 1, false).progress).toBe(0);
  });

  it('tightens the haptic cadence from 150 ms to 50 ms', () => {
    expect(holdHapticInterval(0)).toBe(150);
    expect(holdHapticInterval(1)).toBe(50);
    expect(holdHapticInterval(0.5)).toBe(100);
    expect(holdHapticStrength(0.2)).toBe('light');
    expect(holdHapticStrength(0.9)).toBe('medium');
  });
});

describe('swipe vs hold', () => {
  it('a sideways move beyond 10 px cancels the hold and becomes a swipe', () => {
    const down = beginTouch(195, 400, 0);
    expect(down.holding).toBe(true);

    const small = moveTouch(down, 195 + 9);
    expect(small.touch.holding).toBe(true);
    expect(small.page).toBeNull();

    const big = moveTouch(down, 195 + 11);
    expect(big.touch.holding).toBe(false);
    expect(big.touch.dragging).toBe(true);
    expect(big.page).not.toBeNull();
  });

  it('dragging left moves toward the next page', () => {
    const down = beginTouch(30, 150, 0); // outside the hold circle
    expect(down.holding).toBe(false);
    const moved = moveTouch(down, 30 - PAGE_PITCH / 2);
    expect(moved.page).toBeCloseTo(0.5, 5);
  });

  it('snaps with round(startPage + delta * 1.9)', () => {
    // A third of a page is enough to turn it (0.33 * 1.9 = 0.63 -> 1).
    expect(snapPage(0, 200, 200 + PAGE_PITCH / 3)).toBe(1);
    // A fifth is not (0.2 * 1.9 = 0.38 -> 0).
    expect(snapPage(0, 200, 200 + PAGE_PITCH / 5)).toBe(0);
    // Clamped to the two real pages.
    expect(snapPage(1, 0, 4000)).toBe(1);
    expect(snapPage(0, 4000, 0)).toBe(0);
  });
});

describe('map event timing', () => {
  it('lands one event per letter inside the Map segment', () => {
    const timeline = buildCreationTimeline({ mode: 'first', n: 7, drawn: false });
    const times = mapLetterEventTimes(timeline, 7);
    expect(times).toHaveLength(7);
    times.forEach((t) => {
      expect(t).toBeGreaterThan(timeline.start.map);
      expect(t).toBeLessThan(timeline.start.forget);
    });
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('even a dense repeat anchor keeps ticks beyond the 90 ms haptic floor', () => {
    const timeline = buildCreationTimeline({ mode: 'repeat', n: 20, drawn: false });
    const times = mapLetterEventTimes(timeline, 20);
    for (let i = 1; i < times.length; i += 1) {
      expect((times[i] - times[i - 1]) * 1000).toBeGreaterThanOrEqual(MIN_HAPTIC_GAP_MS - 1);
    }
  });

  it('draw path has no letter events', () => {
    const timeline = buildCreationTimeline({ mode: 'first', n: 7, drawn: true });
    expect(mapLetterEventTimes(timeline, 7)).toEqual([]);
  });
});

describe('normalizeGeneratedForms', () => {
  it('keeps two forms, adds a data prefix to bare base64 and preserves ids', () => {
    const forms = normalizeGeneratedForms([
      'AAAA',
      { imageUrl: 'https://example.com/b.png', variationId: 'v2', reusedFromPool: true } as never,
      'CCCC',
    ]);
    expect(forms).toHaveLength(2);
    expect(forms[0].uri).toBe('data:image/png;base64,AAAA');
    expect(forms[1].uri).toBe('https://example.com/b.png');
    expect(forms[1].variationId).toBe('v2');
    expect(forms[1].reusedFromPool).toBe(true);
    expect(forms[0].isHeavyInline).toBe(false);
  });

  it('flags very large inline images', () => {
    const big = `data:image/png;base64,${'A'.repeat(700_001)}`;
    expect(normalizeGeneratedForms([big])[0].isHeavyInline).toBe(true);
  });
});
