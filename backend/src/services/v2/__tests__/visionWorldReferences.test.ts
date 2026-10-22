import { selectWorldReferenceScenes, VISION_WORLD_REFERENCE_MAX, type WorldReferenceScene } from '../visionWorldReferences';
import { orderVisionReferences, visionReferenceInstructions } from '../../image/visionReferences';
import { buildVisionImagePrompt, buildVisionSceneVariantPlan } from '../visionScenePlanning';

const scene = (id: string, sourceType: string, sortOrder: number, day: number, withAsset = true): WorldReferenceScene => ({
  id, sourceType, sortOrder, createdAt: new Date(2026, 8, day), asset: withAsset ? { storageKey: `k/${id}`, mimeType: 'image/jpeg' } : null,
});

describe('selecting the Vision photographs that carry the world forward', () => {
  it('attaches only the person\'s own photographs, never generated board images', () => {
    const picked = selectWorldReferenceScenes([
      scene('gen-hero', 'AI_GENERATED', 0, 1), scene('mine', 'USER_UPLOAD', 1, 2), scene('gen-new', 'AI_GENERATED', 2, 9),
    ], VISION_WORLD_REFERENCE_MAX, ['mine']);
    expect(picked.map(item => item.id)).toEqual(['mine']);
    expect(selectWorldReferenceScenes([scene('gym', 'AI_GENERATED', 0, 1), scene('gym2', 'AI_GENERATED', 1, 2)])).toEqual([]);
  });

  it('treats a camera photo as the person\'s own', () => {
    expect(selectWorldReferenceScenes([scene('gen', 'AI_GENERATED', 0, 1), scene('cam', 'USER_CAMERA', 1, 2)], VISION_WORLD_REFERENCE_MAX, ['cam']).map(item => item.id)).toEqual(['cam']);
  });

  it('prefers the hero among personal photos, then the most recently added', () => {
    const picked = selectWorldReferenceScenes([
      scene('old', 'USER_UPLOAD', 3, 1), scene('hero', 'USER_UPLOAD', 0, 2), scene('new', 'USER_CAMERA', 4, 8),
    ], VISION_WORLD_REFERENCE_MAX, ['old', 'hero', 'new']);
    expect(picked.map(item => item.id)).toEqual(['hero', 'new', 'old']);
  });

  it('caps the references and skips scenes whose image is gone', () => {
    const many = Array.from({ length: 8 }, (_, i) => scene(`s${i}`, 'USER_UPLOAD', i, i + 1));
    expect(selectWorldReferenceScenes(many)).toEqual([]);
    expect(selectWorldReferenceScenes(many, VISION_WORLD_REFERENCE_MAX, many.map(item => item.id))).toHaveLength(VISION_WORLD_REFERENCE_MAX);
    expect(selectWorldReferenceScenes([scene('gone', 'USER_UPLOAD', 0, 1, false)])).toEqual([]);
  });

  it('attaches nothing for a Vision with no photographs yet (the first image has no world to continue)', () => {
    expect(selectWorldReferenceScenes([])).toEqual([]);
  });
});

