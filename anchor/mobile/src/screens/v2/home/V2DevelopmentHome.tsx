import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { V2Button, V2Screen, V2Surface } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';

/** A deliberately small proof-of-isolation shell; this is not the V2 Home design. */
export function V2DevelopmentHome() {
  const navigation = useNavigation<any>();
  return (
    <V2Screen testID="anchor-v2-development-home" style={styles.safeArea}>
      <View style={styles.center}>
      <V2Surface style={styles.card}>
        <Text style={styles.eyebrow}>ANCHOR 2.0</Text>
        <Text style={styles.title}>Your Anchor is saved.</Text>
        <Text style={styles.body}>The V2 Home experience is still being built. This isolated shell is your destination after first run.</Text>
        <V2Button accessibilityLabel="Open V2 System Gallery" onPress={() => navigation.navigate('V2SystemGallery')}>Open system gallery</V2Button>
      </V2Surface>
      </View>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center' },
  card: { gap: spacing[3] },
  eyebrow: { color: colors.textSecondary, fontFamily: typography.bodyMedium, fontSize: 12, letterSpacing: 1.4, marginBottom: spacing.sm },
  title: { color: colors.textPrimary, ...typography.title },
  body: { color: colors.textSecondary, ...typography.bodyText },
});
