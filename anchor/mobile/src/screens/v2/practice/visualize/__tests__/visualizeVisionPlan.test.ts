import {
  buildBoardVisitSchedule,
  buildVisionSceneSnapshot,
  isValidVisualizeSceneSnapshot,
  V2_VISUALIZE_TIMING,
  visionSceneSlotAt,
  visualizePromptAt,
  visualizeReflectionPrompts,
} from '../visualizeVisionPlan';
import type { Anchor } from '@/types';

const OPENING = V2_VISUALIZE_TIMING.board.openingAnchorMs;

describe('buildBoardVisitSchedule', () => {
  it('opens on the Anchor before the first photograph', () => {
    const schedule = buildBoardVisitSchedule(180, 4);
    expect(schedule[0].startMs).toBe(OPENING);
  });

  it('visits every photograph in one minute when each can still be seen', () => {
    const schedule = buildBoardVisitSchedule(60, 5);
    expect(schedule.map(slot => slot.imageIndex)).toEqual([0, 1, 2, 3, 4]);
    for (const slot of schedule) expect(slot.endMs - slot.startMs).toBeGreaterThanOrEqual(V2_VISUALIZE_TIMING.board.minDwellMs);
  });

  it('never rushes: a minute with six photographs keeps the dwell floor', () => {
    const schedule = buildBoardVisitSchedule(60, 6);
    expect(schedule.length).toBeLessThanOrEqual(6);
    for (const slot of schedule) expect(slot.endMs - slot.startMs).toBeGreaterThanOrEqual(V2_VISUALIZE_TIMING.board.minDwellMs);
  });

  it('visits each photograph once in three minutes, holding longer when there are few', () => {
    expect(buildBoardVisitSchedule(180, 5).map(slot => slot.imageIndex)).toEqual([0, 1, 2, 3, 4]);
    const two = buildBoardVisitSchedule(180, 2);
    expect(two.map(slot => slot.endMs - slot.startMs)).toEqual([86_500, 86_500]);
  });

  it('revisits photographs naturally in five minutes', () => {
    expect(buildBoardVisitSchedule(300, 2).map(slot => slot.imageIndex)).toEqual([0, 1, 0, 1]);
    expect(buildBoardVisitSchedule(300, 3).map(slot => slot.imageIndex)).toEqual([0, 1, 2, 0, 1]);
    expect(buildBoardVisitSchedule(300, 6)).toHaveLength(6);
    expect(buildBoardVisitSchedule(300, 1)).toHaveLength(1);
  });

  it('has nothing to visit without photographs', () => {
    expect(buildBoardVisitSchedule(180, 0)).toEqual([]);
  });

  it('always ends exactly at the session boundary', () => {
    for (const duration of [60, 180, 300]) {
      for (let images = 1; images <= 6; images++) {
        const schedule = buildBoardVisitSchedule(duration, images);
        expect(schedule[schedule.length - 1].endMs).toBe(duration * 1000);
        for (let index = 1; index < schedule.length; index++) expect(schedule[index].startMs).toBe(schedule[index - 1].endMs);
        expect(visionSceneSlotAt(schedule, duration * 1000 + 5_000)).toBe(schedule[schedule.length - 1]);
      }
    }
  });
});

describe('ending timing', () => {
  it('pulls back to the whole board, then settles on the Anchor before speaking', () => {
    const E = V2_VISUALIZE_TIMING.ending;
    expect(E.pullBackMs).toBeGreaterThanOrEqual(1800);
    expect(E.settleAtMs).toBeGreaterThan(E.pullBackMs);
    expect(E.lineAtMs).toBeGreaterThanOrEqual(E.settleAtMs + E.settleMs * 0.6);
    expect(E.continueAtMs).toBeGreaterThan(E.lineAtMs);
    const R = V2_VISUALIZE_TIMING.reducedEnding;
    expect(R.continueAtMs).toBeLessThan(E.continueAtMs);
  });

  it('keeps camera travel inside the cinematic range', () => {
    const B = V2_VISUALIZE_TIMING.board;
    expect(B.travelMinMs).toBeGreaterThanOrEqual(1200);
    expect(B.travelMaxMs).toBeLessThanOrEqual(1800);
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
