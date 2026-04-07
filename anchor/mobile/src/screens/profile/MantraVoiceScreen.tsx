/**
 * Anchor App - Mantra Voice Screen
 *
 * Control which voice is used during mantra playback.
 * Options: Voice One (AI-generated) or Silent (no audio).
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
import { Check, Volume2, VolumeX, LucideIcon } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

const IS_ANDROID = Platform.OS === 'android';
const CardWrapper = IS_ANDROID ? View : BlurView;

type MantraVoiceOption = {
  id: 'generated' | 'my_voice';
  name: string;
  description: string;
  icon: LucideIcon;
};

const MANTRA_VOICE_OPTIONS: MantraVoiceOption[] = [
  {
    id: 'generated',
    name: 'Voice One',
    description: 'AI-generated voice reads your mantra with clarity and presence.',
    icon: Volume2,
  },
  {
    id: 'my_voice',
    name: 'Silent',
    description: 'No audio playback. Practice in complete silence or with your own ambient sounds.',
    icon: VolumeX,
  },
];

export const MantraVoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { mantraVoice, setMantraVoice } = useSettingsStore();

  const handleSelectVoice = (voice: 'generated' | 'my_voice') => {
    setMantraVoice(voice);
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
            <Text style={styles.title}>Mantra Voice</Text>
            <Text style={styles.subtitle}>
              Choose the voice used during mantra playback.
            </Text>
          </View>

          {/* Voice Options */}
          <View style={styles.optionsContainer}>
            {MANTRA_VOICE_OPTIONS.map((voiceOption) => {
              const IconComponent = voiceOption.icon;
              const isSelected = mantraVoice === voiceOption.id;

              return (
                <TouchableOpacity
                  key={voiceOption.id}
                  onPress={() => handleSelectVoice(voiceOption.id)}
                  activeOpacity={0.7}
                  style={styles.optionWrapper}
                >
                  <CardWrapper
                    {...cardProps}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                    ]}
                  >
                    {/* Icon Preview */}
                    <View
                      style={[
                        styles.iconContainer,
                        isSelected && styles.iconContainerSelected,
                      ]}
                    >
                      <IconComponent
                        color={isSelected ? colors.gold : colors.silver}
                        size={28}
                      />
                    </View>

                    <View style={styles.optionContent}>
                      <Text style={styles.optionName}>{voiceOption.name}</Text>
                      <Text style={styles.optionDescription}>
                        {voiceOption.description}
                      </Text>
                    </View>

                    {isSelected && (
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
              Personal voice recording may be available in future updates.
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
