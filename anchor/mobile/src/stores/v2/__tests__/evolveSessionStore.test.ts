import { useEvolveSessionStore } from '../evolveSessionStore';

const from = { fromAnchorId: 'old-1', fromIntention: 'Publish my novel' };
const successor = { anchorId: 'new-1', intentionText: 'Finish my novel' };

beforeEach(() => useEvolveSessionStore.getState().clear());

describe('evolveSessionStore', () => {
  it('starts empty', () => {
    expect(useEvolveSessionStore.getState().pending).toBeNull();
    expect(useEvolveSessionStore.getState().successor).toBeNull();
  });

  it('begin marks the session pending with nothing attached', () => {
    useEvolveSessionStore.getState().begin(from);
    expect(useEvolveSessionStore.getState().pending).toEqual(from);
    expect(useEvolveSessionStore.getState().successor).toBeNull();
  });

  it('attach records the sealed Anchor and ends the pending phase', () => {
    useEvolveSessionStore.getState().begin(from);
    useEvolveSessionStore.getState().attach(successor);
    expect(useEvolveSessionStore.getState().pending).toBeNull();
    expect(useEvolveSessionStore.getState().successor).toEqual(successor);
  });

  it('a new session never inherits a previous successor', () => {
    useEvolveSessionStore.getState().attach(successor);
    useEvolveSessionStore.getState().begin(from);
    expect(useEvolveSessionStore.getState().successor).toBeNull();
  });

  it('clear drops everything', () => {
    useEvolveSessionStore.getState().begin(from);
    useEvolveSessionStore.getState().attach(successor);
    useEvolveSessionStore.getState().clear();
    expect(useEvolveSessionStore.getState().pending).toBeNull();
    expect(useEvolveSessionStore.getState().successor).toBeNull();
  });

  it('is never persisted', () => {
    expect((useEvolveSessionStore as unknown as { persist?: unknown }).persist).toBeUndefined();
  });
});
