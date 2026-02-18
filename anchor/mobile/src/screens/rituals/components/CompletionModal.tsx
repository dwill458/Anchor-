/**
 * CompletionModal — post-session reflection overlay.
 *
 * Shown after an activation or reinforce session completes.
 * Displays:
 *  - Gold glow pulse around anchor sigil
 *  - Contextual completion copy
 *  - "One word to seal it" prompt with 6 suggestion chips
 *  - Optional free-text input
 *  - "Done" and "Skip" CTAs
 *
 * Haptics: success notification on mount.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIGIL_SIZE = 80;

const SUGGESTION_WORDS = ['Grounded', 'Clear', 'Focused', 'Calm', 'Strong', 'Aligned'];

interface CompletionModalProps {
  visible: boolean;
  sessionType: 'activate' | 'reinforce';
  anchor: Anchor;
  onDone: (reflectionWord?: string) => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  visible,
  sessionType,
  anchor,
  onDone,
}) => {
  const [selectedWord, setSelectedWord] = useState<string | undefined>(undefined);
  const [customWord, setCustomWord] = useState('');
  const reduceMotion = useReduceMotionEnabled();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const headline =
    sessionType === 'activate' ? 'Anchor set.' : 'Imprint strengthened.';
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

  useEffect(() => {
    if (visible) {
      // Reset state on show
      setSelectedWord(undefined);
      setCustomWord('');

      safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

      if (!reduceMotion) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        glowLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1400,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 1400,
              useNativeDriver: true,
            }),
          ])
        );
        glowLoopRef.current.start();
      } else {
        fadeAnim.setValue(1);
        glowAnim.setValue(0.8);
      }
    } else {
      glowLoopRef.current?.stop();
      fadeAnim.setValue(0);
      glowAnim.setValue(0);
    }

    return () => glowLoopRef.current?.stop();
  }, [visible, reduceMotion, fadeAnim, glowAnim]);

  const handleSelectWord = (word: string) => {
    setSelectedWord((prev) => (prev === word ? undefined : word));
    setCustomWord('');
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDone = () => {
    const word = customWord.trim() || selectedWord;
    onDone(word || undefined);
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.65],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Sigil with gold glow */}
          <View style={styles.sigilArea}>
            <Animated.View
              style={[styles.glowRing, { opacity: glowOpacity }]}
            />
            <View style={styles.sigilGlowWrap}>
              <PremiumAnchorGlow
                size={SIGIL_SIZE}
                state="active"
                variant="ritual"
                reduceMotionEnabled={reduceMotion}
              />
            </View>
            <View style={styles.sigilContent}>
              {anchor.enhancedImageUrl ? (
                <OptimizedImage
                  uri={anchor.enhancedImageUrl}
                  style={styles.sigilImage}
                  resizeMode="cover"
                />
              ) : (
                <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
              )}
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subhead}>One word to seal it</Text>

          {/* Suggestion chips */}
          <View style={styles.chipsRow}>
            {SUGGESTION_WORDS.map((word) => {
              const isActive = word === selectedWord;
              return (
                <TouchableOpacity
                  key={word}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => handleSelectWord(word)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional text input */}
          <TextInput
            style={styles.input}
            placeholder="or type your own…"
            placeholderTextColor={colors.text.tertiary}
            value={customWord}
            onChangeText={(text) => {
              setCustomWord(text);
              if (text) setSelectedWord(undefined);
            }}
            maxLength={32}
            returnKeyType="done"
            onSubmitEditing={handleDone}
          />

          {/* CTAs */}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Done"
            testID="completion-modal-done"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onDone(undefined)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip reflection"
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: 'rgba(10, 13, 18, 0.88)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  sigilArea: {
    width: SIGIL_SIZE * 1.8,
    height: SIGIL_SIZE * 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  glowRing: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.6,
    height: SIGIL_SIZE * 1.6,
    borderRadius: SIGIL_SIZE * 0.8,
    backgroundColor: `${colors.gold}12`,
    borderWidth: 1,
    borderColor: `${colors.gold}30`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  sigilGlowWrap: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.6,
    height: SIGIL_SIZE * 1.6,
  },
  sigilContent: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilImage: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    borderRadius: SIGIL_SIZE / 2,
  },
  headline: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    marginBottom: spacing.xs,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subhead: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${colors.gold}35`,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}1A`,
  },
  chipText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.gold,
    fontFamily: typography.fonts.bodyBold,
  },
  input: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${colors.gold}25`,
    backgroundColor: `${colors.gold}08`,
    color: colors.bone,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  doneButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  doneButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  skipButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
  },
});
