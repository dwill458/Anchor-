import { selectWorldReferenceScenes, VISION_WORLD_REFERENCE_MAX, type WorldReferenceScene } from '../visionWorldReferences';
import { orderVisionReferences, visionReferenceInstructions } from '../../image/visionReferences';
import { buildVisionImagePrompt, buildVisionSceneVariantPlan } from '../visionScenePlanning';

const scene = (id: string, sourceType: string, sortOrder: number, day: number, withAsset = true): WorldReferenceScene => ({
  id, sourceType, sortOrder, createdAt: new Date(2026, 8, day), asset: withAsset ? { storageKey: `k/${id}`, mimeType: 'image/jpeg' } : null,
});

describe('selecting the Vision photographs that carry the world forward', () => {
  it('puts the person\'s own photograph first: it is the established world', () => {
    const picked = selectWorldReferenceScenes([
      scene('gen-hero', 'AI_GENERATED', 0, 1), scene('mine', 'USER_UPLOAD', 1, 2), scene('gen-new', 'AI_GENERATED', 2, 9),
    ]);
    expect(picked[0].id).toBe('mine');
  });

  it('treats a camera photo as the person\'s own', () => {
    expect(selectWorldReferenceScenes([scene('gen', 'AI_GENERATED', 0, 1), scene('cam', 'USER_CAMERA', 1, 2)])[0].id).toBe('cam');
  });

  it('prefers the hero within a source, then the most recently approved', () => {
    const picked = selectWorldReferenceScenes([
      scene('old', 'AI_GENERATED', 3, 1), scene('hero', 'AI_GENERATED', 0, 2), scene('new', 'AI_GENERATED', 4, 8),
    ]);
    expect(picked.map(item => item.id)).toEqual(['hero', 'new', 'old']);
  });

  it('caps the references and skips scenes whose image is gone', () => {
    const many = Array.from({ length: 8 }, (_, i) => scene(`s${i}`, 'AI_GENERATED', i, i + 1));
    expect(selectWorldReferenceScenes(many)).toHaveLength(VISION_WORLD_REFERENCE_MAX);
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
    expect(text).toMatch(/Images 1-2 are photographs ALREADY in this person's Vision/);
    expect(text).toMatch(/Image 3 is the person's approved appearance reference/);
    expect(text).toMatch(/does not describe the world/);
    expect(text).toMatch(/a specific car stays that car/);
  });

  it('says nothing about a world when there is none, and still guards identity', () => {
    const text = visionReferenceInstructions(orderVisionReferences([who]));
    expect(text).not.toMatch(/ALREADY in this person's Vision/);
    expect(text).toMatch(/Image 1 is the person's approved appearance reference/);
    expect(visionReferenceInstructions([])).toMatch(/No appearance reference was supplied/);
  });

  it('puts the established world above the category in the scene prompt, only when one is attached', () => {
    const plan = buildVisionSceneVariantPlan('Driving it down the highway at golden hour');
    const base = { intention: 'I own a Regal', category: 'desire', description: 'My Regal', scene: plan[0], plannedScenes: plan };
    expect(buildVisionImagePrompt({ ...base, worldReferenceCount: 1 })).toMatch(/established world.*a different moment from the same life/s);
    expect(buildVisionImagePrompt(base)).not.toMatch(/established world/);
  });

  it('numbers the start photo first and tells the model to transform that place, not invent another', () => {
    const start = { buffer: Buffer.from('s'), mimeType: 'image/jpeg', role: 'start' as const };
    const ordered = orderVisionReferences([who, world, start]);
    expect(ordered.map(item => item.role)).toEqual(['start', 'world', 'appearance']);
    const text = visionReferenceInstructions(ordered);
    expect(text).toMatch(/Image 1 is the person's own photograph of their real world AS IT IS TODAY/);
    expect(text).toMatch(/same real place/);
    expect(text).toMatch(/Image 2 is a photograph ALREADY in this person's Vision/);
    expect(text).toMatch(/Image 3 is the person's approved appearance reference/);
    expect(visionReferenceInstructions(orderVisionReferences([start]))).not.toMatch(/ALREADY in this person's Vision/);
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
