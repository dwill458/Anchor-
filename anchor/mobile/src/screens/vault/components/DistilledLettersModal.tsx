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

        {/* Body Copy */}
        <Text style={styles.bodyText}>
          These letters are the essence of your intention.
          We’ve removed excess language to reveal its core structure.
        </Text>

        <Text style={[styles.bodyText, { marginBottom: spacing.xl }]}>
          This distilled form becomes the blueprint for your anchor’s shape.
        </Text>

        {/* Helper Text */}
        <Text style={styles.helperText}>Based on traditional sigil methods</Text>
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
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.2)`,
    backgroundColor:
      Platform.OS === 'ios' ? 'transparent' : 'rgba(15, 15, 18, 0.95)',
  },
  androidFallback: {
    backgroundColor: 'rgba(15, 15, 18, 0.95)',
  },
  content: {
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontFamily: typography.fonts.headingSemiBold,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.gold,
    fontWeight: '300',
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  letterBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 24,
    fontFamily: typography.fonts.headingSemiBold,
    color: colors.gold,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: typography.fonts.body,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 26,
    marginBottom: spacing.lg,
    textAlign: 'left',
  },
  helperText: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
