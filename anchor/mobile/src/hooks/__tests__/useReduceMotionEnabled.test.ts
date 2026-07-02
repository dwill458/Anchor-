import { renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useReduceMotionEnabled } from '../useReduceMotionEnabled';
import { useSettingsStore } from '@/stores/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const mockIsReduceMotionEnabled = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');
jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
  remove: jest.fn(),
} as never);

describe('useReduceMotionEnabled', () => {
  beforeEach(() => {
    useSettingsStore.setState({ reduceMotion: 'system' });
  });

  it('follows the system flag when the preference is "system"', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);

    const { result } = renderHook(() => useReduceMotionEnabled());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('ignores the system flag when the user turned reduce motion off', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    useSettingsStore.setState({ reduceMotion: 'off' });

    const { result } = renderHook(() => useReduceMotionEnabled());

    await waitFor(() => expect(mockIsReduceMotionEnabled).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('reduces motion when the user turned it on despite the system flag being off', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    useSettingsStore.setState({ reduceMotion: 'on' });

    const { result } = renderHook(() => useReduceMotionEnabled());

    await waitFor(() => expect(mockIsReduceMotionEnabled).toHaveBeenCalled());
    expect(result.current).toBe(true);
  });
});
