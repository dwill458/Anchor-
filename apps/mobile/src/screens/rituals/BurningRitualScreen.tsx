/**
 * Anchor App - Completion Ritual Screen
 *
 * 6-second completion animation for anchor release.
 * Fades and shrinks sigil with emotional prompts.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { del } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useToast } from '@/components/ToastProvider';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIGIL_SIZE = SCREEN_WIDTH * 0.6;

const COMPLETION_DURATION = 6000; // 6 seconds
const PROMPTS = [
  { text: 'Let go.', delay: 2000 },
  { text: 'Trust the process.', delay: 3500 },
  { text: 'Your intention has been released.', delay: 5000 },
];

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  const toast = useToast();

  const { anchorId, intention, sigilSvg } = route.params;
  const { removeAnchor } = useAnchorStore();

  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const promptOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startCompletionSequence();
  }, []);

  const startCompletionSequence = async () => {
    // Initial deep haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Sigil fade/scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: COMPLETION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: COMPLETION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();

    // Show prompts at timed intervals
    PROMPTS.forEach((prompt) => {
      setTimeout(() => {
        setCurrentPrompt(prompt.text);

        // Fade in prompt
        Animated.sequence([
          Animated.timing(promptOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();

        // Light haptic with each prompt
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, prompt.delay);
    });

    // Complete after burn duration
    setTimeout(() => {
      handleComplete();
    }, COMPLETION_DURATION + 1000);
  };

  const handleComplete = async (): Promise<void> => {
    if (isArchiving) return; // Prevent duplicate calls

    setIsArchiving(true);

    try {
      // Track burn completion
      AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, {
        anchor_id: anchorId,
      });

      ErrorTrackingService.addBreadcrumb('Archiving anchor via API', 'api', {
        anchor_id: anchorId,
      });

      // Call backend API to archive anchor
      await del(`/api/anchors/${anchorId}`);

      // Remove from local store
      removeAnchor(anchorId);

      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success toast
      toast.success('Anchor released and archived successfully');

      // Navigate back to vault
      navigation.navigate('Vault');
    } catch (error) {
      // Log error to tracking service
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Unknown error during anchor archiving'),
        {
          screen: 'BurningRitualScreen',
          action: 'archive_anchor',
          anchor_id: anchorId,
        }
      );

      AnalyticsService.track(AnalyticsEvents.BURN_FAILED, {
        anchor_id: anchorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Show error toast
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to archive anchor. Please try again.'
      );

      // Still navigate back even if there's an error
      navigation.navigate('Vault');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Burning sigil */}
        <Animated.View
          style={[
            styles.sigilContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
        </Animated.View>

        {/* Prompts */}
        <Animated.View
          style={[
            styles.promptContainer,
            { opacity: promptOpacity },
          ]}
        >
          <Text style={styles.promptText}>{currentPrompt}</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  sigilContainer: {
    marginBottom: spacing.xxxl,
  },
  promptContainer: {
    paddingHorizontal: spacing.xl,
  },
  promptText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h3,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 32,
  },
});
