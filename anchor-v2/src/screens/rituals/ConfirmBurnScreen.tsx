/**
 * Anchor App - Confirm Burn Screen
 *
 * Warning screen before permanently archiving an anchor.
 * Explains Phil Cooper's chaos magick principle of destruction after success.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';

type ConfirmBurnRouteProp = RouteProp<RootStackParamList, 'ConfirmBurn'>;
type ConfirmBurnNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmBurn'>;

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.5;

export const ConfirmBurnScreen: React.FC = () => {
  const route = useRoute<ConfirmBurnRouteProp>();
  const navigation = useNavigation<ConfirmBurnNavigationProp>();

  const { anchorId, intention, sigilSvg } = route.params;

  const handleConfirm = () => {
    navigation.navigate('BurningRitual', {
      anchorId,
      intention,
      sigilSvg,
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Sigil preview */}
        <View style={styles.sigilContainer}>
          <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
        </View>

        <Text style={styles.intention}>"{intention}"</Text>

        {/* Warning box */}
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Warning</Text>
            <Text style={styles.warningText}>
              This will permanently archive this anchor.
              {'\n\n'}
              According to chaos magick, destroying a sigil after success helps the unconscious work freely.
            </Text>
          </View>
        </View>

        {/* Question box */}
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>
            Has this intention been fulfilled or served its purpose?
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.burnButton}
          onPress={handleConfirm}
          activeOpacity={0.7}
        >
          <Text style={styles.burnButtonText}>🔥 BURN & RELEASE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sigilContainer: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: SIGIL_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  intention: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.gold,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xl,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.error,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  warningText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.primary,
    lineHeight: 20,
  },
  questionBox: {
    backgroundColor: `${colors.gold}15`,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.xxl,
  },
  questionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    lineHeight: 22,
  },
  burnButton: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    marginBottom: spacing.md,
  },
  burnButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.button,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
