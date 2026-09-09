import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';

export interface V2ProgressHeroProps {
  model: V2ProgressModel;
  testID?: string;
}

export const V2ProgressHero: React.FC<V2ProgressHeroProps> = ({ model, testID = 'v2-progress-hero' }) => {
  const { intention, category, threadStrength, unmeasured, qualitativeLabel, highestEvolutionStage } = model;

  const size = 130;
  const strokeWidth = 8;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = unmeasured ? 0 : (threadStrength / 100) * circumference;

  return (
    <View style={styles.container} testID={testID} accessible accessibilityRole="header">
      {category ? <Text style={styles.categoryEyebrow}>{category.toUpperCase()}</Text> : null}
      <Text style={styles.intentionText} numberOfLines={2}>
        {intention}
      </Text>

      {/* Living Color Thread Strength Visual */}
      <View style={styles.ringContainer}>
        {/* Soft atmospheric aura glow */}
        <View style={styles.auraGlow} />

        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <LinearGradient id="heroThreadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#8EE0CF" />
              <Stop offset="30%" stopColor="#41C8C6" />
              <Stop offset="70%" stopColor="#6C90F3" />
              <Stop offset="100%" stopColor="#FFA32C" />
            </LinearGradient>
          </Defs>

          {/* Background rail */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />

          {/* Active Progress Ring */}
          {!unmeasured && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#heroThreadGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${progress} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>

        <View style={styles.ringContentCenter}>
          <Text style={styles.strengthNumber}>
            {unmeasured ? '—' : threadStrength}
          </Text>
          <Text style={styles.strengthScale}>/ 100</Text>
        </View>
      </View>

      <View style={styles.stageTag}>
        <Text style={styles.stageTagText}>{qualitativeLabel}</Text>
        <Text style={styles.stageSubtext}>Permanent structure: {highestEvolutionStage}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: '#0F1218',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.md,
  },
  categoryEyebrow: {
    ...typography.labelSM,
    color: '#41C8C6',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  intentionText: {
    ...typography.headingMD,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  ringContainer: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: spacing.md,
  },
  auraGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(65, 200, 198, 0.12)',
  },
  ringContentCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthNumber: {
    ...typography.numericLarge,
    color: colors.text.primary,
  },
  strengthScale: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  stageTag: {
    alignItems: 'center',
  },
  stageTagText: {
    ...typography.headingSM,
    color: '#8EE0CF',
    marginBottom: 2,
  },
  stageSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
