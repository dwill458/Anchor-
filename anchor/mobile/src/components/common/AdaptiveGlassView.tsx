import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { tierPolicy } from '@/hooks/usePerformanceTier';

export interface AdaptiveGlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Blur intensity for devices that support blur (default from tierPolicy) */
  intensity?: number;
  /** Blur tint (default 'dark') */
  tint?: BlurTint;
  /** Solid / semi-opaque fallback background color for low-tier devices */
  fallbackColor?: string;
  fallbackBorderColor?: string;
  fallbackBorderWidth?: number;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  testID?: string;
}

/**
 * AdaptiveGlassView
 *
 * Automatically renders a hardware-accelerated BlurView on high-end devices
 * (iOS and flagship Android), while seamlessly degrading to an opaque/semi-opaque
 * solid surface with 0 dropped frames on low-tier budget hardware (e.g. Moto G Play).
 */
export const AdaptiveGlassView: React.FC<AdaptiveGlassViewProps> = ({
  children,
  style,
  contentStyle,
  intensity,
  tint = 'dark',
  fallbackColor = 'rgba(12, 17, 24, 0.92)',
  fallbackBorderColor,
  fallbackBorderWidth,
  pointerEvents,
  testID,
}) => {
  const perfTier = useAppPerformanceTier();
  const policy = tierPolicy(perfTier);

  const shouldBlur = policy.enableBlurViews;
  const effectiveIntensity = intensity ?? policy.blurIntensity;

  if (shouldBlur) {
    return (
      <BlurView
        intensity={effectiveIntensity}
        tint={tint}
        style={style}
        pointerEvents={pointerEvents}
        testID={testID}
      >
        {contentStyle ? <View style={contentStyle}>{children}</View> : children}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        style,
        {
          backgroundColor: fallbackColor,
          ...(fallbackBorderColor ? { borderColor: fallbackBorderColor } : null),
          ...(fallbackBorderWidth !== undefined ? { borderWidth: fallbackBorderWidth } : null),
        },
      ]}
      pointerEvents={pointerEvents}
      testID={testID}
    >
      {contentStyle ? <View style={contentStyle}>{children}</View> : children}
    </View>
  );
};

export function useAdaptiveGlass(options?: {
  intensity?: number;
  fallbackColor?: string;
}) {
  const perfTier = useAppPerformanceTier();
  const policy = tierPolicy(perfTier);
  const shouldBlur = policy.enableBlurViews;

  return {
    tier: perfTier,
    shouldBlur,
    blurIntensity: options?.intensity ?? policy.blurIntensity,
    fallbackStyle: {
      backgroundColor: options?.fallbackColor ?? 'rgba(12, 17, 24, 0.92)',
    },
  };
}
