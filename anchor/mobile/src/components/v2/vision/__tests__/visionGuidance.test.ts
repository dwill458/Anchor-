import { visionDescriptionExample, visionDetailHint, visionDetailLevel } from '../visionGuidance';
import { visionGenerationProgress } from '../visionGenerationProgress';

describe('visionDetailHint', () => {
  it('is guidance, never a score', () => {
    expect(visionDetailHint('')).toBeNull();
    expect(visionDetailHint(Array(23).fill('word').join(' '))).toBe('23 words · Add a little more detail for stronger images');
    expect(visionDetailLevel(Array(30).fill('word').join(' '))).toBe('building');
    expect(visionDetailHint(Array(67).fill('word').join(' '))).toBe('67 words · Great detail');
  });
});

describe('visionDescriptionExample', () => {
  it('prefers the intention over the category', () => {
    expect(visionDescriptionExample('Anchor has ten thousand users', 'desire')).toMatch(/people using what I built/);
    expect(visionDescriptionExample('Run a marathon', 'custom')).toMatch(/run the loop/);
  });

  it('falls back to the category, then a neutral example', () => {
    expect(visionDescriptionExample('Be calm', 'spirituality')).toMatch(/quiet/);
    expect(visionDescriptionExample(undefined, 'unknown')).toMatch(/name the room, the light/);
  });

  it('reads "run for" as public life, not running', () => {
    expect(visionDescriptionExample('Run for president', 'career')).toMatch(/community hall/);
    expect(visionDescriptionExample('Run for president', 'career')).not.toMatch(/run the loop/);
  });
});

describe('visionGenerationProgress', () => {
  const job = (overrides: object) => ({
    id: 'job', visionId: 'v', anchorId: 'a', setNumber: 1, retryCount: 0, error: null, candidates: [], ...overrides,
  }) as any;

  it('uses one experiential status line, never a progress checklist', () => {
    const queued = visionGenerationProgress(job({ status: 'QUEUED', stage: 'planning' }));
    expect(queued.phase).toBe('forming');
    expect(queued.title).toBe('Finding the first moment…');
    expect(visionGenerationProgress(job({ status: 'RUNNING', stage: 'creating_images' })).phase).toBe('forming');
    const partial = visionGenerationProgress(job({ status: 'PARTIAL', stage: 'creating_images', candidates: [{}, {}, {}] }));
    expect(partial.phase).toBe('revealing');
    expect(partial.title).toBe('Finding another moment…');
    expect(visionGenerationProgress(job({ status: 'COMPLETE', stage: 'complete', candidates: Array(8).fill({}) })).title)
      .toBe('Your Vision is ready.');
  });

  it('holds the ready copy until the cinematic presentation has settled', () => {
    const complete = job({ status: 'COMPLETE', stage: 'complete', candidates: Array(8).fill({}) });
    expect(visionGenerationProgress(complete, false).title).toBe('Bringing your future into focus…');
    expect(visionGenerationProgress(complete, true).title).toBe('Your Vision is ready.');
  });

  it('never completes a paused set', () => {
    const failed = job({ status: 'FAILED', stage: 'failed', candidates: Array(5).fill({}) });
    expect(visionGenerationProgress(failed).phase).toBe('failed');
    expect(visionGenerationProgress(failed).title).toBe('Your Vision paused.');
  });
});
