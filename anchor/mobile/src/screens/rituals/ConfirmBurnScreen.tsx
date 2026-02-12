/**
 * Anchor App - Complete & Release Confirm Screen
 *
 * Zen Architect redesign: transform destruction into a calm ritual of release.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { ScrollView } from 'react-native-gesture-handler';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { OptimizedImage } from '@/components/common/OptimizedImage';

type ConfirmBurnRouteProp = RouteProp<RootStackParamList, 'ConfirmBurn'>;
type ConfirmBurnNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmBurn'>;

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ANCHOR_SIZE = width * 0.45;
const IS_SMALL_DEVICE = SCREEN_HEIGHT < 700;

export const ConfirmBurnScreen: React.FC = () => {
  const route = useRoute<ConfirmBurnRouteProp>();
  const navigation = useNavigation<ConfirmBurnNavigationProp>();
  const { anchorId, intention, sigilSvg, enhancedImageUrl } = route.params as any;

  const [modalVisible, setModalVisible] = useState(false);

  // Animation values
  const floatValue = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
    floatValue.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const animatedSigilStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatValue.value }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleShowConfirmation = (): void => {
    setModalVisible(true);
  };

  const handleFinalConfirm = (): void => {
    setModalVisible(false);
    AnalyticsService.track(AnalyticsEvents.BURN_INITIATED, {
      anchor_id: anchorId,
      source: 'confirm_burn_screen',
    });

    ErrorTrackingService.addBreadcrumb('User confirmed release ritual', 'navigation', {
      anchor_id: anchorId,
    });

    navigation.navigate('BurningRitual', {
      anchorId,
      intention,
      sigilSvg,
      enhancedImageUrl,
    } as any);
  };

  const handleCancel = (): void => {
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, animatedContentStyle]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.title}>Complete & Release</Text>

          {/* Sigil or Enhanced Image with floating animation */}
          <Animated.View style={[styles.anchorContainer, animatedSigilStyle]}>
            {enhancedImageUrl ? (
              <OptimizedImage
                uri={enhancedImageUrl}
                style={[styles.enhancedImage, { width: ANCHOR_SIZE, height: ANCHOR_SIZE }]}
              />
            ) : (
              <SvgXml xml={sigilSvg} width={ANCHOR_SIZE} height={ANCHOR_SIZE} />
            )}
          </Animated.View>

          <Text style={styles.intention}>“{intention}”</Text>

          {/* Why Release? card */}
          <View style={styles.cardContainer}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint="dark" style={styles.glassCard}>
                {renderRitualText()}
              </BlurView>
            ) : (
              <View style={[styles.glassCard, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
                {renderRitualText()}
              </View>
            )}
          </View>

          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>
              Has this anchor fulfilled its role?
            </Text>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleShowConfirmation}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Release Anchor"
          >
            <Text style={styles.primaryButtonText}>Release Anchor</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Confirmation Overlay (Custom Modal for better Android stability) */}
      {modalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={handleCancel}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]} />
            )}
            <View
              style={styles.modalContent}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                <View>
                  <Text style={styles.modalTitle}>Final Intent</Text>
                  <Text style={styles.modalBody}>
                    This ritual will permanently archive this anchor and its sigil within your psyche. Energy once released cannot be recalled.
                  </Text>
                  <Text style={styles.modalQuestion}>Do you wish to proceed?</Text>

                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={handleFinalConfirm}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Release Forever"
                  >
                    <Text style={styles.modalConfirmText}>Release Forever</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Return"
                  >
                    <Text style={styles.modalCancelText}>Return</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );

  function renderRitualText() {
    return (
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>Why release?</Text>
        <Text style={styles.cardBody}>
          In chaos magick, performing a final ritual of release after completion allows your unconscious to fully integrate the work. By letting go, you free the energy to sustain your intention in reality.
        </Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  anchorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IS_SMALL_DEVICE ? spacing.md : spacing.xl,
    padding: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  enhancedImage: {
    borderRadius: ANCHOR_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  intention: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: IS_SMALL_DEVICE ? spacing.xl : spacing.xxxl,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  cardContainer: {
    width: '100%',
    marginBottom: spacing.xxl,
  },
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
  },
  androidCard: {
    backgroundColor: colors.ritual.glassStrong,
  },
  cardContent: {
    padding: spacing.xl,
  },
  cardTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.primary,
    lineHeight: 22,
  },
  questionContainer: {
    marginBottom: IS_SMALL_DEVICE ? spacing.lg : spacing.xxl,
  },
  questionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.gold,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // Fallback and dimming
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.ritual.glassStrong,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  modalBody: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  modalQuestion: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.body1,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalConfirmButton: {
    backgroundColor: colors.gold,
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    fontWeight: '700',
  },
  modalCancelButton: {
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
});
