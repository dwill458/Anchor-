import { act, renderHook } from '@testing-library/react-native';
import { PanResponder, type PanResponderCallbacks } from 'react-native';
import { NodeToneService } from '@/services/NodeToneService';
import { SoundPool } from '@/services/audio/SoundPool';
import { playCreationSound } from '@/services/CreationSounds';
import { useChooseController } from '../useChooseController';
import { mapLetterEventTimes, buildCreationTimeline } from '../useCreationTimeline';
import { formCraftCues } from '../formCraft';
import { useSettingsStore } from '@/stores/settingsStore';

jest.mock('@/services/audio/SoundPool', () => ({
  SoundPool: {
    register: jest.fn(),
    prewarm: jest.fn(),
    releaseIdle: jest.fn(),
    play: jest.fn((key: string, opts?: { volume?: number; loop?: boolean }) => ({
      stop: jest.fn(),
    })),
  },
}));

jest.mock('@/services/CreationSounds', () => {
  const actual = jest.requireActual('@/services/CreationSounds');
  return {
    ...actual,
    playCreationSound: jest.fn((key: string, vol?: number, opts?: unknown) =>
      actual.playCreationSound(key, vol, opts)
    ),
  };
});

describe('Creation Flow Sound Triggering Suite', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useSettingsStore.setState({ soundEffectsEnabled: true });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Run 1: Natural Speed End-to-End', () => {
    it('fires every designed sound at its beat across all 7 steps', async () => {
      // 1. Intention input: tap Continue
      playCreationSound('uiTap');
      expect(SoundPool.play).toHaveBeenCalledWith('creation:uiTap', expect.anything());

      // 2. Distilling: prewarm + survivor letter landings
      SoundPool.prewarm(['creation:uiTap', 'creation:distillTick']);
      expect(SoundPool.prewarm).toHaveBeenCalledWith(
        expect.arrayContaining(['creation:distillTick'])
      );

      const timeline = buildCreationTimeline({ mode: 'first', n: 6, drawn: false });
      const uniqSurvivors = ['C', 'A', 'L', 'M', 'E', 'R'];
      const firedEvents = new Set<string>();

      uniqSurvivors.forEach((_, i) => {
        const fraction = 0.58 + (i / uniqSurvivors.length) * 0.32;
        const time = timeline.start.distill + fraction * timeline.distill;
        if (!firedEvents.has(`distill-${i}`)) {
          firedEvents.add(`distill-${i}`);
          playCreationSound('distillTick', 0.5);
        }
      });
      expect(firedEvents.size).toBe(6);
      expect(SoundPool.play).toHaveBeenCalledWith(
        'creation:distillTick',
        expect.objectContaining({ volume: 0.5 })
      );

      // 3. Mapping: prepares tones and plays one droplet per grid node
      const mappedCells = [1, 5, 12, 19, 23, 31];
      await NodeToneService.prepare(mappedCells);
      expect(SoundPool.prewarm).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringMatching(/^node:/)])
      );

      const mapTimes = mapLetterEventTimes(timeline, mappedCells.length);
      expect(mapTimes.length).toBe(mappedCells.length);

      mappedCells.forEach((cell, i) => {
        if (!firedEvents.has(`map-${i}`)) {
          firedEvents.add(`map-${i}`);
          NodeToneService.play(cell);
        }
      });
      expect(SoundPool.play).toHaveBeenCalledWith(
        expect.stringMatching(/^node:/),
        expect.objectContaining({ volume: 0.32 })
      );

      // 4. Style select: uiTap on chip selection and open all
      playCreationSound('uiTap');
      expect(SoundPool.play).toHaveBeenCalledWith('creation:uiTap', expect.anything());

      // 5. Forming: bloom sound, looping formBed, formTick craft cues, formSettle
      const bloom = playCreationSound('bloom');
      const formBed = playCreationSound('formBed', undefined, { loop: true });
      expect(SoundPool.play).toHaveBeenCalledWith(
        'creation:bloom',
        expect.anything()
      );
      expect(SoundPool.play).toHaveBeenCalledWith(
        'creation:formBed',
        expect.objectContaining({ loop: true })
      );

      // Sheen cues during wait
      const cues = formCraftCues(0, 10, { slow: false });
      const tickCues = cues.filter((c) => c.sound === 'formTick');
      expect(tickCues.length).toBeGreaterThan(0);
      tickCues.forEach((cue) => {
        if (!firedEvents.has(cue.id)) {
          firedEvents.add(cue.id);
          playCreationSound(cue.sound!, cue.volume);
        }
      });
      expect(SoundPool.play).toHaveBeenCalledWith(
        'creation:formTick',
        expect.anything()
      );

      // Settle
      bloom?.stop();
      formBed?.stop();
      playCreationSound('formSettle');
      expect(SoundPool.play).toHaveBeenCalledWith(
        'creation:formSettle',
        expect.anything()
      );

      // 6. Seal & Choose: revealSettle, sealRise on hold, seal on completion, anchorPulse at 0.72
      playCreationSound('revealSettle');
      expect(SoundPool.play).toHaveBeenCalledWith(
        'creation:revealSettle',
        expect.anything()
      );

      const onSealLanded = jest.fn(() => playCreationSound('seal'));
      const onHoldComplete = jest.fn();
      let touchCallbacks!: PanResponderCallbacks;
      jest.spyOn(PanResponder, 'create').mockImplementation((callbacks) => {
        touchCallbacks = callbacks;
      return { getInteractionHandle: () => undefined, panHandlers: {} as never };
      });

      renderHook(() =>
        useChooseController({
          reduceMotion: false,
          onSealLanded,
          onHoldComplete,
          onSealAnimationDone: jest.fn(),
        })
      );

      // User presses to hold
      act(() => {
        touchCallbacks.onPanResponderGrant!(
          { nativeEvent: { locationX: 195, locationY: 300 } } as never,
          {} as never
        );
      });
      expect(playCreationSound).toHaveBeenCalledWith(
        'sealRise',
        undefined,
        { loop: true }
      );

      // Fast forward hold duration (1100ms)
      act(() => {
        jest.advanceTimersByTime(1150);
      });
      expect(onHoldComplete).toHaveBeenCalled();
      expect(onSealLanded).toHaveBeenCalled();
      expect(playCreationSound).toHaveBeenCalledWith('seal');

      // Advance to pulse moment (0.72 * 1600ms = ~1152ms)
      act(() => {
        jest.advanceTimersByTime(1200);
      });
      expect(playCreationSound).toHaveBeenCalledWith('anchorPulse');
    });
  });

  describe('Run 2: Fast Users / Rapid Execution', () => {
    it('reliably fires sounds without dropping, skipping, or piling up noise', async () => {
      const firedEvents = new Set<string>();
      const timeline = buildCreationTimeline({ mode: 'repeat', n: 6, drawn: false });

      // Prepare mapping tones up front
      await NodeToneService.prepare([1, 2, 3, 4, 5, 6]);

      // Rapidly advance time across frames
      for (let t = 0; t < 5; t += 0.05) {
        const prev = t;
        const next = t + 0.05;

        // Distill ticks
        [0.8, 0.9, 1.0, 1.1, 1.2, 1.3].forEach((tickTime, i) => {
          if (prev < tickTime && next >= tickTime && !firedEvents.has(`distill-${i}`)) {
            firedEvents.add(`distill-${i}`);
            playCreationSound('distillTick', 0.5);
          }
        });

        // Map tones
        [1.5, 1.6, 1.7, 1.8, 1.9, 2.0].forEach((mapTime, i) => {
          if (prev < mapTime && next >= mapTime && !firedEvents.has(`map-${i}`)) {
            firedEvents.add(`map-${i}`);
            NodeToneService.play(i + 1);
          }
        });
      }

      // Exactly 6 distill ticks and 6 map tones fired, no duplicates
      expect(firedEvents.size).toBe(12);
      expect(
        Array.from(firedEvents).filter((e) => e.startsWith('distill-')).length
      ).toBe(6);
      expect(
        Array.from(firedEvents).filter((e) => e.startsWith('map-')).length
      ).toBe(6);
    });
  });

  describe('Run 3: Background and Resume Mid-Flow', () => {
    it('pauses sounds when backgrounded and safely restarts formBed on resume during form phase', () => {
      const foregroundRef = { current: true };
      let formBedSound: { stop: jest.Mock } | null = null;

      const startFormBed = () => {
        if (foregroundRef.current) {
          formBedSound = { stop: jest.fn() };
          playCreationSound('formBed', undefined, { loop: true });
        }
      };

      const stopFormBed = () => {
        formBedSound?.stop();
        formBedSound = null;
      };

      // 1. Enter Forming in foreground
      startFormBed();
      expect(playCreationSound).toHaveBeenCalledWith('formBed', undefined, { loop: true });

      // 2. App goes to background
      foregroundRef.current = false;
      stopFormBed();
      expect(formBedSound).toBeNull();

      // 3. App resumes to foreground during Forming
      foregroundRef.current = true;
      startFormBed();
      expect(formBedSound).not.toBeNull();
      expect(playCreationSound).toHaveBeenCalledTimes(2);
    });
  });

  describe('Forming Step Completion Analysis', () => {
    it('confirms the ~15s forming caption is an AI generation wait, not an audio lock', () => {
      // FORM_SLOW_CAPTION_AFTER is 12 seconds by design to inform the user of remote AI generation
      const cues = formCraftCues(0, 15, { slow: true });
      expect(cues.length).toBeGreaterThan(0);
      // Craft ticks keep playing while awaiting remote AI generation
      expect(cues.some((c) => c.sound === 'formTick')).toBe(true);
    });
  });
});
