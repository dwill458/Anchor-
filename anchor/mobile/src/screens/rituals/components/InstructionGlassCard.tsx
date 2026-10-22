import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { AdaptiveGlassView } from '@/components/common/AdaptiveGlassView';
import { colors, spacing, typography } from '@/theme';

interface InstructionGlassCardProps {
  text: string;
  emphasized?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const InstructionGlassCard: React.FC<InstructionGlassCardProps> = ({
  text,
  emphasized = false,
  containerStyle,
  textStyle,
}) => {
  const intensity = emphasized ? 26 : 18;

  const content = (
    <View
      style={[
        styles.inner,
        emphasized && styles.innerEmphasized,
      ]}
    >
      <Text
        style={[
          styles.text,
          emphasized && styles.textEmphasized,
          textStyle,
        ]}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <AdaptiveGlassView
        intensity={intensity}
        tint="dark"
        fallbackColor="rgba(12, 17, 24, 0.92)"
        style={styles.blur}
      >
        {content}
      </AdaptiveGlassView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
  },
  blur: {
    overflow: 'hidden',
  },
  androidFallback: {
    backgroundColor: colors.ritual.glassStrong,
  },
  inner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  innerEmphasized: {
    backgroundColor: colors.ritual.softGlow,
  },
  text: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    lineHeight: typography.lineHeights.body1,
    textAlign: 'center',
  },
  textEmphasized: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
});
