/**
 * Anchor App - Accent Color Screen
 *
 * Customize the accent color used for highlights, CTAs, and selections.
 * Currently supports Gold (designed for future extensibility).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

const IS_ANDROID = Platform.OS === 'android';
const CardWrapper = IS_ANDROID ? View : BlurView;

type AccentColorOption = {
  id: string;
  name: string;
  hex: string;
  description: string;
};

const ACCENT_COLORS: AccentColorOption[] = [
  {
    id: 'gold',
    name: 'Gold',
    hex: '#D4AF37',
    description: 'Warm, refined, and intentional. The signature color of Zen Architect.',
  },
];

export const AccentColorScreen: React.FC = () => {
  const navigation = useNavigation();
  const { accentColor, setAccentColor } = useSettingsStore();

  const handleSelectColor = (hex: string) => {
    setAccentColor(hex);
    // Brief delay before going back to show selection feedback
    setTimeout(() => {
      navigation.goBack();
    }, 150);
  };

  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Accent Color</Text>
            <Text style={styles.subtitle}>
              Choose a highlight color across the app.
            </Text>
          </View>

          {/* Color Options */}
          <View style={styles.optionsContainer}>
            {ACCENT_COLORS.map((colorOption) => (
              <TouchableOpacity
                key={colorOption.id}
                onPress={() => handleSelectColor(colorOption.hex)}
                activeOpacity={0.7}
                style={styles.optionWrapper}
              >
                <CardWrapper
                  {...cardProps}
                  style={[
                    styles.option,
                    accentColor === colorOption.hex && styles.optionSelected,
                  ]}
                >
                  {/* Color Swatch */}
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: colorOption.hex },
                    ]}
                  />

                  <View style={styles.optionContent}>
                    <Text style={styles.optionName}>{colorOption.name}</Text>
                    <Text style={styles.optionDescription}>
                      {colorOption.description}
                    </Text>
                  </View>

                  {accentColor === colorOption.hex && (
                    <View style={styles.checkIconContainer}>
                      <Check color={colorOption.hex} size={24} strokeWidth={3} />
                    </View>
                  )}
                </CardWrapper>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Additional accent colors may be available in future updates.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
  optionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  optionWrapper: {
    marginBottom: spacing.sm,
  },
  option: {
    backgroundColor: IS_ANDROID
      ? 'rgba(26, 26, 29, 0.9)'
      : 'rgba(26, 26, 29, 0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  optionSelected: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  optionContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  optionName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
  checkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.silver,
    textAlign: 'center',
    opacity: 0.6,
    fontStyle: 'italic',
  },
});
