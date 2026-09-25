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

const concepts = Array.from({ length: 8 }, (_, index) => `concept ${index}`);
const plan = (overrides: Partial<Record<string, unknown>> = {}) => Array.from({ length: 8 }, (_, index) => ({
  role: `Moment ${index}`,
  purpose: `Purpose ${index}`,
  identifiedConcepts: concepts,
  covers: [concepts[index]],
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

  it('requires semantic concept coverage instead of cosmetic variations', () => {
    const description = 'My RevenueCat dashboard shows 10 thousand active users for Anchor. A recommendation on the App Store. And me working on the beach with the family.';
    const prompt = buildVisionScenePlannerPrompt({ ...input, description });
    expect(prompt).toContain('Semantic coverage and diversity contract');
    expect(prompt).toContain('every meaningful, visually depictable concept');
    expect(prompt).toContain('distribute the scenes across all of these distinct dimensions');
    expect(prompt).toContain('Never collapse the set into several cosmetic variations');
    expect(prompt).toContain('NEVER invent the user\'s physical appearance without a supplied reference image');
    expect(prompt).toContain('"purpose"');
    expect(prompt).toContain('"covers"');
  });
});

describe('parseVisionScenePlan', () => {
  it('accepts a full, varied plan and keeps its direction fields', () => {
    const parsed = parseVisionScenePlan(JSON.stringify(plan()));
    expect(parsed).toHaveLength(8);
    expect(parsed?.[2]).toEqual(expect.objectContaining({ framing: 'close', light: 'morning' }));
  });

  it('accepts plans wrapped in markdown json code blocks', () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(plan())}\n\`\`\``;
    const parsed = parseVisionScenePlan(wrapped);
    expect(parsed).toHaveLength(8);
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

  it('retains distinct semantic purposes and concept coverage', () => {
    const planned = plan();
    expect(parseVisionScenePlan(JSON.stringify(planned))?.[0]).toEqual(expect.objectContaining({
      purpose: 'Purpose 0', covers: ['concept 0'],
    }));
    expect(parseVisionScenePlan(JSON.stringify(planned.map(item => ({ ...item, purpose: 'Same purpose' }))))) .toBeNull();
  });
});

describe('isStoredVisionScenePlan', () => {
  it('replays plans saved before direction fields existed', () => {
    expect(isStoredVisionScenePlan(Array.from({ length: 8 }, (_, i) => ({ role: `r${i}`, scene: `s${i}` })))).toBe(true);
    expect(isStoredVisionScenePlan(null)).toBe(false);
  });
});

describe('buildVisionImagePrompt', () => {
  it('builds each image focused strictly on its planned scene and isolates against prompt contamination', () => {
    const scene = parseVisionScenePlan(JSON.stringify(plan()))![3];
    const prompt = buildVisionImagePrompt({ ...input, scene, plannedScenes: plan() });
    expect(prompt).toContain(JSON.stringify(scene.scene));
    expect(prompt).toContain('Detail frame');
    expect(prompt).toContain('No readable text');
    expect(prompt).toContain('documentary / editorial photography');
    expect(prompt).toContain('No appearance reference exists');
    expect(prompt).toContain('Focus exclusively on depicting this specific moment and setting');
    // Crucial: it must NOT contain the full description labeled as highest visual specificity
    expect(prompt).not.toContain('highest visual specificity');
    // Crucial: it must NOT dump all other scenes with avoid
    expect(prompt).not.toContain('Other distinct moments already planned');
  });

  it('isolates multi-concept prompt so scenes do not contaminate each other', () => {
    const multiDescription = 'My RevenueCat dashboard shows 10 thousand active users for Anchor. A recommendation on the App Store. And me working on the beach with the family.';
    const sceneRevenueCat = {
      role: 'Business metrics',
      purpose: 'Product milestone achievement',
      scene: 'A modern tablet resting on a clean walnut desk showing an analytics chart climbing steeply in morning window light.',
      framing: 'close' as const,
      setting: 'Sunlit home workspace',
      feeling: 'quiet triumph',
    };
    const sceneAppStore = {
      role: 'Store recognition',
      purpose: 'External editorial recommendation',
      scene: 'A smartphone screen propped next to a ceramic coffee mug showing an editorial app feature highlight card.',
      framing: 'detail' as const,
      setting: 'Architectural studio café',
      feeling: 'gratitude',
    };
    const sceneBeach = {
      role: 'Family freedom',
      purpose: 'Remote lifestyle outcome with family',
      scene: 'Bare feet in warm ocean sand with young children laughing in the background near a canvas umbrella.',
      framing: 'wide' as const,
      setting: 'Coastal shoreline late afternoon',
      feeling: 'peace and abundance',
    };

    const prompt1 = buildVisionImagePrompt({ intention: 'Anchor has 10k users', category: 'desire', description: multiDescription, scene: sceneRevenueCat });
    const prompt2 = buildVisionImagePrompt({ intention: 'Anchor has 10k users', category: 'desire', description: multiDescription, scene: sceneAppStore });
    const prompt3 = buildVisionImagePrompt({ intention: 'Anchor has 10k users', category: 'desire', description: multiDescription, scene: sceneBeach });

    // Scene 1 focus
    expect(prompt1).toContain(JSON.stringify(sceneRevenueCat.scene));
    expect(prompt1).not.toContain('beach');
    expect(prompt1).not.toContain('App Store');

    // Scene 2 focus
    expect(prompt2).toContain(JSON.stringify(sceneAppStore.scene));
    expect(prompt2).not.toContain('beach');
    expect(prompt2).not.toContain('RevenueCat');

    // Scene 3 focus
    expect(prompt3).toContain(JSON.stringify(sceneBeach.scene));
    expect(prompt3).not.toContain('RevenueCat');
    expect(prompt3).not.toContain('App Store');
  });
});

