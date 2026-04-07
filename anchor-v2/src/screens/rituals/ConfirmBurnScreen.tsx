import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { AlertTriangle } from 'lucide-react-native';

type ConfirmBurnRouteProp = RouteProp<RootStackParamList, 'ConfirmBurn'>;
type ConfirmBurnNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmBurn'>;

const { width } = Dimensions.get('window');
const ANCHOR_SIZE = width * 0.4;
const CONFIRM_TEXT = 'RELEASE';

export const ConfirmBurnScreen: React.FC = () => {
  const route = useRoute<ConfirmBurnRouteProp>();
  const navigation = useNavigation<ConfirmBurnNavigationProp>();

  const { anchorId, intention, sigilSvg } = route.params;
  const [confirmInput, setConfirmInput] = useState('');

  const isConfirmed = confirmInput.toUpperCase() === CONFIRM_TEXT;

  const handleConfirm = (): void => {
    if (!isConfirmed) return;

    AnalyticsService.track(AnalyticsEvents.BURN_INITIATED, {
      anchor_id: anchorId,
      source: 'confirm_burn_screen',
    });

    ErrorTrackingService.addBreadcrumb('User confirmed burn ritual gate', 'navigation', {
      anchor_id: anchorId,
    });

    navigation.navigate('BurningRitual', {
      anchorId,
      intention,
      sigilSvg,
    });
  };

  const handleCancel = (): void => {
    AnalyticsService.track('burn_cancelled', {
      anchor_id: anchorId,
      source: 'confirm_burn_screen',
    });

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.stepTitle}>Sacred Release</Text>
              <View style={styles.divider} />
            </View>

            {/* Step 1: Warning */}
            <View style={styles.warningContainer}>
              <AlertTriangle color={colors.gold} size={32} style={styles.warningIcon} />
              <Text style={styles.warningTitle}>Finality of Completion</Text>
              <Text style={styles.warningText}>
                Burning an anchor is not deletion. It is a sacred act of conscious release.
                By completing this ritual, you are letting go of the intention and allowing its energy to manifest freely in the world.
                {'\n\n'}
                <Text style={{ color: colors.gold, fontWeight: '700' }}>
                  This action is irreversible.
                </Text>
              </Text>
            </View>

            <View style={styles.anchorPreview}>
              <View style={styles.sigilCircle}>
                <SvgXml xml={sigilSvg} width={ANCHOR_SIZE * 0.7} height={ANCHOR_SIZE * 0.7} />
              </View>
              <Text style={styles.intentionText}>"{intention}"</Text>
            </View>

            {/* Step 2: Confirmation Gate */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Type "{CONFIRM_TEXT}" to proceed</Text>
              <TextInput
                style={[styles.input, isConfirmed && styles.inputActive]}
                value={confirmInput}
                onChangeText={setConfirmInput}
                placeholder="........"
                placeholderTextColor="rgba(245, 245, 220, 0.2)"
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.burnButton, !isConfirmed && styles.burnButtonDisabled]}
                onPress={handleConfirm}
                disabled={!isConfirmed}
                activeOpacity={0.8}
              >
                <Text style={styles.burnButtonText}>BEGIN RITUAL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Return to Sanctuary</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy, // Zen Architect Navy
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: colors.gold,
    marginTop: spacing.sm,
    opacity: 0.5,
  },
  warningContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 29, 0.6)', // Charcoal with opacity
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  warningIcon: {
    marginBottom: spacing.md,
  },
  warningTitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  warningText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  anchorPreview: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  sigilCircle: {
    width: ANCHOR_SIZE,
    height: ANCHOR_SIZE,
    borderRadius: ANCHOR_SIZE / 2,
    backgroundColor: 'rgba(15, 20, 25, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    marginBottom: spacing.md,
  },
  intentionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.8,
  },
  inputContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  inputLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    textAlign: 'center',
    fontFamily: typography.fonts.body,
    fontSize: 24,
    color: colors.gold,
    letterSpacing: 4,
  },
  inputActive: {
    borderBottomColor: colors.gold,
    borderBottomWidth: 2,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  burnButton: {
    width: '100%',
    backgroundColor: colors.gold,
    paddingVertical: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
    // Gold glow effect
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  burnButtonDisabled: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  burnButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.button,
    color: colors.navy,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cancelButton: {
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    textDecorationLine: 'underline',
  },
});
