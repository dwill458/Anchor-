import { FOCUS_AREAS, focusHandoffLine } from '@/constants/v2/focusAreas';
import { solveFocusLayout } from '../focusAreaLayout';

const DEVICES = {
  'iPhone 14 Pro': { width: 393, height: 852, insets: { top: 59, bottom: 34 } },
  'Galaxy S24': { width: 360, height: 780, insets: { top: 32, bottom: 24 } },
  'Pixel 8 Pro (tall)': { width: 412, height: 915, insets: { top: 40, bottom: 24 } },
  'iPhone SE (short)': { width: 375, height: 667, insets: { top: 20, bottom: 0 } },
} as const;

describe('onboarding question layout', () => {
  it.each(Object.entries(DEVICES))('fits six rows below the header on %s', (_name, device) => {
    const layout = solveFocusLayout(device.width, device.height, device.insets);
    expect(layout.rowH).toBeGreaterThanOrEqual(56);
    expect(layout.rowH).toBeLessThanOrEqual(72);
    expect(layout.questionTop).toBeGreaterThanOrEqual(device.insets.top + 48);
    // The question ends above the list, and the list ends above the safe area.
    expect(layout.questionTop + 76).toBeLessThanOrEqual(layout.listTop);
    expect(layout.listTop + layout.rowH * 6).toBeLessThanOrEqual(device.height - device.insets.bottom);
  });
});

describe('handoff line', () => {
  it('mirrors the category back, and calls the open choice "Yours"', () => {
    const lines = Object.fromEntries(FOCUS_AREAS.map((area) => [area.id, focusHandoffLine(area)]));
    expect(lines).toEqual({
      health: 'Health. Good — let’s give it a shape.',
      career: 'Career. Good — let’s give it a shape.',
      relationships: 'Relationships. Good — let’s give it a shape.',
      money: 'Money. Good — let’s give it a shape.',
      family: 'Family. Good — let’s give it a shape.',
      something_else: 'Yours. Good — let’s give it a shape.',
    });
  });
});
