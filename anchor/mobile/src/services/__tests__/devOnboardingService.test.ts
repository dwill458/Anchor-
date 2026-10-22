import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { resetFirstRunStore } from '../devOnboardingService';

describe('devOnboardingService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('resets in-memory firstRunStore and removes persisted storage', async () => {
    const resetSpy = jest.spyOn(useFirstRunStore.getState(), 'reset');
    const removeSpy = jest.spyOn(AsyncStorage, 'removeItem');

    await resetFirstRunStore();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith('anchor:v2:first-run');
  });
});
