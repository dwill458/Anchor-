import { CreateVisionSceneSchema, CreateVisionSchema } from '../vision';

describe('Vision scene caption', () => {
  const scene = { assetId: 'owned-asset', sourceType: 'USER_UPLOAD' };
  it('accepts and trims one line of up to 80 characters', () => {
    expect(CreateVisionSceneSchema.parse({ ...scene, caption: ` ${'a'.repeat(80)} ` }).caption).toHaveLength(80);
    expect(CreateVisionSchema.parse({ scenes: [{ ...scene, caption: ' This is where it leads. ' }] }).scenes?.[0].caption).toBe('This is where it leads.');
  });
  it('rejects captions over 80 characters', () => {
    expect(CreateVisionSceneSchema.safeParse({ ...scene, caption: 'a'.repeat(81) }).success).toBe(false);
  });
  it('continues to accept older clients and null captions', () => {
    expect(CreateVisionSceneSchema.safeParse(scene).success).toBe(true);
    expect(CreateVisionSceneSchema.safeParse({ ...scene, caption: null }).success).toBe(true);
  });
});
