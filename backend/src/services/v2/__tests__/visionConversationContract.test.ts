import { StartVisionSceneGenerationSchema } from '../../../domain/v2/vision';
import { visionReferenceInstructions, orderVisionReferences } from '../../image/visionReferences';
import { buildVisionConversationPrompt } from '../visionConversationPrompt';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = { sceneDescription: 'An editorial business article about Anchor', idempotencyKey: 'vision-test-request-0001' };
describe('Vision conversational boundary', () => {
  it('keeps old single-reference clients valid', () => {
    expect(StartVisionSceneGenerationSchema.safeParse({ ...base, startAssetId: id(1) }).success).toBe(true);
  });
  it('allows exactly five explicit references and rejects a sixth or duplicates', () => {
    const references = Array.from({ length: 5 }, (_, i) => ({ assetId: id(i + 1), role: 'inspiration' }));
    expect(StartVisionSceneGenerationSchema.safeParse({ ...base, operation: 'COMPOSE', references }).success).toBe(true);
    expect(StartVisionSceneGenerationSchema.safeParse({ ...base, references: [...references, { assetId: id(9), role: 'object' }] }).success).toBe(false);
    expect(StartVisionSceneGenerationSchema.safeParse({ ...base, references: [references[0], references[0]] }).success).toBe(false);
  });
  it('requires exact parent and session for EDIT/VARIATE; CREATE cannot smuggle a parent', () => {
    for (const operation of ['EDIT', 'VARIATE']) {
      expect(StartVisionSceneGenerationSchema.safeParse({ ...base, operation }).success).toBe(false);
      expect(StartVisionSceneGenerationSchema.safeParse({ ...base, operation, sessionId: id(7), parentCandidateId: id(8) }).success).toBe(true);
    }
    expect(StartVisionSceneGenerationSchema.safeParse({ ...base, operation: 'CREATE', parentCandidateId: id(8) }).success).toBe(false);
    expect(StartVisionSceneGenerationSchema.safeParse({ ...base, references: [], startAssetId: id(8) }).success).toBe(false);
  });
  it('passes editorial intent without dashboard context or preservation directives', () => {
    const prompt = buildVisionConversationPrompt('CREATE', base.sceneDescription, 'Anchor succeeds', 0);
    expect(prompt).toContain(base.sceneDescription);
    expect(prompt).not.toMatch(/dashboard|same place|change only|No readable text|preserve.*architecture/i);
  });
  it('edits only the explicit source and gives the exact instruction priority', () => {
    const prompt = buildVisionConversationPrompt('EDIT', 'Keep everything the same, make it sunset', 'ignored background', 1);
    expect(prompt).toContain('Keep everything the same, make it sunset');
    expect(prompt).not.toContain('ignored background');
    const refs = orderVisionReferences([
      { buffer: Buffer.from('place'), mimeType: 'image/jpeg', role: 'place' },
      { buffer: Buffer.from('source'), mimeType: 'image/jpeg', role: 'edit_source' },
    ]);
    expect(refs[0].role).toBe('edit_source');
    expect(visionReferenceInstructions(refs, 'EDIT')).toMatch(/Image 1.*exact.*source/i);
  });
});
