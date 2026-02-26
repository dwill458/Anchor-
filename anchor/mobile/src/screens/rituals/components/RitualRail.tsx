/**
 * RitualRail
 *
 * Horizontal step indicator for the Burn & Release 2-step flow.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type RitualRailStep = 'reflect' | 'release';

export interface RitualRailProps {
  currentStep: RitualRailStep;
}

type StepStatus = 'done' | 'active' | 'pending';

const getStatus = (key: RitualRailStep, currentStep: RitualRailStep): StepStatus => {
  if (key === 'reflect' && currentStep === 'release') return 'done';
  if (key === currentStep) return 'active';
  return 'pending';
};

const StepDot: React.FC<{ status: StepStatus }> = ({ status }) => (
  <View
    style={[
      styles.dot,
      status === 'done' && styles.dotDone,
      status === 'active' && styles.dotActive,
      status === 'pending' && styles.dotPending,
    ]}
  />
);

export const RitualRail: React.FC<RitualRailProps> = ({ currentStep }) => {
  const reflectStatus = getStatus('reflect', currentStep);
  const releaseStatus = getStatus('release', currentStep);

  return (
    <View style={styles.container}>
      <View style={styles.stepItem}>
        <StepDot status={reflectStatus} />
        <Text style={[styles.label, reflectStatus === 'active' && styles.labelActive]}>Reflect</Text>
      </View>

      <View style={styles.connector} />

      <View style={styles.stepItem}>
        <StepDot status={releaseStatus} />
        <Text style={[styles.label, releaseStatus === 'active' && styles.labelActive]}>Release</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: '#C9A84C',
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  dotActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C9A84C',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 3,
  },
  dotPending: {
    backgroundColor: 'rgba(201,168,76,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  connector: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  label: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(232,223,200,0.45)',
  },
  labelActive: {
    color: '#C9A84C',
  },
});

