import { visionTwoUpState, VISION_TWO_UP_COUNT } from '../visionTwoUp';

const candidate = (index: number, imageUrl: string | null = `https://cdn.example.com/${index}.jpg`) => ({
  id: `c${index}`, assetId: imageUrl ? `a${index}` : null, role: 'r', prompt: 'p', sortOrder: index, imageUrl,
});
const job = (status: string, candidates: ReturnType<typeof candidate>[] = []) => ({
  id: 'j', kind: 'SCENE', status, stage: 's', setNumber: 1, retryCount: 0, error: null, candidates,
}) as any;

describe('visionTwoUpState', () => {
  it('is exactly two moments', () => {
    expect(VISION_TWO_UP_COUNT).toBe(2);
    expect(visionTwoUpState(job('RUNNING')).slots).toHaveLength(2);
  });

  it('starts when there is no job or it is only queued, and nothing can be chosen', () => {
    for (const state of [visionTwoUpState(null), visionTwoUpState(job('QUEUED'))]) {
      expect(state.phase).toBe('starting');
      expect(state.selectable).toBe(false);
      expect(state.title).toBe('Your future\nis taking shape.');
    }
  });

  it('develops while any moment is missing, revealing whichever has arrived without allowing a choice', () => {
    const state = visionTwoUpState(job('PARTIAL', [candidate(0)]));
    expect(state.phase).toBe('developing');
    expect(state.ready).toHaveLength(1);
    expect(state.slots[0]?.id).toBe('c0');
    expect(state.slots[1]).toBeNull();
    expect(state.selectable).toBe(false);
  });

  it('is ready to choose only once the job is complete, with the images as the controls', () => {
    const state = visionTwoUpState(job('COMPLETE', [candidate(1), candidate(0)]));
    expect(state.phase).toBe('choose');
    expect(state.selectable).toBe(true);
    expect(state.slots.map(slot => slot?.id)).toEqual(['c0', 'c1']);
    expect(state.title).toBe('Your future\nis ready to choose from.');
    expect(state.subtitle).toBe('Tap the one that feels right.');
  });

  it('does not treat a complete job with no pictures as choosable', () => {
    const state = visionTwoUpState(job('COMPLETE', [candidate(0, null)]));
    expect(state.phase).toBe('developing');
    expect(state.selectable).toBe(false);
  });

  it('keeps what finished choosable when the job fails, and offers nothing to choose when nothing did', () => {
    expect(visionTwoUpState(job('FAILED', [candidate(0)]))).toEqual(expect.objectContaining({ phase: 'failed', selectable: true }));
    expect(visionTwoUpState(job('FAILED'))).toEqual(expect.objectContaining({ phase: 'failed', selectable: false }));
  });

  it('never shows more than two, even if the server returned more', () => {
    const state = visionTwoUpState(job('COMPLETE', [candidate(0), candidate(1), candidate(2)]));
    expect(state.slots).toHaveLength(2);
    expect(state.ready).toHaveLength(2);
  });
});
