import { loadBeatMap, silenceSpans, SILENCE_LONG_MS, v2VisualizeDurationLabel, type GuideId, type GuidedDurationSeconds } from '../guided/visualizeBeatMap';
import { buildGuidedPlan, GUIDED_COMPRESSION_MS, GUIDED_LEAD_MS, resolveGuidedState, TRACK_PLANS } from '../guided/visualizeGuidedPlan';
import { captionFor } from '../guided/visualizeCaptions';
import { cinematicBreathAt, cinematicGradeAt } from '../guided/cinematicGrade';

const DURATIONS: GuidedDurationSeconds[] = [60, 180, 600];
const GUIDES: GuideId[] = ['dominic', 'lina'];

describe('guided plan', () => {
  it.each(DURATIONS)('includes every photo in equal slots for %s seconds, including beyond six', durationSeconds => {
    for (const imageCount of [1, 6, 9, 40]) {
      const plan = buildGuidedPlan({ durationSeconds, guide: 'dominic', imageCount });
      expect(plan.imageCount).toBe(imageCount);
      expect(plan.timeline.lightReturnMs).toBeGreaterThanOrEqual(plan.beatMap.phrases.at(-1)!.endMs);
      expect(plan.timeline.lightReturnMs! + 2000).toBe(plan.durationMs);
      const holds = plan.timeline.segments.filter(s => s.kind === 'immersion');
      expect(holds.map(s => s.imageIndex)).toEqual(Array.from({ length: imageCount }, (_, i) => i));
      const slots = plan.timeline.photoSlots!;
      expect(slots).toHaveLength(imageCount);
      const spans = slots.map(s => s.endMs - s.startMs);
      expect(Math.max(...spans) - Math.min(...spans)).toBeLessThanOrEqual(1);
      expect(slots.at(-1)!.endMs).toBe(plan.anchorStartMs);
    }
  });
  it.each(DURATIONS.flatMap(d => GUIDES.map(g => [d, g] as const)))('builds a contiguous timeline for %s s / %s', (durationSeconds, guide) => {
    for (let imageCount = 1; imageCount <= 6; imageCount += 1) {
      const plan = buildGuidedPlan({ durationSeconds, guide, imageCount });
      const { segments } = plan.timeline;
      expect(segments[0]).toMatchObject({ kind: 'arrival', startMs: 0 });
      expect(segments.at(-1)).toMatchObject({ kind: 'boardHold', endMs: plan.durationMs });
      for (let index = 1; index < segments.length; index += 1) {
        expect(segments[index].startMs).toBe(segments[index - 1].endMs);
        expect(segments[index].endMs).toBeGreaterThanOrEqual(segments[index].startMs);
      }
      const images = segments.filter(s => s.kind === 'immersion').map(s => s.imageIndex);
      expect(images).toEqual(Array.from({ length: plan.imageCount }, (_, i) => i));
      expect(plan.imageCount).toBe(imageCount);
      expect(segments.filter(s => s.kind === 'transition')).toHaveLength(plan.imageCount - 1);
    }
  });

  it('is polished with a single Vision image: no transitions, still reaches the Anchor payoff', () => {
    for (const durationSeconds of DURATIONS) {
      const plan = buildGuidedPlan({ durationSeconds, guide: 'lina', imageCount: 1 });
      expect(plan.timeline.segments.some(s => s.kind === 'transition')).toBe(false);
      expect(plan.timeline.segments.some(s => s.kind === 'recognition')).toBe(true);
    }
  });

  it('leads the Anchor chapter by the chapter lead and clamps at zero', () => {
    const plan = buildGuidedPlan({ durationSeconds: 60, guide: 'dominic', imageCount: 2 });
    const first = plan.beatMap.phrases.find(p => p.chapter === 'ANCHOR')!;
    expect(plan.anchorStartMs).toBe(first.startMs - GUIDED_LEAD_MS);
    expect(plan.timeline.segments.find(s => s.kind === 'compression')).toMatchObject({ startMs: plan.anchorStartMs });
    expect(plan.sealAtMs).toBe(plan.anchorStartMs + GUIDED_COMPRESSION_MS);
    expect(Math.min(...plan.timeline.grade!.map(k => k.atMs))).toBeGreaterThanOrEqual(0);
  });

  it('uses fewer image changes per minute as the track lengthens', () => {
    const rate = (durationSeconds: GuidedDurationSeconds) => {
      const plan = buildGuidedPlan({ durationSeconds, guide: 'dominic', imageCount: 6 });
      return (plan.imageCount - 1) / (plan.durationMs / 60_000);
    };
    expect(rate(600)).toBeLessThan(rate(180));
    expect(rate(180)).toBeLessThan(rate(60) + 1.5);
    const embody = buildGuidedPlan({ durationSeconds: 600, guide: 'dominic', imageCount: 6 });
    const firstHold = embody.timeline.segments.find(s => s.kind === 'immersion')!;
    expect(firstHold.endMs - firstHold.startMs).toBeGreaterThan(60_000);
  });

  it('finishes every positional motion before the next long silence begins', () => {
    for (const durationSeconds of DURATIONS) for (const guide of GUIDES) {
      const plan = buildGuidedPlan({ durationSeconds, guide, imageCount: 4 });
      const longs = silenceSpans(plan.beatMap).filter(s => s.durationMs >= SILENCE_LONG_MS);
      const motion = plan.timeline.segments.filter(s => s.kind === 'breakout');
      for (const move of motion) for (const silence of longs) {
        if (silence.startMs > move.startMs + 1500) expect(move.endMs).toBeLessThanOrEqual(silence.startMs);
      }
    }
  });

  it('breathes only inside long silences', () => {
    const plan = buildGuidedPlan({ durationSeconds: 600, guide: 'dominic', imageCount: 3 });
    const longs = silenceSpans(plan.beatMap).filter(s => s.durationMs >= SILENCE_LONG_MS);
    expect(plan.timeline.stillness!.length).toBeGreaterThan(5);
    for (const span of plan.timeline.stillness!) expect(longs.some(s => span.startMs >= s.startMs && span.endMs <= s.endMs)).toBe(true);
    const sample = plan.timeline.stillness![0];
    const mid = (sample.startMs + sample.endMs) / 2;
    expect(cinematicBreathAt(plan.timeline, mid)).toBeGreaterThanOrEqual(0);
    expect(cinematicBreathAt(plan.timeline, sample.startMs - 1)).toBe(0);
    const speech = plan.beatMap.phrases[10];
    expect(cinematicBreathAt(plan.timeline, speech.startMs + 100)).toBe(0);
  });

  it('shows the current spoken phrase in every chapter for both guides without overlapping the next caption', () => {
    for (const durationSeconds of DURATIONS) for (const guide of GUIDES) {
      const plan = buildGuidedPlan({ durationSeconds, guide, imageCount: 2 });
      expect([...new Set(plan.captions.map(caption => caption.phraseId))]).toEqual(plan.beatMap.phrases.map(phrase => phrase.id));
      const words = (text: string) => text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g);
      for (const phrase of plan.beatMap.phrases) {
        const spoken = plan.captions.filter(caption => caption.phraseId === phrase.id).map(caption => caption.text).join(' ');
        expect(words(spoken)).toEqual(words(phrase.text));
      }
      for (const [index, caption] of plan.captions.entries()) {
        expect(resolveGuidedState(plan, caption.startMs + 100).caption?.phraseId).toBe(caption.phraseId);
        const next = plan.captions[index + 1];
        if (next) expect(caption.endMs).toBeLessThanOrEqual(next.startMs);
      }
    }
  });

  it('keeps the repaired Serene sentence together after the long hold', () => {
    const plan = buildGuidedPlan({ durationSeconds: 600, guide: 'lina', imageCount: 2 });
    const parts = plan.captions.filter(caption => caption.phraseId === 31);
    expect(parts).toHaveLength(1);
    expect(resolveGuidedState(plan, 380_000).caption).toBeNull();
    expect(parts[0].startMs).toBeGreaterThan(385_900);
    expect(parts[0].text).toBe('The feeling of knowing who you are, and moving accordingly.');
  });

  it('derives the same state for the same audio position regardless of how it was reached', () => {
    const plan = buildGuidedPlan({ durationSeconds: 180, guide: 'dominic', imageCount: 3 });
    const sequential = [10_000, 70_000, 71_000].map(ms => resolveGuidedState(plan, ms));
    expect(resolveGuidedState(plan, 71_000)).toEqual(sequential[2]);
    expect(resolveGuidedState(plan, -50).segmentKind).toBe('arrival');
    expect(resolveGuidedState(plan, plan.durationMs + 5000).segmentKind).toBe('boardHold');
  });

  it('classifies silences from the map and grades are clear at the Anchor payoff', () => {
    const plan = buildGuidedPlan({ durationSeconds: 600, guide: 'dominic', imageCount: 3 });
    const phrase = plan.beatMap.phrases[8];
    expect(resolveGuidedState(plan, phrase.endMs + 2000).silence).toBe('long');
    const grade = cinematicGradeAt(plan.timeline, plan.sealAtMs);
    expect(grade).toEqual({ dim: 0, warm: 0, soften: 0, watermark: 0 });
  });
});

