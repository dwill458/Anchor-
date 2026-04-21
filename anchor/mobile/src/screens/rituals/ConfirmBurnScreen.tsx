/**
 * Anchor App - Burn & Release Ceremony Screen
 *
 * 2-step ritual flow: Reflect -> Release
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { ChargedGlowCanvas, OptimizedImage } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import { RitualRail, type RitualRailStep } from './components/RitualRail';
import { ReleaseInput } from './components/ReleaseInput';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useTeachingStore } from '@/stores/teachingStore';
import { TEACHINGS } from '@/constants/teaching';
import { useAnchorStore } from '@/stores/anchorStore';
import { resolveBurnArtworkUri } from './utils/resolveBurnArtworkUri';

type ConfirmBurnRouteProp = RouteProp<RootStackParamList, 'ConfirmBurn'>;
type ConfirmBurnNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmBurn'>;

type BurnStep = 'reflect' | 'release';

const TARGET_WORD = 'RELEASE';
const SIGIL_STAGE_SIZE = 240;
const SIGIL_IMAGE_INSET = 20;
const IS_TEST_ENV = Boolean(process.env.JEST_WORKER_ID);

export const ConfirmBurnScreen: React.FC = () => {
  const route = useRoute<ConfirmBurnRouteProp>();
  const navigation = useNavigation<ConfirmBurnNavigationProp>();
  const { anchorId, intention, sigilSvg, enhancedImageUrl } = route.params;
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const { recordShown } = useTeachingStore();
  const anchor = getAnchorById(anchorId);
  const resolvedSigilSvg = sigilSvg || anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '';
  const resolvedEnhancedImageUrl = enhancedImageUrl ?? resolveBurnArtworkUri(anchor);

  const [currentStep, setCurrentStep] = useState<BurnStep>('reflect');
  const [releaseText, setReleaseText] = useState('');

  const isReleaseReady = releaseText === TARGET_WORD;

  const reflectTeaching = useTeachingGate({
    screenId: 'confirm_burn_reflect',
    candidateIds: ['confirm_burn_reflect_v1'],
  });
  const releaseTeaching = useTeachingGate({
    screenId: 'confirm_burn_release',
    candidateIds: ['confirm_burn_release_v1'],
  });

  useEffect(() => {
    if (!reflectTeaching) return;
    const content = TEACHINGS[reflectTeaching.teachingId];
    recordShown(reflectTeaching.teachingId, reflectTeaching.pattern, content?.maxShows ?? 1);
    AnalyticsService.track('teaching_shown', {
      teaching_id: reflectTeaching.teachingId,
      pattern: reflectTeaching.pattern,
      screen: 'confirm_burn',
      trigger: reflectTeaching.trigger,
      guide_mode: true,
    });
  }, [recordShown, reflectTeaching]);

  const activeTeaching = currentStep === 'reflect' ? reflectTeaching : releaseTeaching;

  const sigilNode = useMemo(() => {
    if (resolvedEnhancedImageUrl) {
      return (
        <OptimizedImage
          uri={resolvedEnhancedImageUrl}
          style={styles.sigilImage}
          resizeMode="cover"
        />
      );
    }

    if (resolvedSigilSvg) {
      return (
        <SvgXml
          xml={resolvedSigilSvg}
          width={SIGIL_STAGE_SIZE - 62}
          height={SIGIL_STAGE_SIZE - 62}
        />
      );
    }

    return <Text style={styles.sigilFallback}>✶</Text>;
  }, [resolvedEnhancedImageUrl, resolvedSigilSvg]);

  const handleBack = () => {
    if (currentStep === 'release') {
      setCurrentStep('reflect');
      setReleaseText('');
      return;
    }
    navigation.goBack();
  };

  const handleContinue = () => {
    if (currentStep === 'reflect') {
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep('release');
      return;
    }

    if (!isReleaseReady) return;

    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

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
      sigilSvg: resolvedSigilSvg,
      enhancedImageUrl: resolvedEnhancedImageUrl,
    } as any);
  };

  const handleReleaseInput = (value: string) => {
    const upper = value.toUpperCase();
    let accepted = '';

    for (let i = 0; i < upper.length && i < TARGET_WORD.length; i += 1) {
      if (upper[i] !== TARGET_WORD[i]) break;
      accepted += upper[i];
    }

    setReleaseText(accepted);
  };

  const ctaLabel = currentStep === 'reflect' ? 'Continue' : 'Burn Now';
  const ctaDisabled = currentStep === 'release' && !isReleaseReady;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Burn & Release</Text>
      </View>

      <View style={styles.content}>
        {currentStep === 'reflect' ? (
          <View style={styles.reflectBody}>
            <Text style={styles.reflectLabel}>Completed intention</Text>

            <View style={styles.sigilStage}>
              {!IS_TEST_ENV ? (
                <View style={[StyleSheet.absoluteFill, { left: -50, right: -50, top: -50, bottom: -50 }]}>
                  <ChargedGlowCanvas size={SIGIL_STAGE_SIZE + 100} />
                </View>
              ) : null}
              <View style={styles.sigilInner}>{sigilNode}</View>
            </View>

            <Text style={styles.intentionText}>"{intention}"</Text>
            <Text style={styles.reflectHint}>
              Sit with this symbol. Remember the journey it held. When you are ready, release it
              to the flame.
            </Text>
          </View>
        ) : (
          <View style={styles.releaseBody}>
            <Text style={styles.releaseTitle}>Final Seal</Text>
            <Text style={styles.releaseSubtitle}>Typing RELEASE closes the loop permanently.</Text>
            <ReleaseInput value={releaseText} onChangeText={handleReleaseInput} autoFocus={true} />
            <Text style={styles.ritualQuote}>
              The act of spelling it aloud, even in silence, is part of the rite. It asks for your
              full presence.
            </Text>
          </View>
        )}

        {activeTeaching ? (
          <Text style={styles.undertoneText} accessibilityRole="text">
            {activeTeaching.copy}
          </Text>
        ) : null}
      </View>

      <RitualRail currentStep={currentStep as RitualRailStep} />

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={ctaDisabled}
          activeOpacity={0.86}
          style={[styles.ctaButton, ctaDisabled && styles.ctaButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: ctaDisabled }}
        >
          <LinearGradient
            colors={['#C9A84C', '#A07830']}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {currentStep === 'release' ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.ghostButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Not yet"
          >
            <Text style={styles.ghostText}>Not yet</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#C9A84C',
    fontSize: 22,
    lineHeight: 24,
  },
  headerTitle: {
    color: '#C9A84C',
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
    overflow: 'visible',
  },
  reflectBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  reflectLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 4.6,
    color: '#C9A84C',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sigilStage: {
    width: SIGIL_STAGE_SIZE,
    height: SIGIL_STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  sigilInner: {
    position: 'absolute',
    top: SIGIL_IMAGE_INSET,
    left: SIGIL_IMAGE_INSET,
    right: SIGIL_IMAGE_INSET,
    bottom: SIGIL_IMAGE_INSET,
    borderRadius: (SIGIL_STAGE_SIZE - SIGIL_IMAGE_INSET * 2) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,200,60,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(14,18,26,0.94)',
    shadowColor: '#FFB41E',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  sigilImage: {
    width: SIGIL_STAGE_SIZE - SIGIL_IMAGE_INSET * 2,
    height: SIGIL_STAGE_SIZE - SIGIL_IMAGE_INSET * 2,
    borderRadius: (SIGIL_STAGE_SIZE - SIGIL_IMAGE_INSET * 2) / 2,
  },
  sigilFallback: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 42,
    color: '#C9A84C',
    opacity: 0.65,
  },
  intentionText: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 22,
    lineHeight: 31,
    color: '#E8DFC8',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  reflectHint: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 13,
    lineHeight: 21,
    color: 'rgba(232,223,200,0.45)',
    textAlign: 'center',
    maxWidth: 240,
  },
  releaseBody: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  releaseTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 26,
    lineHeight: 32,
    color: '#E8DFC8',
    textAlign: 'center',
    letterSpacing: 1,
  },
  releaseSubtitle: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(232,223,200,0.45)',
    textAlign: 'center',
    maxWidth: 260,
  },
  ritualQuote: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 14,
    lineHeight: 24,
    color: 'rgba(232,223,200,0.45)',
    textAlign: 'center',
    maxWidth: 260,
  },
  undertoneText: {
    marginTop: spacing.lg,
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: 'center',
    opacity: 0.88,
  },
  footer: {
    paddingBottom: 40,
  },
  ctaButton: {
    marginHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  ctaButtonDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  ctaText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    color: '#0A0D14',
  },
  ghostButton: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ghostText: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 14,
    color: 'rgba(232,223,200,0.45)',
  },
});
