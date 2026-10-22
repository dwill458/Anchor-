import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';
import { APPROVED_MILESTONE_ASSETS } from '@/milestones/approvedAssets';
import { ApprovedMilestoneSvg } from '@/milestones/approvedAssetsRenderer';
import { getMilestoneSpec } from '@/milestones/registry';
import { ApprovedMilestoneReveal } from './ApprovedMilestoneReveal';

export interface MilestoneArtworkProps {
  definitionId: string;
  state: 'earned' | 'locked';
  size: number;
  /** Retained for callers; the approved master owns its palette. */
  categoryColor?: string;
  testID?: string;
  animated?: boolean;
  progress?: SharedValue<number>;
  reducedMotion?: boolean;
}

export const MilestoneArtwork: React.FC<MilestoneArtworkProps> = React.memo(
  ({ definitionId, state, size, testID = 'milestone-artwork', animated, progress, reducedMotion }) => {
    const spec = getMilestoneSpec(definitionId);
    const asset = APPROVED_MILESTONE_ASSETS[definitionId];
    return (
      <View style={{ width: size, height: size }} accessible
        accessibilityLabel={`${spec?.title ?? 'Milestone'} artwork, ${state}`}
        testID={`${testID}-${state}`}>
        {asset ? (
          animated && progress && state === 'earned' ? (
            <ApprovedMilestoneReveal definitionId={definitionId} size={size} progress={progress} reducedMotion={reducedMotion} />
          ) : <ApprovedMilestoneSvg definitionId={definitionId} state={state} size={size} />
        ) : (
          <>
            <Svg width={size} height={size} viewBox="0 0 256 256">
              <Circle cx={128} cy={128} r={90} fill="none" stroke="#8C867A" strokeWidth={3} strokeDasharray="4 4" />
            </Svg>
            <View style={styles.fallbackFlag} testID={`${testID}-fallback`} />
          </>
        )}
      </View>
    );
  },
);
MilestoneArtwork.displayName = 'MilestoneArtwork';

const styles = StyleSheet.create({
  fallbackFlag: { position: 'absolute', width: 0, height: 0 },
});
