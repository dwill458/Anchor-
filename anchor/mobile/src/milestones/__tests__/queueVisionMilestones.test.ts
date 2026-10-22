const mockQueue = jest.fn();
jest.mock('../queueMilestoneAction', () => ({ queueMilestoneAction: (...args: unknown[]) => mockQueue(...args) }));
import { queueVisionMilestones } from '../queueVisionMilestones';
beforeEach(() => jest.clearAllMocks());
it('requests only the completed persisted Vision boundary, never Visualize history', async () => {
  const active = () => true;
  await queueVisionMilestones('a', 'v', active);
  expect(mockQueue).toHaveBeenCalledWith('a', { kind: 'vision', sourceEntityId: 'v' }, active);
});
it('does not infer a Vision event from an Anchor alone', async () => {
  await queueVisionMilestones('a', ''); expect(mockQueue).not.toHaveBeenCalled();
});
