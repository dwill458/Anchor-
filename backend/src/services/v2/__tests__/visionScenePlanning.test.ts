import {
  buildVisionImagePrompt,
  buildVisionScenePlannerPrompt,
  isStoredVisionScenePlan,
  parseVisionScenePlan,
} from '../visionScenePlanning';

const input = {
  intention: 'Anchor has ten thousand users',
  category: 'desire',
  description: 'My RevenueCat dashboard shows ten thousand active users for Anchor.',
};

const plan = (overrides: Partial<Record<string, unknown>> = {}) => Array.from({ length: 8 }, (_, index) => ({
  role: `Moment ${index}`,
  moment: `moment ${index}`,
  setting: `setting ${index}`,
  framing: ['wide', 'medium', 'close', 'detail'][index % 4],
  composition: 'off-centre',
  light: 'morning',
  feeling: 'ease',
  scene: `A distinct scene number ${index}.`,
  ...overrides,
}));

describe('buildVisionScenePlannerPrompt', () => {
  it('asks for varied moments, not eight renders of the description', () => {
    const prompt = buildVisionScenePlannerPrompt(input);
    expect(prompt).toContain('never legible');
    expect(prompt).toContain('recognisably part of THIS Vision');
    expect(prompt).toContain('Mix camera distance');
    expect(prompt).toContain(JSON.stringify(input.description));
    expect(prompt).not.toContain('already seen');
  });

  it('names earlier scenes so another set is genuinely different', () => {
    const prompt = buildVisionScenePlannerPrompt({ ...input, avoidScenes: ['Founder at a desk looking at a dashboard.'] });
    expect(prompt).toContain('already seen');
    expect(prompt).toContain('- Founder at a desk looking at a dashboard.');
  });
});

describe('parseVisionScenePlan', () => {
  it('accepts a full, varied plan and keeps its direction fields', () => {
    const parsed = parseVisionScenePlan(JSON.stringify(plan()));
    expect(parsed).toHaveLength(8);
    expect(parsed?.[2]).toEqual(expect.objectContaining({ framing: 'close', light: 'morning' }));
  });

  it('rejects malformed, short or duplicated plans', () => {
    expect(parseVisionScenePlan('not json')).toBeNull();
    expect(parseVisionScenePlan(JSON.stringify(plan().slice(0, 7)))).toBeNull();
    expect(parseVisionScenePlan(JSON.stringify(plan({ scene: 'Same scene.' })))).toBeNull();
    expect(parseVisionScenePlan(JSON.stringify(plan({ role: '' })))).toBeNull();
  });

  it('drops an unknown framing rather than failing the plan', () => {
    expect(parseVisionScenePlan(JSON.stringify(plan({ framing: 'fisheye' })))?.[0].framing).toBeUndefined();
  });
});

describe('isStoredVisionScenePlan', () => {
  it('replays plans saved before direction fields existed', () => {
    expect(isStoredVisionScenePlan(Array.from({ length: 8 }, (_, i) => ({ role: `r${i}`, scene: `s${i}` })))).toBe(true);
    expect(isStoredVisionScenePlan(null)).toBe(false);
  });
});

describe('buildVisionImagePrompt', () => {
  it('builds each image from its own shot and keeps text out of the frame', () => {
    const scene = parseVisionScenePlan(JSON.stringify(plan()))![3];
    const prompt = buildVisionImagePrompt({ ...input, scene });
    expect(prompt).toContain(JSON.stringify(scene.scene));
    expect(prompt).toContain('Detail frame');
    expect(prompt).toContain('No readable text');
    expect(prompt).toContain('documentary / editorial photography');
  });
});
