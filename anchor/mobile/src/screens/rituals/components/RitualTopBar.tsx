import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface RitualTopBarProps {
  onBack: () => void;
  phaseLabel?: string;
  title?: string;
  disableBack?: boolean;
}

export const RitualTopBar: React.FC<RitualTopBarProps> = ({
  onBack,
  phaseLabel,
  title,
  disableBack = false,
}) => {
  const centerText = phaseLabel || title;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.8}
        style={[styles.backButton, disableBack ? styles.backButtonDisabled : null]}
        disabled={disableBack}
        accessibilityRole="button"
        accessibilityLabel="Exit ritual"
      >
        <Text style={styles.backIcon}>×</Text>
      </TouchableOpacity>

      <View style={styles.centerWrap} pointerEvents="none">
        {centerText ? (
          <View style={[styles.phaseChip, title ? styles.titleChip : null]}>
            <Text style={[styles.phaseText, title ? styles.titleText : null]}>
              {centerText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.trailingSpace} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ritual.glass,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  backButtonDisabled: {
    opacity: 0.45,
  },
  backIcon: {
    fontSize: 30,
    lineHeight: 30,
    color: colors.text.secondary,
    fontWeight: '300',
    marginTop: -1,
  },
  centerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  phaseChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.ritual.glass,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  phaseText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    letterSpacing: 0.4,
    color: colors.text.secondary,
  },
  titleChip: {
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  titleText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  trailingSpace: {
    width: 44,
    height: 44,
  },
});
