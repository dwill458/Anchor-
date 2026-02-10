/**
 * Anchor App - Charge Complete Screen
 *
 * Completion screen after successful charging ritual.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from '@/components/common';
import { RitualScaffold } from './components/RitualScaffold';
import { InstructionGlassCard } from './components/InstructionGlassCard';

const { width } = Dimensions.get('window');
const SYMBOL_SIZE = Math.min(width * 0.42, 180);

type ChargeCompleteRouteProp = RouteProp<RootStackParamList, 'ChargeComplete'>;
type ChargeCompleteNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ChargeComplete'
>;

export const ChargeCompleteScreen: React.FC = () => {
  const navigation = useNavigation<ChargeCompleteNavigationProp>();
  const route = useRoute<ChargeCompleteRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 540,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 36,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [fadeAnim, scaleAnim, glowAnim]);

  const handleSaveToVault = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Vault');
  };

  const handleActivateNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ActivationRitual', {
      anchorId,
      activationType: 'visual',
    });
  };

  if (!anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Anchor not found. Returning to vault...</Text>
        </View>
      </RitualScaffold>
    );
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.76],
  });
  const symbolSvg = anchor.reinforcedSigilSvg || anchor.baseSigilSvg;

  return (
    <RitualScaffold>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>

        <Text style={styles.statusTitle}>Anchor Charged</Text>
        <Text style={styles.statusSubtitle}>Your intention is locked in</Text>

        <Animated.View style={[styles.symbolWrapper, { opacity: glowOpacity }]}>
          <View style={styles.symbolHalo} />
          {anchor.enhancedImageUrl ? (
            <OptimizedImage
              uri={anchor.enhancedImageUrl}
              style={styles.symbolImage}
              resizeMode="cover"
            />
          ) : (
            <SvgXml xml={symbolSvg} width={SYMBOL_SIZE} height={SYMBOL_SIZE} />
          )}
        </Animated.View>

        <View style={styles.intentionWrap}>
          <InstructionGlassCard text={`"${anchor.intentionText}"`} />
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveToVault}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Save to Vault</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleActivateNow}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>Activate Now</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.softGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkIcon: {
    fontSize: 36,
    lineHeight: 38,
    color: colors.gold,
    fontWeight: '700',
  },
  statusTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  symbolWrapper: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  symbolHalo: {
    position: 'absolute',
    width: SYMBOL_SIZE * 1.2,
    height: SYMBOL_SIZE * 1.2,
    borderRadius: (SYMBOL_SIZE * 1.2) / 2,
    backgroundColor: colors.ritual.softGlow,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  symbolImage: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    borderRadius: SYMBOL_SIZE / 2,
  },
  intentionWrap: {
    width: '100%',
    maxWidth: 460,
    marginBottom: spacing.xxl,
  },
  ctaSection: {
    width: '100%',
    maxWidth: 460,
    marginTop: 'auto',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.softGlow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 7,
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
