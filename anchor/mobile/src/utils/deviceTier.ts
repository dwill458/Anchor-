import { Dimensions, PixelRatio, Platform } from 'react-native';

const screen = Dimensions.get('screen');
const pixelRatio = PixelRatio.get();

// Total physical pixels:
//   ~5.5 M  — Samsung S24 Ultra, Pixel 8 Pro, iPhone 15 Pro
//   ~2.5 M  — upper-mid-range (Galaxy A54, Pixel 6a)
//   ~1.2 M  — budget (Galaxy A14, Moto G Play)
const physicalPixelCount = screen.width * screen.height * pixelRatio * pixelRatio;

const HIGH_END_THRESHOLD = 2_500_000;

/**
 * True on iOS (always handles SVG/GPU-composited animations well), and on
 * Android devices with ≥ 2.5 M physical pixels (upper-mid-range and above).
 *
 * Used to gate expensive SVG-based decorative animations that run fine on
 * flagship hardware but cause dropped frames on budget Android devices.
 */
export const isHighEndDevice: boolean =
  Platform.OS === 'ios' || physicalPixelCount > HIGH_END_THRESHOLD;
