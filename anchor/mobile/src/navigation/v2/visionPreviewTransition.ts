import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { V2_REDUCED_MOTION_TRANSITION_MS, v2ScreenBackground } from './transitions';

/** Native push and pop use the same dissolve; preview geometry remains mounted underneath. */
export function visionPreviewScreenOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  return {
    ...v2ScreenBackground('paper'),
    animation: 'fade',
    // Native-stack honours custom fade durations on iOS; Android owns its native timing.
    animationDuration: reduceMotion ? V2_REDUCED_MOTION_TRANSITION_MS : 520,
  };
}
