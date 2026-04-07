import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  borderColor?: string;
  backgroundColor?: string;
  androidFallbackColor?: string;
  showInnerGlow?: boolean;
  glowColors?: readonly [string, string, string];
}

const DEFAULT_GLOW_COLORS: readonly [string, string, string] = [
  'rgba(212, 175, 55, 0.14)',
  'rgba(212, 175, 55, 0.05)',
  'rgba(212, 175, 55, 0.0)',
];

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  contentStyle,
  intensity = 24,
  borderColor = 'rgba(212, 175, 55, 0.22)',
  backgroundColor = 'rgba(18, 24, 33, 0.45)',
  androidFallbackColor = 'rgba(15, 20, 28, 0.9)',
  showInnerGlow = true,
  glowColors = DEFAULT_GLOW_COLORS,
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          borderColor,
          backgroundColor: Platform.OS === 'ios' ? backgroundColor : androidFallbackColor,
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFillObject} />
      ) : null}
      {showInnerGlow ? (
        <LinearGradient
          colors={glowColors}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 7,
  },
  content: {
    position: 'relative',
  },
});
