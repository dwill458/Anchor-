import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { RootStackParamList, ReinforcementMetadata } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';

type LockStructureRouteProp = RouteProp<RootStackParamList, 'LockStructure'>;
type LockStructureNavigationProp = StackNavigationProp<RootStackParamList, 'LockStructure'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STRUCTURE_SIZE = SCREEN_WIDTH - 96;

/**
 * LockStructureScreen
 *
 * Step 5 in the new architecture: Structure confirmation & celebration.
 *
 * Displays the final locked structure (either reinforced or base) and celebrates
 * the user's work. Shows fidelity score if reinforcement was completed.
 * This is the "commitment moment" where the structure becomes the immutable
 * foundation of the anchor.
 *
 * Next: EnhancementChoiceScreen (choose to keep pure or add AI styling)
 */
export default function LockStructureScreen() {
  const route = useRoute<LockStructureRouteProp>();
  const navigation = useNavigation<LockStructureNavigationProp>();

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  } = route.params;

  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  const wasReinforced = reinforcementMetadata?.completed ?? false;
  const wasSkipped = reinforcementMetadata?.skipped ?? false;
  const fidelityScore = reinforcementMetadata?.fidelityScore ?? 0;
  const displaySvg = reinforcedSigilSvg || baseSigilSvg;

  useEffect(() => {
    // Animate structure appearance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = () => {
    navigation.navigate('EnhancementChoice', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg: reinforcedSigilSvg || undefined,
      structureVariant,
      reinforcementMetadata,
    });
  };

  const getCelebrationMessage = () => {
    if (wasReinforced) {
      if (fidelityScore >= 90) {
        return 'Masterful reinforcement! Your intention flows through every stroke.';
      } else if (fidelityScore >= 75) {
        return 'Excellent work! Your structure is infused with intentional energy.';
      } else if (fidelityScore >= 50) {
        return 'Well done! Your personal touch has been captured.';
      } else {
        return 'Your unique interpretation has been preserved.';
      }
    } else if (wasSkipped) {
      return 'Your structure stands ready, born of pure mathematics and ancient symbols.';
    } else {
      return 'Structure locked and ready for the next phase.';
    }
  };

  const getTitle = () => {
    if (wasReinforced) {
      return 'Structure Reinforced & Locked';
    } else {
      return 'Structure Locked';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ZenBackground />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>This foundation is now immutable</Text>
        </View>

        {/* Structure Display */}
        <Animated.View
          style={[
            styles.structureContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.structureFrame}>
            <SvgXml xml={displaySvg} width="90%" height="90%" color={colors.gold} />
          </View>

          {/* Lock Icon Overlay */}
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        </Animated.View>

        {/* Fidelity Score (if reinforced) */}
        {wasReinforced && (
          <View style={styles.scoreSection}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Reinforcement Fidelity</Text>
              <Text style={[styles.scoreValue, { color: getFidelityColor(fidelityScore) }]}>
                {fidelityScore}%
              </Text>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${fidelityScore}%`,
                      backgroundColor: getFidelityColor(fidelityScore),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Celebration Message */}
        <View style={styles.messageSection}>
          <Text style={styles.celebrationMessage}>{getCelebrationMessage()}</Text>
        </View>

        {/* Structure Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Structure Variant:</Text>
            <Text style={styles.detailValue}>{getVariantDisplayName(structureVariant)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distilled Letters:</Text>
            <Text style={styles.detailValue}>{distilledLetters.join(', ')}</Text>
          </View>

          {wasReinforced && reinforcementMetadata && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Strokes:</Text>
                <Text style={styles.detailValue}>{reinforcementMetadata.strokeCount}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time Spent:</Text>
                <Text style={styles.detailValue}>
                  {formatTimeSpent(reinforcementMetadata.timeSpentMs)}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue to Enhancement</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Helper functions
function getFidelityColor(score: number): string {
  if (score >= 75) return colors.success;
  if (score >= 50) return colors.gold;
  return colors.text.tertiary;
}

function getVariantDisplayName(variant: string): string {
  const names: Record<string, string> = {
    dense: 'Dense',
    balanced: 'Balanced',
    minimal: 'Minimal',
  };
  return names[variant] || variant;
}

function formatTimeSpent(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  structureContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  structureFrame: {
    width: STRUCTURE_SIZE,
    height: STRUCTURE_SIZE,
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    borderWidth: 3,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    // Add glow effect
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  lockBadge: {
    position: 'absolute',
    top: -12,
    right: SCREEN_WIDTH / 2 - STRUCTURE_SIZE / 2 - 12,
    backgroundColor: colors.deepPurple,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  lockIcon: {
    fontSize: 24,
  },
  scoreSection: {
    marginBottom: spacing.lg,
  },
  scoreCard: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.navy,
  },
  scoreLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  scoreValue: {
    fontFamily: typography.fonts.heading,
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  scoreBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.navy,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  messageSection: {
    marginBottom: spacing.lg,
  },
  celebrationMessage: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  detailsSection: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.navy,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy,
  },
  detailLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
  detailValue: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.bone,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.charcoal,
    borderTopWidth: 1,
    borderTopColor: colors.navy,
  },
  continueButton: {
    backgroundColor: colors.gold,
    height: 56,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    color: colors.charcoal,
  },
});