describe('telling the provider what each attached image is', () => {
  const world = { buffer: Buffer.from('w'), mimeType: 'image/jpeg', role: 'world' as const };
  const who = { buffer: Buffer.from('a'), mimeType: 'image/jpeg', role: 'appearance' as const };

  it('orders the Vision\'s world before who is in it, whatever order they were supplied in', () => {
    expect(orderVisionReferences([who, world, world]).map(item => item.role)).toEqual(['world', 'world', 'appearance']);
  });

  it('keeps world and identity separate and numbers them', () => {
    const text = visionReferenceInstructions(orderVisionReferences([who, world, world]));
    expect(text).toMatch(/Images 1-2 are photographs the person added to their Vision themselves/);
    expect(text).toMatch(/NOT the setting for this scene/);
    expect(text).toMatch(/Image 3 is the person's approved appearance reference/);
    expect(text).toMatch(/does not describe the world/);
    expect(text).toMatch(/a specific car stays that car/);
    expect(text).toMatch(/if it names a different place, show that place/);
  });

  it('says nothing about a world when there is none, and still guards identity', () => {
    const text = visionReferenceInstructions(orderVisionReferences([who]));
    expect(text).not.toMatch(/added to their Vision themselves/);
    expect(text).toMatch(/Image 1 is the person's approved appearance reference/);
    expect(visionReferenceInstructions([])).toMatch(/No appearance reference was supplied/);
  });

  it('scopes personal references to the subjects they show, never the location, only when attached', () => {
    const plan = buildVisionSceneVariantPlan('Driving it down the highway at golden hour');
    const base = { intention: 'I own a Regal', category: 'desire', description: 'My Regal', scene: plan[0], plannedScenes: plan };
    expect(buildVisionImagePrompt({ ...base, worldReferenceCount: 1 })).toMatch(/do not set the location of this scene/);
    expect(buildVisionImagePrompt(base)).not.toMatch(/own references/);
  });

  it('lets each added scene control its own environment (gym, then classroom)', () => {
    const gym = buildVisionSceneVariantPlan('Training alone in a gym before sunrise, discipline in every rep');
    const classroom = buildVisionSceneVariantPlan('Teaching a classroom of attentive students, discipline in every lesson');
    const vision = { intention: 'Live with discipline', category: 'career', description: 'A disciplined life: early gym sessions and steady work.' };
    const prompt = buildVisionImagePrompt({ ...vision, scene: classroom[0], isAddedScene: true });
    expect(prompt).toContain('Teaching a classroom of attentive students');
    expect(prompt).toContain('Do not borrow rooms, places, props, light or compositions from any other moment');
    expect(prompt).toMatch(/lowest priority.*never overrides the scene's own location or environment/s);
    // Nothing of the previous scene survives into the next one.
    expect(prompt).not.toContain('Training alone in a gym');
    expect(prompt).not.toMatch(/same world, season, light quality and grade/);
    expect(buildVisionImagePrompt({ ...vision, scene: gym[0], isAddedScene: true })).not.toContain('classroom');
  });

  it('omits the Vision background and isolation rule for a first image', () => {
    const plan = buildVisionSceneVariantPlan('A bright kitchen at dawn');
    const prompt = buildVisionImagePrompt({ intention: 'x', category: 'desire', description: 'Vision words', scene: plan[0] });
    expect(prompt).not.toContain('Vision-level background');
    expect(prompt).not.toContain('Do not borrow rooms');
  });

  it('numbers the start photo first and tells the model to transform that place, not invent another', () => {
    const start = { buffer: Buffer.from('s'), mimeType: 'image/jpeg', role: 'start' as const };
    const ordered = orderVisionReferences([who, world, start]);
    expect(ordered.map(item => item.role)).toEqual(['start', 'world', 'appearance']);
    const text = visionReferenceInstructions(ordered);
    expect(text).toMatch(/Image 1 is the person's own photograph of their real world AS IT IS TODAY/);
    expect(text).toMatch(/same real place/);
    expect(text).toMatch(/Image 2 is a photograph the person added to their Vision themselves/);
    expect(text).toMatch(/Image 3 is the person's approved appearance reference/);
    expect(visionReferenceInstructions(orderVisionReferences([start]))).not.toMatch(/added to their Vision themselves/);
  });

  it('adds the start-photo transformation line to the scene prompt only when one is attached', () => {
    const plan = buildVisionSceneVariantPlan('The same kitchen, bright and finished');
    const base = { intention: 'A home I love', category: 'desire', description: 'My kitchen', scene: plan[0], plannedScenes: plan };
    expect(buildVisionImagePrompt({ ...base, startPhotoAttached: true })).toMatch(/start photo.*same place transformed/s);
    expect(buildVisionImagePrompt(base)).not.toMatch(/start photo/);
  });

  it('keeps the second candidate in the same light as the Vision rather than a different time of day', () => {
    expect(buildVisionSceneVariantPlan('Driving it down the highway')[1].light).not.toMatch(/different time of day/i);
  });
});
