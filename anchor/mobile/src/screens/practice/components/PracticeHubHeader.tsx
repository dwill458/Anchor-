import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassIconButton } from '@/components/common';
import { InfoIcon } from '@/components/icons';
import { colors, spacing, typography } from '@/theme';
import { PRACTICE_COPY } from '@/constants/copy';

interface PracticeHubHeaderProps {
  onInfoPress: () => void;
}

export const PracticeHubHeader: React.FC<PracticeHubHeaderProps> = ({ onInfoPress }) => {
  return (
    <View style={styles.row}>
      <View style={styles.copyWrap}>
        <Text style={styles.title}>{PRACTICE_COPY.headerTitle}</Text>
        <Text style={styles.subtitle}>{PRACTICE_COPY.headerSubtitle}</Text>
      </View>
      <GlassIconButton
        accessibilityLabel="Practice mode help"
        onPress={onInfoPress}
        size="sm"
        style={styles.infoButton}
      >
        <InfoIcon size={16} color={colors.gold} />
      </GlassIconButton>
    </View >
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copyWrap: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 28,
    lineHeight: 34,
    color: '#F4EFE6',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 4,
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(244, 239, 230, 0.65)',
  },
  infoButton: {
    marginTop: 2,
  },
});
