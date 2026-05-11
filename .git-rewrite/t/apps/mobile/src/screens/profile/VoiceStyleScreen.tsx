/**
 * Anchor App - Voice Style Screen
 *
 * Control the emotional tone of the AI mantra voice.
 * Options: Calm, Neutral, or Intense.
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
import { Check, Waves, Minus, Flame } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

const IS_ANDROID = Platform.OS === 'android';
const CardWrapper = IS_ANDROID ? View : BlurView;

type VoiceStyleOption = {
  id: 'calm' | 'neutral' | 'intense';
  name: string;
  description: string;
  icon: React.ComponentType<{ color: string; size: number }>;
};

const VOICE_STYLE_OPTIONS: VoiceStyleOption[] = [
  {
    id: 'calm',
    name: 'Calm',
    description: 'Soft, meditative tone. Perfect for relaxation and centering practices.',
    icon: Waves,
  },
  {
    id: 'neutral',
    name: 'Neutral',
    description: 'Balanced and clear. Works well for everyday activation.',
    icon: Minus,
  },
  {
    id: 'intense',
    name: 'Intense',
    description: 'Focused and energized. Ideal for moments requiring strong presence.',
    icon: Flame,
  },
];

export const VoiceStyleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { generatedVoiceStyle, setGeneratedVoiceStyle, mantraVoice } = useSettingsStore();

  const handleSelectStyle = (style: 'calm' | 'neutral' | 'intense') => {
    setGeneratedVoiceStyle(style);
    // Brief delay before going back to show selection feedback
    setTimeout(() => {
      navigation.goBack();
    }, 150);
  };

  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  // Show info if voice is set to silent
  const isVoiceDisabled = mantraVoice === 'my_voice';

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
            <Text style={styles.title}>Voice Style</Text>
            <Text style={styles.subtitle}>
              Choose the tone of the mantra voice.
            </Text>
          </View>

          {/* Disabled Warning */}
          {isVoiceDisabled && (
            <View style={styles.warningContainer}>
              <CardWrapper {...cardProps} style={styles.warningCard}>
                <Text style={styles.warningText}>
                  Voice style only applies when Mantra Voice is set to "Voice One".
                  Currently, your mantra voice is set to Silent.
                </Text>
              </CardWrapper>
            </View>
          )}

          {/* Style Options */}
          <View style={styles.optionsContainer}>
            {VOICE_STYLE_OPTIONS.map((styleOption) => {
              const IconComponent = styleOption.icon;
              const isSelected = generatedVoiceStyle === styleOption.id;

              return (
                <TouchableOpacity
                  key={styleOption.id}
                  onPress={() => handleSelectStyle(styleOption.id)}
                  activeOpacity={isVoiceDisabled ? 1 : 0.7}
                  disabled={isVoiceDisabled}
                  style={styles.optionWrapper}
                >
                  <CardWrapper
                    {...cardProps}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                      isVoiceDisabled && styles.optionDisabled,
                    ]}
                  >
                    {/* Icon Preview */}
                    <View
                      style={[
                        styles.iconContainer,
                        isSelected && !isVoiceDisabled && styles.iconContainerSelected,
                        isVoiceDisabled && styles.iconContainerDisabled,
                      ]}
                    >
                      <IconComponent
                        color={
                          isVoiceDisabled
                            ? 'rgba(192, 192, 192, 0.3)'
                            : isSelected
                            ? colors.gold
                            : colors.silver
                        }
                        size={28}
                      />
                    </View>

                    <View style={styles.optionContent}>
                      <Text
                        style={[
                          styles.optionName,
                          isVoiceDisabled && styles.textDisabled,
                        ]}
                      >
                        {styleOption.name}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          isVoiceDisabled && styles.textDisabled,
                        ]}
                      >
                        {styleOption.description}
                      </Text>
                    </View>

                    {isSelected && !isVoiceDisabled && (
                      <View style={styles.checkIconContainer}>
                        <Check color={colors.gold} size={24} strokeWidth={3} />
                      </View>
                    )}
                  </CardWrapper>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Voice style is applied to AI-generated mantra playback during activation and charging rituals.
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
  warningContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  warningCard: {
    backgroundColor: IS_ANDROID
      ? 'rgba(212, 175, 55, 0.1)'
      : 'rgba(212, 175, 55, 0.05)',
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  warningText: {
    fontSize: 13,
    color: colors.gold,
    lineHeight: 20,
    opacity: 0.9,
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
  optionDisabled: {
    opacity: 0.4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  iconContainerDisabled: {
    backgroundColor: 'rgba(192, 192, 192, 0.05)',
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
  textDisabled: {
    opacity: 0.4,
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
