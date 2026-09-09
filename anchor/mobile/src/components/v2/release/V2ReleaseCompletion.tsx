import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { V2Button } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';
import { RELEASE_COPY } from '@/constants/v2/release';

interface Props {
  intentionText: string;
  reduceMotion?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  testID?: string;
}

/**
 * The celebratory completion moment — "Honoring what you built". The chamber
 * has crossfaded back to the warm mineral canvas; the intention now lives in
 * history.
 */
export function V2ReleaseCompletion({
  intentionText,
  reduceMotion = false,
  onPrimary,
  onSecondary,
  testID,
}: Props) {
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
      testID={testID ?? 'v2-release-completion'}
    >
      <View style={styles.body}>
        <Text style={styles.kicker}>{RELEASE_COPY.completionKicker}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {RELEASE_COPY.completionTitle}
        </Text>
        <Text style={styles.detail}>{RELEASE_COPY.completionBody}</Text>
        <Text style={styles.intention}>“{intentionText}”</Text>
      </View>

      <View style={styles.actions}>
        <V2Button variant="primary" size="large" onPress={onPrimary} testID="v2-release-completion-primary">
          {RELEASE_COPY.completionPrimaryCta}
        </V2Button>
        {onSecondary && (
          <V2Button
            variant="tertiary"
            size="large"
            onPress={onSecondary}
            testID="v2-release-completion-secondary"
          >
            {RELEASE_COPY.completionSecondaryCta}
          </V2Button>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing[8],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[3],
  },
  kicker: {
    ...typography.labelSM,
    color: colors.text.secondary,
  },
  title: {
    ...typography.headingXL,
    color: colors.text.primary,
  },
  detail: {
    ...typography.bodyLG,
    color: colors.text.secondary,
  },
  intention: {
    ...typography.bodyMD,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  actions: {
    gap: spacing[2],
  },
});
