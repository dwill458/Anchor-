/**
 * Distilled Letters Modal Component
 *
 * Educational modal explaining the consonant distillation process
 * using the Austin Osman Spare method.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = width * 0.85;

interface DistilledLettersModalProps {
  visible: boolean;
  onClose: () => void;
  distilledLetters: string[];
}

export const DistilledLettersModal: React.FC<DistilledLettersModalProps> = ({
  visible,
  onClose,
  distilledLetters,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Fade in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.backdropOverlay,
            {
              opacity: fadeAnim,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.glassmorphicCard}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
                  {renderModalContent()}
                </BlurView>
              ) : (
                <View style={styles.androidFallback}>{renderModalContent()}</View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );

  function renderModalContent() {
    return (
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Distilled Letters</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Letters display */}
        <View style={styles.lettersContainer}>
          {distilledLetters.map((letter, index) => (
            <View key={index} style={styles.letterBox}>
              <Text style={styles.letterText}>{letter}</Text>
            </View>
          ))}
        </View>

        {/* Explanation */}
        <Text style={styles.explanation}>
          These are the core consonants your intention was distilled into using the
          Austin Osman Spare method.
        </Text>

        <Text style={styles.explanation}>
          This process removes vowels and duplicate letters, leaving only the essential
          structure of your intention. These letters form the foundation of your sigil's
          geometric pattern.
        </Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    maxWidth: 400,
  },
  glassmorphicCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.3)`,
    backgroundColor:
      Platform.OS === 'ios' ? 'transparent' : 'rgba(26, 26, 29, 0.95)',
  },
  androidFallback: {
    backgroundColor: 'rgba(26, 26, 29, 0.95)',
  },
  content: {
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.gold}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.gold,
    fontWeight: '400',
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  letterBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: `${colors.gold}20`,
    borderWidth: 1,
    borderColor: `${colors.gold}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 24,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    fontWeight: '600',
  },
  explanation: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
});
