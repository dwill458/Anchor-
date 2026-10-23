import { UpdateVisionSchema, UpdateVisionSceneSlotsSchema, VisionNoteLayoutPositionsSchema } from '../vision';

describe('Vision board mutations', () => {
  it.each(['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'])('accepts %s without changing other fields', boardLayout => {
    expect(UpdateVisionSchema.parse({ boardLayout })).toEqual({ boardLayout });
  });
  it('rejects missing revision, unknown layouts, duplicate slots and unbounded geometry', () => {
    expect(UpdateVisionSchema.safeParse({ boardLayout:'GRID' }).success).toBe(false);
    for(const slots of [[],[{sceneId:'a',slotIndex:8}],[{sceneId:'a',slotIndex:0},{sceneId:'a',slotIndex:1}],[{sceneId:'a',slotIndex:0},{sceneId:'b',slotIndex:0}]])
      expect(UpdateVisionSceneSlotsSchema.safeParse({slots}).success).toBe(false);
    expect(VisionNoteLayoutPositionsSchema.safeParse({EDITORIAL:{x:.5,y:7}}).success).toBe(false);
  });
  it('accepts a sparse eight-slot arrangement without touching content', () => {
    const slots = [{sceneId:'a',slotIndex:0},{sceneId:'b',slotIndex:7}];
    expect(UpdateVisionSceneSlotsSchema.parse({slots})).toEqual({slots});
    expect(VisionNoteLayoutPositionsSchema.parse({EDITORIAL:{x:.5,y:5},SCRAPBOOK:null})).toEqual({EDITORIAL:{x:.5,y:5},SCRAPBOOK:null});
  });
});
