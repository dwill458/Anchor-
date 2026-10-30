import { flushFirstAnchorFlowDraft, useFirstAnchorFlowStore } from '../firstAnchorFlowStore';
import { flushCreationDraft, useCreationStore, type CreationDraft } from '../v2/creationStore';

const firstOptions = useFirstAnchorFlowStore.persist.getOptions();
const modernOptions = useCreationStore.persist.getOptions();
afterEach(() => {
  useFirstAnchorFlowStore.persist.setOptions(firstOptions);
  useCreationStore.persist.setOptions(modernOptions);
  jest.restoreAllMocks();
});
it('waits for the first-flow private write receipt and restores exactly the committed request/save keys', async () => {
  jest.spyOn(useFirstAnchorFlowStore.persist, 'hasHydrated').mockReturnValue(true);
  useFirstAnchorFlowStore.getState().updateDraft({ originalIntention: 'I focus', generationRequestKey: 'generation-key', saveRequestKey: 'save-key' });
  let commit!: () => void;
  const write = jest.fn((_name: string, _value: unknown) => new Promise<void>(resolve => { commit = resolve; }));
  useFirstAnchorFlowStore.persist.setOptions({ storage: { getItem: async () => null, setItem: write, removeItem: async () => {} } });
  let finished = false;
  const receipt = flushFirstAnchorFlowDraft().then(() => { finished = true; });
  await Promise.resolve();
  expect(finished).toBe(false);
  const payload = JSON.parse(JSON.stringify(write.mock.calls[0][1]));
  expect(payload.state.draft).toMatchObject({ generationRequestKey: 'generation-key', saveRequestKey: 'save-key' });
  commit(); await receipt;
  expect(finished).toBe(true);
  const restored = firstOptions.merge!(payload.state, { ...useFirstAnchorFlowStore.getState(), draft: null });
  expect(restored.draft).toMatchObject({ generationRequestKey: 'generation-key', saveRequestKey: 'save-key' });
});
it('does not confirm either creation store when its exact private snapshot write fails', async () => {
  jest.spyOn(useFirstAnchorFlowStore.persist, 'hasHydrated').mockReturnValue(true);
  jest.spyOn(useCreationStore.persist, 'hasHydrated').mockReturnValue(true);
  useCreationStore.setState({ draft: { draftId: 'modern-draft', clientRequestId: 'modern-save-key' } as CreationDraft });
  const storage = { getItem: async () => null, setItem: async () => { throw new Error('Private write failed'); }, removeItem: async () => {} };
  useFirstAnchorFlowStore.persist.setOptions({ storage });
  useCreationStore.persist.setOptions({ storage });
  await expect(flushFirstAnchorFlowDraft()).rejects.toThrow('Private write failed');
  await expect(flushCreationDraft('modern-draft')).rejects.toThrow('Private write failed');
});
