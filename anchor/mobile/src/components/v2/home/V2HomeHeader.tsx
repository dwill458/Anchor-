import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Compass, Plus, UserRound } from 'lucide-react-native';
import { V2IconButton } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';

type Props = {
  greeting: string;
  onOpenChart?: () => void;
  onCreateAnchor?: () => void;
  onOpenProfile?: () => void;
  showChartUtility?: boolean;
};

/**
 * Home greeting + contextual utilities. It exposes navigation intents only; it
 * does not register routes or assume a permanent tab bar.
 */
export function V2HomeHeader({
  greeting,
  onOpenChart,
  onCreateAnchor,
  onOpenProfile,
  showChartUtility = true,
}: Props) {
  return (
    <View style={styles.bar}>
      <Text numberOfLines={1} accessibilityRole="header" style={styles.greeting}>
        {greeting}
      </Text>
      <View style={styles.utilities}>
        {showChartUtility ? (
          <V2IconButton
            icon={<Compass size={20} color={colors.text.primary} />}
            accessibilityLabel="Open Chart"
            onPress={onOpenChart}
          />
        ) : null}
        <V2IconButton
          icon={<Plus size={22} color={colors.text.primary} />}
          accessibilityLabel="Create Anchor"
          onPress={onCreateAnchor}
        />
        <V2IconButton
          icon={<UserRound size={20} color={colors.text.primary} />}
          accessibilityLabel="Open profile"
          onPress={onOpenProfile}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  greeting: { flex: 1, ...typography.bodyMD, fontFamily: typography.bodyMedium, color: colors.text.secondary, textTransform: 'none' },
  utilities: { flexDirection: 'row', alignItems: 'center', marginRight: -8 },
});
