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

  it('follows the job, not a timer', () => {
    expect(visionGenerationProgress(job({ status: 'QUEUED', stage: 'planning' })).phase).toBe('reading');
    expect(visionGenerationProgress(job({ status: 'RUNNING', stage: 'planning' })).steps.map(step => step.state))
      .toEqual(['done', 'active', 'pending', 'pending']);
    expect(visionGenerationProgress(job({ status: 'RUNNING', stage: 'creating_images' })).phase).toBe('building');
    const partial = visionGenerationProgress(job({ status: 'PARTIAL', stage: 'creating_images', candidates: [{}, {}, {}] }));
    expect(partial.phase).toBe('shaping');
    expect(partial.detail).toBe('3 of 8 images ready');
    expect(visionGenerationProgress(job({ status: 'COMPLETE', stage: 'complete', candidates: Array(8).fill({}) })).steps
      .every(step => step.state === 'done')).toBe(true);
  });

  it('is only "Almost ready" once every image exists, and done once it has been shown', () => {
    const seven = job({ status: 'PARTIAL', stage: 'creating_images', candidates: Array(7).fill({}) });
    expect(visionGenerationProgress(seven).steps.map(step => step.state)).toEqual(['done', 'done', 'active', 'pending']);
    const complete = job({ status: 'COMPLETE', stage: 'complete', candidates: Array(8).fill({}) });
    expect(visionGenerationProgress(complete, false).steps.map(step => step.state)).toEqual(['done', 'done', 'done', 'active']);
    expect(visionGenerationProgress(complete, true).steps[3].state).toBe('done');
  });

  it('never completes a paused set', () => {
    const failed = job({ status: 'FAILED', stage: 'failed', candidates: Array(5).fill({}) });
    const states = visionGenerationProgress(failed).steps.map(step => step.state);
    expect(states).toEqual(['done', 'done', 'pending', 'pending']);
  });
});
