import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import type { GenerationFailureKind } from '@/services/AnchorGenerationService';
import { DESIGN_WIDTH } from '../creationFlowConfig';

interface FormFailureProps {
  kind: GenerationFailureKind;
  onRetry: () => void;
  onBackToStyle: () => void;
}

/**
 * The generation failed. Same semantics as the generating screen: a lost connection offers Retry;
 * any other failure offers Try again and a way back to the style step with the choice intact.
 */
export function FormFailure({ kind, onRetry, onBackToStyle }: FormFailureProps) {
  const connection = kind === 'connection';
  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <Text style={styles.title}>{connection ? 'Connection Lost' : 'Generation paused'}</Text>
      <Text style={styles.body}>{connection ? 'Your choices are saved.' : 'Your structure and style are still here.'}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={connection ? 'Retry generation' : 'Try generating again'}
          style={styles.primary}
        >
          <Text style={styles.primaryLabel}>{connection ? 'Retry' : 'Try Again'}</Text>
        </Pressable>
        {!connection ? (
          <Pressable
            onPress={onBackToStyle}
            accessibilityRole="button"
            accessibilityLabel="Back to style"
            style={styles.secondary}
          >
            <Text style={styles.secondaryLabel}>Back to Style</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** After a long wait the person can retry without waiting out the full timeout. */
export function SlowRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry"
      hitSlop={14}
      style={styles.slowRetry}
    >
      <Text style={styles.slowRetryLabel}>Retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    width: DESIGN_WIDTH,
    top: 340,
    paddingHorizontal: 35,
    alignItems: 'center',
  },
  title: { fontFamily: 'EBGaramond-Regular', fontSize: 24, color: colors.creation.cream, textAlign: 'center' },
  body: {
    fontFamily: 'EBGaramond-Italic',
    fontSize: 16,
    color: colors.creation.cream,
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 12,
  },
  actions: { width: '100%', gap: 10, marginTop: 28 },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.creation.cream,
  },
  primaryLabel: { fontFamily: 'Figtree-SemiBold', fontSize: 14, color: colors.creation.ink },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.creation.cream,
    opacity: 0.8,
  },
  secondaryLabel: { fontFamily: 'Figtree-SemiBold', fontSize: 14, color: colors.creation.cream },
  slowRetry: { position: 'absolute', left: 0, width: DESIGN_WIDTH, top: 804, alignItems: 'center' },
  slowRetryLabel: {
    fontFamily: 'Figtree-SemiBold',
    fontSize: 13,
    color: colors.creation.cream,
    opacity: 0.85,
    textDecorationLine: 'underline',
  },
});
