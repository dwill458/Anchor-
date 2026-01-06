/**
 * Anchor App - Main Application Entry Point
 */

import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from './src/theme';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background.primary}
      />
      <View style={styles.content}>
        <Text style={styles.title}>Anchor</Text>
        <Text style={styles.subtitle}>Transform intentions into power</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.h1,
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    fontFamily: typography.fonts.body,
  },
});

export default App;
