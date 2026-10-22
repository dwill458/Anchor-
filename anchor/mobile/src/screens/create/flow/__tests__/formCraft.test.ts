import { formCraftCues, type FormCue } from '../formCraft';
import { FORM_SLOW_CAPTION_AFTER } from '../creationFlowConfig';
import { FORM_REVEAL_SECONDS, FORM_TIMING } from '../scenes/FormScene';

describe('formCraftCues', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); });
  afterEach(() => { jest.useRealTimers(); });

  it('crosses each real one-shot once on a fake clock, including stationary frames', () => {
    let prev = 0;
    const cues: FormCue[] = [];
    const sample = () => {
      const tf = Date.now() / 1000;
      cues.push(...formCraftCues(prev, tf, { slow: tf >= FORM_SLOW_CAPTION_AFTER }));
      prev = tf;
    };
    jest.advanceTimersByTime(450); sample(); sample();
    jest.advanceTimersByTime(2700); sample(); sample();
    expect(cues).toEqual([
      { id: 'pen-start', haptic: 'light' },
      { id: 'material-arrived', haptic: 'medium' },
    ]);
  });

  it('lands normal passes at reveal + n × 2.6 seconds', () => {
    for (let n = 1; n <= 3; n += 1) {
      const at = FORM_REVEAL_SECONDS + n * FORM_TIMING.sheenPeriod;
      expect(formCraftCues(at - 0.001, at, { slow: false })).toEqual([
        { id: `sheen-${n}`, haptic: 'light', sound: 'formTick', volume: 0.30 },
      ]);
      expect(formCraftCues(at, at + 0.001, { slow: false })).toEqual([]);
    }
  });

  it('stretches the remaining passes to 3.9 seconds after 12, with alternate haptics', () => {
    const lastNormal = FORM_REVEAL_SECONDS + 3 * FORM_TIMING.sheenPeriod;
    const firstSlow = lastNormal + FORM_TIMING.sheenPeriod * 1.5;
    expect(formCraftCues(12, firstSlow - 0.001, { slow: true })).toEqual([]);
    expect(formCraftCues(firstSlow - 0.001, firstSlow, { slow: true })).toEqual([
      { id: 'slow-sheen-1', haptic: 'light', sound: 'formTick', volume: 0.21 },
    ]);
    const secondSlow = firstSlow + FORM_TIMING.sheenPeriod * 1.5;
    expect(formCraftCues(firstSlow, secondSlow, { slow: true })).toEqual([
      { id: 'slow-sheen-2', sound: 'formTick', volume: 0.21 },
    ]);
  });

  it('does not fire on paused or backwards time', () => {
    expect(formCraftCues(20, 20, { slow: true })).toEqual([]);
    expect(formCraftCues(20, 0, { slow: false })).toEqual([]);
  });

  it('retains crossings across the slow threshold and restarts after a retry reset', () => {
    const fired = new Set<string>();
    const play = jest.fn();
    const sample = (prev: number, tf: number) => {
      formCraftCues(prev, tf, { slow: tf >= 12 }).forEach((cue) => {
        if (fired.has(cue.id)) return;
        fired.add(cue.id); play(cue);
      });
    };
    sample(0, 12.1); sample(0, 12.1);
    expect(play).toHaveBeenCalledTimes(5);
    fired.clear(); sample(0, 12.1);
    expect(play).toHaveBeenCalledTimes(10);
  });
});
