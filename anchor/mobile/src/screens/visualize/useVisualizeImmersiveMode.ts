import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

type ImmersiveModeModule = {
  enter?: () => void;
  exit?: () => void;
};

/**
 * The active visualization is the one practice surface that benefits from
 * edge-to-edge system UI. The native module is optional so iOS and Expo Go
 * remain safe; the screen still hides the status bar through expo-status-bar.
 */
export const useVisualizeImmersiveMode = (active: boolean): void => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const module = NativeModules.AnchorImmersiveMode as
      | ImmersiveModeModule
      | undefined;
    if (active) module?.enter?.();
    else module?.exit?.();

    return () => module?.exit?.();
  }, [active]);
};
