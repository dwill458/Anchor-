import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { V2IconButton } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';

type Props = {
  greeting: string;
  profileInitial?: string | null;
  onOpenChart?: () => void;
  onCreateAnchor?: () => void;
  onOpenProfile?: () => void;
  showChartUtility?: boolean;
};

function IconChart({ color = colors.text.primary }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M7.3 14.6 14.6 7.3"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray="1.4 3.4"
      />
      <Circle cx={5.2} cy={16.6} r={2.15} fill={color} />
      <Circle cx={16.8} cy={5.2} r={2.15} fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

function IconPlus({ color = colors.text.primary }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 4.5v13M4.5 11h13"
        stroke={color}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconProfileLetter({ letter, color = colors.text.primary }: { letter?: string | null; color?: string }) {
  return (
    <View style={styles.profileLetter}>
      {letter ? <Text style={[styles.profileInitial, { color }]}>{letter}</Text> : null}
    </View>
  );
}

/**
 * Home greeting + contextual utilities. It exposes navigation intents only; it
 * does not register routes or assume a permanent tab bar.
 */
function V2HomeHeaderComponent({
  greeting,
  profileInitial,
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
            icon={<IconChart color={colors.text.primary} />}
            accessibilityLabel="Open Chart"
            onPress={onOpenChart}
          />
        ) : null}
        <V2IconButton
          icon={<IconPlus color={colors.text.primary} />}
          accessibilityLabel="Create Anchor"
          onPress={onCreateAnchor}
        />
          <V2IconButton
            icon={<IconProfileLetter letter={profileInitial} color={colors.text.primary} />}
          accessibilityLabel="Open profile"
          onPress={onOpenProfile}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  greeting: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: typography.bodyMedium,
    color: colors.text.primary,
    letterSpacing: -0.1,
    textTransform: 'none',
  },
  utilities: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: -4,
  },
  profileLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileInitial: {
    fontSize: 14,
    fontFamily: typography.bodyMedium,
    lineHeight: 18,
  },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeHeader = memo(V2HomeHeaderComponent);
