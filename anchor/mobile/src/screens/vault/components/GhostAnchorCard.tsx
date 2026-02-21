import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, typography } from '@/theme';

interface GhostAnchorCardProps {
  height: number;
  onPress: () => void;
  title?: string;
  body?: string;
}

export const GhostAnchorCard: React.FC<GhostAnchorCardProps> = ({
  height,
  onPress,
  title = 'Add another anchor',
  body = 'Balance your Sanctuary',
}) => {
  return (
    <Pressable
      style={[styles.card, { height }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add another anchor"
      accessibilityHint="Opens anchor creation"
    >
      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(201,168,76,0.09)', 'rgba(201,168,76,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        <View style={styles.plusRing}>
          <Text style={styles.plus}>+</Text>
        </View>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.hint}>{body}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(201,168,76,0.24)',
    backgroundColor: 'rgba(18,12,32,0.32)',
    marginBottom: spacing.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  plusRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,8,22,0.5)',
  },
  plus: {
    fontSize: 24,
    lineHeight: 26,
    color: 'rgba(201,168,76,0.7)',
    fontFamily: 'Cinzel-SemiBold',
  },
  label: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(200,185,155,0.74)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  hint: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: 'rgba(180,165,135,0.6)',
    textAlign: 'center',
  },
});
