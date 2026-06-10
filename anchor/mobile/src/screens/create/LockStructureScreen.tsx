import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  BackHandler,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { RootStackParamList, ReinforcementMetadata } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';

type LockStructureRouteProp = RouteProp<RootStackParamList, 'LockStructure'>;
type LockStructureNavigationProp = StackNavigationProp<RootStackParamList, 'LockStructure'>;

const AUTO_ADVANCE_DELAY_MS = 2500;

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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const isShortLayout = isShortPhoneViewport(height);
  const structureSize = Math.min(
    width - (isCompactLayout ? 72 : 96),
    isCompactLayout ? 260 : isShortLayout ? 288 : 320
  );

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
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasReinforced = reinforcementMetadata?.completed ?? false;
  const wasSkipped = reinforcementMetadata?.skipped ?? false;
  const fidelityScore = reinforcementMetadata?.fidelityScore ?? 0;
  const displaySvg = reinforcedSigilSvg || baseSigilSvg;

  const handleContinue = useCallback(() => {
    navigation.navigate('EnhancementChoice', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg: reinforcedSigilSvg || undefined,
      structureVariant,
      reinforcementMetadata,
    });
  }, [
    navigation,
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  ]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('ManualReinforcement', {
      source: 'creation',
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      structureVariant,
    });
  }, [
    navigation,
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    structureVariant,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [handleBack])
  );

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
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          handleContinue();
        }, AUTO_ADVANCE_DELAY_MS);
      });
    });
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, [
    fadeAnim,
    scaleAnim,
    lockFadeAnim,
    handleContinue,
  ]);

  const getSupportingCopy = () => {
    return 'This structure will hold your Anchor steady.';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[
          styles.content,
          isCompactLayout && styles.contentCompact,
          isShortLayout && styles.contentShort,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, isCompactLayout && styles.headerCompact]}>
          <Text style={[styles.title, isCompactLayout && styles.titleCompact]}>Foundation set</Text>
          <Text style={[styles.subtitle, isCompactLayout && styles.subtitleCompact]}>{getSupportingCopy()}</Text>
        </View>

        {/* Structure Display */}
        <Animated.View
          style={[
            styles.structureContainer,
            isCompactLayout && styles.structureContainerCompact,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.structureFrame, { width: structureSize, height: structureSize }]}>
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
    justifyContent: 'center',
  },
  contentCompact: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.xl + spacing.md,
  },
  contentShort: {
    paddingTop: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    maxWidth: 320,
  },
  headerCompact: {
    marginBottom: spacing.lg,
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
  titleCompact: {
    fontSize: 24,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 16,
    color: '#9B9B9B',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  structureContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
    position: 'relative',
  },
  structureContainerCompact: {
    marginBottom: spacing.xl,
  },
  structureFrame: {
    backgroundColor: 'transparent',
    borderRadius: spacing.md,
    borderWidth: 3,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
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
    paddingHorizontal: spacing.sm,
  },
  metadataText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: '#626262',
    textAlign: 'center',
    lineHeight: 18,
  },
});
