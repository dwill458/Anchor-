import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '@/theme';

export const SanctuaryEmptyState: React.FC = () => {
  return (
    <View style={styles.card}>
      <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(201,168,76,0.09)', 'rgba(201,168,76,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.title}>Forge your first anchor</Text>
      <Text style={styles.body}>Turn intention into a symbol you can return to.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 22,
    marginHorizontal: 22,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.24)',
    overflow: 'hidden',
    backgroundColor: 'rgba(18,12,32,0.36)',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 17,
    color: colors.sanctuary.goldBright,
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  body: {
    marginTop: 7,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: 'rgba(200,185,155,0.8)',
    textAlign: 'center',
    lineHeight: 19,
  },
});