describe('beat maps', () => {
  it.each([
    [60, '1:05', '1 minute 5 seconds'],
    [180, '3:20', '3 minutes 20 seconds'],
    [600, '10:15', '10 minutes 15 seconds'],
  ] as const)('shows the actual recording length for nominal %s second sessions', (duration, label, accessible) => {
    expect(v2VisualizeDurationLabel(duration)).toBe(label);
    expect(v2VisualizeDurationLabel(duration, true)).toBe(accessible);
  });

  it('keeps each Glimpse guide on the duration of that guide recording', () => {
    expect(loadBeatMap('glimpse', 'dominic').durationMs).toBe(65_245);
    expect(loadBeatMap('glimpse', 'lina').durationMs).toBe(65_120);
    expect(loadBeatMap('immerse', 'dominic').durationMs).toBe(200_000);
    expect(loadBeatMap('immerse', 'lina').durationMs).toBe(200_000);
  });

  it('keeps every spoken phrase inside the recording with nonoverlapping caption times', () => {
    for (const track of ['glimpse', 'immerse', 'embody'] as const) for (const guide of GUIDES) {
      const map = loadBeatMap(track, guide);
      for (const [index, phrase] of map.phrases.entries()) {
        expect(phrase.startMs).toBeGreaterThanOrEqual(0);
        expect(phrase.endMs).toBeGreaterThan(phrase.startMs);
        expect(phrase.endMs).toBeLessThanOrEqual(map.phrases[index + 1]?.startMs ?? map.durationMs);
      }
    }
  });
  it.each(['glimpse', 'immerse', 'embody'] as const)('%s guides share phrase ids and every id the plans reference exists', track => {
    const a = loadBeatMap(track, 'dominic'), b = loadBeatMap(track, 'lina');
    expect(a.phrases.map(p => p.id)).toEqual(b.phrases.map(p => p.id));
    const plan = TRACK_PLANS[track];
    const ids = [plan.anchorPhraseId, plan.returnPhraseId, ...plan.grade.map(s => s.phraseId),
      ...(plan.arrival.untilPhraseId === undefined ? [] : [plan.arrival.untilPhraseId])];
    for (const id of ids) expect(a.phrases.some(p => p.id === id)).toBe(true);
  });
});

describe('captions', () => {
  it('restores written language for every narrated phrase', () => {
    for (const track of ['glimpse', 'immerse', 'embody'] as const) for (const guide of GUIDES) {
      for (const phrase of loadBeatMap(track, guide).phrases) {
        const text = captionFor(phrase.text);
        expect(text).not.toBeNull();
        expect(text).toMatch(/[.?!]$/);
        expect(text).not.toMatch(/\b(dont|youre|isnt|doesnt|youve|wouldnt|whats)\b/i);
      }
    }
  });
  it('declines text it cannot restore rather than showing it broken', () => {
    expect(captionFor('')).toBeNull();
    expect(captionFor('x'.repeat(200))).toBeNull();
    expect(captionFor('Whats ahead')).toBe('What’s ahead?');
  });
});
