import {
  buildVisionSceneSchedule,
  buildVisionSceneSnapshot,
  isValidVisualizeSceneSnapshot,
  V2_VISUALIZE_TIMING,
  visionImageFit,
  visionSceneSlotAt,
  visualizePromptAt,
  visualizeReflectionPrompts,
} from '../visualizeVisionPlan';
import type { Anchor } from '@/types';

describe('buildVisionSceneSchedule', () => {
  it('shows fewer scenes in one minute so each can be seen', () => {
    const schedule = buildVisionSceneSchedule(60, 5);
    expect(schedule.map(slot => slot.imageIndex)).toEqual([0, 1]);
    expect(schedule.map(slot => slot.endMs - slot.startMs)).toEqual([30_000, 30_000]);
  });

  it('gives each of five scenes ~36 seconds in three minutes', () => {
    const schedule = buildVisionSceneSchedule(180, 5);
    expect(schedule).toHaveLength(5);
    expect(schedule[0].endMs - schedule[0].startMs).toBe(36_000);
    expect(schedule[schedule.length - 1].endMs).toBe(180_000);
  });

  it('holds longer rather than slideshowing when there are few images', () => {
    const schedule = buildVisionSceneSchedule(180, 2);
    expect(schedule.map(slot => slot.endMs - slot.startMs)).toEqual([90_000, 90_000]);
  });

  it('revisits scenes naturally in five minutes', () => {
    expect(buildVisionSceneSchedule(300, 2).map(slot => slot.imageIndex)).toEqual([0, 1, 0, 1]);
    expect(buildVisionSceneSchedule(300, 3).map(slot => slot.imageIndex)).toEqual([0, 1, 2, 0, 1]);
    expect(buildVisionSceneSchedule(300, 5)).toHaveLength(5);
    expect(buildVisionSceneSchedule(300, 1)).toHaveLength(1);
  });

  it('always ends exactly at the session boundary', () => {
    for (const duration of [60, 180, 300]) {
      for (let images = 1; images <= 5; images++) {
        const schedule = buildVisionSceneSchedule(duration, images);
        expect(schedule[0].startMs).toBe(0);
        expect(schedule[schedule.length - 1].endMs).toBe(duration * 1000);
        expect(visionSceneSlotAt(schedule, duration * 1000 + 5_000)).toBe(schedule[schedule.length - 1]);
      }
    }
  });
});

describe('visionImageFit', () => {
  const phone = { width: 390, height: 844 };

  it('fills the screen from a portrait original with only a sliver cropped', () => {
    const fit = visionImageFit({ width: 1080, height: 1920 }, phone);
    expect(fit.extended).toBe(false);
    expect(fit.height).toBeCloseTo(844);
    // 9:16 on a 19.5:9 phone: under a tenth of each side is lost.
    expect(-fit.left / fit.width).toBeLessThan(0.1);
  });

  it('never cuts a square or landscape image to a narrow strip', () => {
    for (const image of [{ width: 1024, height: 1024 }, { width: 1600, height: 900 }]) {
      const fit = visionImageFit(image, phone);
      expect(fit.extended).toBe(true);
      // At most 25% beyond "fit" - most of the photograph stays visible.
      expect(fit.width / phone.width).toBeLessThanOrEqual(1.25 + 1e-9);
      expect(fit.top).toBeGreaterThan(0);
    }
  });

  it('falls back to plain cover until the size is known', () => {
    expect(visionImageFit(undefined, phone)).toEqual({ width: 390, height: 844, left: 0, top: 0, extended: false });
  });
});

describe('ending timing', () => {
  it('transforms the Vision into the Anchor in roughly two seconds, then speaks', () => {
    const E = V2_VISUALIZE_TIMING.ending;
    const anchorPresentAt = E.anchorAtMs + E.anchorStepsMs.reduce((sum, ms) => sum + ms, 0);
    const transformation = anchorPresentAt - E.transformAtMs;
    expect(transformation).toBeGreaterThanOrEqual(1500);
    expect(transformation).toBeLessThanOrEqual(2500);
    // Vision and Anchor coexist: the Anchor starts before the photo has gone.
    expect(E.anchorAtMs).toBeLessThan(E.photoOutAtMs + E.photoOutMs);
    expect(E.photoOutAtMs + E.photoOutMs).toBeLessThanOrEqual(anchorPresentAt + 100);
    expect(E.lineAtMs).toBeGreaterThan(anchorPresentAt);
    expect(E.continueAtMs).toBeGreaterThan(E.lineAtMs);
  });
});

describe('reflection prompts', () => {
  it('are sparse, leaving most of the session to the Vision alone', () => {
    for (const duration of [60, 180, 300]) {
      const prompts = visualizeReflectionPrompts(duration);
      const shownMs = prompts.length * 5_200;
      expect(shownMs / (duration * 1000)).toBeLessThan(0.1);
      expect(prompts.every(prompt => prompt.atMs < duration * 1000 - 10_000)).toBe(true);
    }
  });

  it('only appear inside their hold window', () => {
    const prompts = visualizeReflectionPrompts(60);
    expect(visualizePromptAt(prompts, 29_000)).toBeNull();
    expect(visualizePromptAt(prompts, 31_000)?.text).toBe('Notice what’s different.');
    expect(visualizePromptAt(prompts, 40_000)).toBeNull();
  });
});

describe('buildVisionSceneSnapshot', () => {
  const anchor = { category: 'desire' as Anchor['category'], intentionText: 'Anchor has ten thousand users' };

  it('uses the person’s own Vision when it satisfies the completion contract', () => {
    const snapshot = buildVisionSceneSnapshot('My revenuecat dashboard shows 10 thousand active users for anchor.', anchor);
    expect(snapshot).toBe('My revenuecat dashboard shows 10 thousand active users for anchor.');
    expect(isValidVisualizeSceneSnapshot(snapshot)).toBe(true);
  });

  it('takes the first sentence and fits it to 180 characters', () => {
    const long = `I open my laptop in my home office ${'and see the numbers climbing '.repeat(10)}today. Then something else happens.`;
    const snapshot = buildVisionSceneSnapshot(long, anchor);
    expect(snapshot.length).toBeLessThanOrEqual(180);
    expect(snapshot.endsWith('.')).toBe(true);
    expect(isValidVisualizeSceneSnapshot(snapshot)).toBe(true);
  });

  it('falls back to the Anchor scene when the Vision would be rejected', () => {
    for (const description of [
      'The team celebrates the launch together.', // not first person
      'I walk in at the office and everyone claps.', // unsupported detail
      '', // nothing written
    ]) {
      const snapshot = buildVisionSceneSnapshot(description, anchor);
      expect(isValidVisualizeSceneSnapshot(snapshot)).toBe(true);
      expect(snapshot).not.toBe(description);
    }
  });
});
