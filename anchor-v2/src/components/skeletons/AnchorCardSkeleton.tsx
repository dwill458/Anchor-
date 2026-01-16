/**
 * Anchor App - Anchor Card Skeleton Loader
 *
 * Loading placeholder for anchor cards in vault.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '@/theme';

export const AnchorCardSkeleton: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View
      style={styles.card}
      accessibilityLabel="Loading anchor"
      accessible={false}
    >
      {/* Sigil placeholder */}
      <Animated.View
        style={[
          styles.sigilPlaceholder,
          { opacity },
        ]}
      />

      {/* Text placeholders */}
      <View style={styles.textContainer}>
        <Animated.View
          style={[
            styles.titlePlaceholder,
            { opacity },
          ]}
        />
        <Animated.View
          style={[
            styles.subtitlePlaceholder,
            { opacity },
          ]}
        />
      </View>
    </View>
  );
};

export const AnchorGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <AnchorCardSkeleton key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
  },
  card: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: spacing.md,
    marginHorizontal: '1%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,175,55,0.2)',
    marginBottom: spacing.md,
  },
  textContainer: {
    width: '100%',
    alignItems: 'center',
  },
  titlePlaceholder: {
    width: '70%',
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.sm,
  },
  subtitlePlaceholder: {
    width: '50%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
