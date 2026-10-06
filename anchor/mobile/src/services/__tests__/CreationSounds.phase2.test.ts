import { CREATION_SOUND_SOURCES } from '@/services/audio/soundSources';
import { playCreationSound } from '@/services/CreationSounds';
import { SoundPool } from '@/services/audio/SoundPool';
import { useSettingsStore } from '@/stores/settingsStore';

const mockStop = jest.fn();
jest.mock('@/services/audio/SoundPool', () => ({
  SoundPool: { play: jest.fn(() => (require('@/stores/settingsStore').useSettingsStore.getState().soundEffectsEnabled ? { stop: mockStop } : null)) },
}));

const keys = [
  'distillTick', 'sealRise', 'revealSettle', 'formTick', 'formSettle',
  'releaseFall', 'releaseResolve', 'paywallSuccess', 'practiceComplete',
  'formBed', 'threadSettle', 'onboardingSealed', 'homeArrival', 'visionPin',
] as const;

afterEach(() => {
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.clearAllMocks();
});

it.each(keys)('%s is registered and respects the sound-effects toggle', (key) => {
  expect(CREATION_SOUND_SOURCES[key]).toBeDefined();
  useSettingsStore.setState({ soundEffectsEnabled: false });
  expect(playCreationSound(key)).toBeNull();
  expect(SoundPool.play).toHaveBeenLastCalledWith(`creation:${key}`, expect.any(Object));

  useSettingsStore.setState({ soundEffectsEnabled: true });
  expect(playCreationSound(key)).toEqual({ stop: expect.any(Function) });
  expect(SoundPool.play).toHaveBeenLastCalledWith(`creation:${key}`, expect.any(Object));
});
