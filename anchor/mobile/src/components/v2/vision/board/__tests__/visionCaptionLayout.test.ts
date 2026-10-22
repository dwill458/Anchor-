import { CAPTION_FONT_SIZES, CAPTION_PAD, estimateCaptionLines, planCaption } from '../visionCaptionLayout';
import { BOARD_FRAME_ASPECT, selectSlotBoardLayout, slotBoardHeightRatio } from '../visionBoardLayouts';

/** On a 390pt phone the board is 374pt wide; the slot prints are 0.64, 0.34, 0.34, 0.38... of it. */
const BOARD = 374;
const margin = (printWidth: number, frame: keyof typeof BOARD_FRAME_ASPECT) => (printWidth / BOARD_FRAME_ASPECT[frame]) * 0.22;

describe('caption sizes', () => {
  it('shows short captions at 16pt, where the print is large enough, and never above 16 or below 14 on the paper margin', () => {
    expect(CAPTION_FONT_SIZES).toEqual([16, 15, 14]);
    const hero = planCaption('I actually did it.', BOARD * 0.64, margin(BOARD * 0.64, 'landscape'))!;
    expect(hero.fontSize).toBe(16); expect(hero.lines).toBe(1); expect(hero.extra).toBe(0);
  });
  it('keeps a short caption on the small prints at 14-16pt without growing the paper', () => {
    const flank = planCaption('Our first home', BOARD * 0.34, margin(BOARD * 0.34, 'square'))!;
    expect(flank.fontSize).toBeGreaterThanOrEqual(14); expect(flank.fontSize).toBeLessThanOrEqual(16);
    expect(flank.extra).toBe(0);
  });
  it('is readable at every size the board draws, including a 320pt phone', () => {
    for (const board of [296, 320, 374, 428, 520]) {
      const layout = selectSlotBoardLayout(slotBoardHeightRatio(7, true));
      for (const slot of layout.photos) {
        const width = board * slot.width, plan = planCaption('Friends who show up', width, (width / slot.aspectRatio) * 0.22);
        expect(plan).not.toBeNull(); expect(plan!.fontSize).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

describe('long captions', () => {
  const longest = 'x'.repeat(0) + 'We finally built the house with the big garden, the dog, and the long table for everyone we love.'.slice(0, 80);
  it('never truncate: every word is counted into the line estimate', () => {
    const plan = planCaption(longest, BOARD * 0.34, margin(BOARD * 0.34, 'square'))!;
    const words = longest.split(' ');
    expect(plan.lines).toBeGreaterThanOrEqual(Math.ceil(longest.length / Math.floor(plan.width / (plan.fontSize * 0.46))));
    expect(words.length).toBeGreaterThan(5);
  });
  it('grow the paper under the print by what the text needs beyond the margin, and no more', () => {
    const width = BOARD * 0.34, m = margin(width, 'square');
    const plan = planCaption(longest, width, m)!;
    expect(plan.extra).toBeGreaterThan(0);
    expect(plan.textHeight + CAPTION_PAD * 2 - m).toBeCloseTo(plan.extra, 5);
    expect(plan.fontSize).toBe(14);                       // never shrinks past 14 to hide the problem
  });
  it('a big print holds more before it grows', () => {
    const hero = planCaption(longest, BOARD * 0.64, margin(BOARD * 0.64, 'landscape'))!;
    const flank = planCaption(longest, BOARD * 0.34, margin(BOARD * 0.34, 'square'))!;
    expect(hero.extra).toBeLessThan(flank.extra);
  });
  it('handles a single word longer than a line by breaking it across lines', () => {
    expect(estimateCaptionLines('Supercalifragilisticexpialidocious', 16, 60)).toBeGreaterThan(1);
  });
});

describe('edge cases', () => {
  it('plans nothing for an empty caption or an unmeasured print', () => {
    expect(planCaption('   ', 100, 30)).toBeNull(); expect(planCaption('Hi', 0, 30)).toBeNull();
  });
  it('wraps greedily by words', () => {
    expect(estimateCaptionLines('one two three four five six', 10, 46)).toBeGreaterThanOrEqual(2);
    expect(estimateCaptionLines('', 10, 100)).toBe(0);
  });
});
