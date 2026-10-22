import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics, scaleImpactStyle } from '../haptics';

describe('scaleImpactStyle', () => {
  it('disables all impacts at zero', () => {
    expect(scaleImpactStyle(Haptics.ImpactFeedbackStyle.Heavy, 0)).toBeNull();
  });

  it('maps low intensity impacts to Light', () => {
    expect(scaleImpactStyle(Haptics.ImpactFeedbackStyle.Heavy, 20)).toBe(Haptics.ImpactFeedbackStyle.Light);
  });

  it('steps each medium-range impact down one level', () => {
    expect(scaleImpactStyle(Haptics.ImpactFeedbackStyle.Heavy, 50)).toBe(Haptics.ImpactFeedbackStyle.Medium);
    expect(scaleImpactStyle(Haptics.ImpactFeedbackStyle.Medium, 50)).toBe(Haptics.ImpactFeedbackStyle.Light);
    expect(scaleImpactStyle(Haptics.ImpactFeedbackStyle.Light, 50)).toBe(Haptics.ImpactFeedbackStyle.Light);
  });

  it.each([70, 100])('preserves requested impacts at intensity %i', (intensity) => {
    expect(scaleImpactStyle(Haptics.ImpactFeedbackStyle.Heavy, intensity)).toBe(Haptics.ImpactFeedbackStyle.Heavy);
  });
});

it('suppresses every safe haptic at zero while previews can bypass scaling', async () => {
  const original = useSettingsStore.getState().hapticIntensity;
  const haptics = jest.requireMock('expo-haptics');
  useSettingsStore.setState({ hapticIntensity: 0 });
  haptics.impactAsync.mockClear();
  haptics.selectionAsync.mockClear();
  haptics.notificationAsync.mockClear();

  await safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
  await safeHaptics.selection();
  await safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
  expect(haptics.impactAsync).not.toHaveBeenCalled();
  expect(haptics.selectionAsync).not.toHaveBeenCalled();
  expect(haptics.notificationAsync).not.toHaveBeenCalled();

  await safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy, { bypassScale: true });
  expect(haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  useSettingsStore.setState({ hapticIntensity: original });
});
