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

type LockStructureRouteProp = RouteProp<RootStackParamList, 'LockStructure'>;
type LockStructureNavigationProp = StackNavigationProp<RootStackParamList, 'LockStructure'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STRUCTURE_SIZE = SCREEN_WIDTH - 96;

/**
 * LockStructureScreen
 *
 * Step 5 in the architecture: Foundation resolution screen.
 *
 * Displays the final locked structure in a calm, grounded state.
 * This screen communicates finality and permission to stop thinking.
 * Uses deep charcoal background to signal completion and stillness.
 *
 * Design principle: "The foundation is set. You can stop thinking."
 * This is a period, not an ellipsis.
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
  const [scaleAnim] = useState(new Animated.Value(0.98));
  const [lockFadeAnim] = useState(new Animated.Value(0));

  const wasReinforced = reinforcementMetadata?.completed ?? false;
  const wasSkipped = reinforcementMetadata?.skipped ?? false;
  const fidelityScore = reinforcementMetadata?.fidelityScore ?? 0;
  const displaySvg = reinforcedSigilSvg || baseSigilSvg;

  useEffect(() => {
    // Phase 1 & 2: Symbol appears (200-600ms)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 3: Lock appears after symbol settles (700-1000ms)
      Animated.timing(lockFadeAnim, {
        toValue: 1,
        duration: 300,
        delay: 100,
        useNativeDriver: true,
      }).start(() => {
        // Auto-advance after pause for comfortable reading (total ~4 seconds)
        setTimeout(() => {
          handleContinue();
        }, 2500);
      });
    });
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

  const getSupportingCopy = () => {
    return 'This structure will hold your Anchor steady.';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Foundation set</Text>
          <Text style={styles.subtitle}>{getSupportingCopy()}</Text>
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
          <Animated.View
            style={[
              styles.lockBadge,
              {
                opacity: lockFadeAnim,
              },
            ]}
          >
            <Text style={styles.lockIcon}>🔒</Text>
          </Animated.View>
        </Animated.View>

        {/* Metadata - Single muted line */}
        <View style={styles.metadataSection}>
          <Text style={styles.metadataText}>
            {getVariantDisplayName(structureVariant)} structure · Letters: {distilledLetters.join(' ')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Helper function
function getVariantDisplayName(variant: string): string {
  const names: Record<string, string> = {
    dense: 'Dense',
    balanced: 'Balanced',
    minimal: 'Minimal',
  };
  return names[variant] || variant;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.charcoal,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 2,
    alignItems: 'center',
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    fontWeight: '500',
    color: '#E8E8E8',
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 16,
    color: '#9B9B9B',
    textAlign: 'center',
  },
  structureContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
    position: 'relative',
  },
  structureFrame: {
    width: STRUCTURE_SIZE,
    height: STRUCTURE_SIZE,
    backgroundColor: 'transparent',
    borderRadius: spacing.md,
    borderWidth: 3,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.charcoal,
  },
  lockIcon: {
    fontSize: 24,
  },
  metadataSection: {
    marginBottom: spacing.xl,
  },
  metadataText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: '#626262',
    textAlign: 'center',
  },
});
