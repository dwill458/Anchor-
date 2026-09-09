/**
 * Visual evidence renderer for Anchor 2.0 Weekly Insight.
 *
 * Implements the 6 visual styles locked in:
 * - Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx
 * - Anchor_2.0_Weekly_Insight_Prototype.html
 *
 * Visual styles:
 * 1. 'anchor': Circular anchor stage with semantic accent and label.
 * 2. 'evolution': Stage progression (Old Stage -> New Stage with evolution ring).
 * 3. 'release': Concentric release rings with ghost artwork and historical caption.
 * 4. 'thread': 7-day thread curve with vertex points and low-point/trend note.
 * 5. 'chart' / 'chartReached': Route fragment with waypoints, halo, and milestone nodes.
 * 6. 'activity': 7-day constancy rhythm with checkmarks and evidence caption.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { SigilSvg } from '@/components/common/SigilSvg';
import type {
  WeeklyInsightVisualData,
  WeeklyInsightVisualType,
} from '@/adapters/v2/weeklyInsight/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface WeeklyInsightVisualProps {
  visualType: WeeklyInsightVisualType;
  visualData: WeeklyInsightVisualData;
  accentColor: string;
  testID?: string;
}

/**
 * Editorial anchor vector matching the locked prototype geometry.
 */
function PrototypeAnchorSvg({
  accent,
  variant = 'default',
  size = 130,
  opacity = 1,
}: {
  accent: string;
  variant?: 'default' | 'rooted';
  size?: number;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140" style={{ opacity }}>
      {/* Outer subtle ring */}
      <Circle cx={70} cy={70} r={49} fill="none" stroke={accent} strokeOpacity={0.24} strokeWidth={1.2} />

      {/* Evolution ring if rooted */}
      {variant === 'rooted' && (
        <>
          <Circle
            cx={70}
            cy={70}
            r={58}
            fill="none"
            stroke={accent}
            strokeOpacity={0.18}
            strokeWidth={1}
          />
          <Path
            d="M27 97c11 6 23 9 36 9 17 0 32-5 45-15"
            fill="none"
            stroke={accent}
            strokeOpacity={0.28}
            strokeWidth={1.1}
          />
        </>
      )}

      {/* Characteristic geometric anchor glyph */}
      <Path
        d="M42 91L66 44l10 51 23-39M46 68l50 8M55 101l34-61"
        fill="none"
        stroke="#171717"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Accent energy points */}
      <Circle cx={66} cy={44} r={3.4} fill={accent} />
      <Circle cx={76} cy={95} r={3.4} fill={accent} />
      <Circle cx={99} cy={56} r={3.4} fill={accent} />
    </Svg>
  );
}

export const WeeklyInsightVisual: React.FC<WeeklyInsightVisualProps> = ({
  visualType,
  visualData,
  accentColor,
  testID = 'weekly-insight-visual',
}) => {
  // 1. Thread Line Visual
  if (visualType === 'thread' && visualData.type === 'thread') {
    const arr = visualData.threadPoints;
    const min = Math.min(...arr) - 2;
    const max = Math.max(...arr) + 2;
    const scaleY = (v: number) => 72 - ((v - min) / (max - min || 1)) * 52;
    const pts: [number, number][] = arr.map((v, i) => [14 + i * 49, scaleY(v)]);
    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');

    return (
      <View style={styles.shell} testID={`${testID}-thread`}>
        <View style={styles.threadTop}>
          <View style={styles.threadBigWrap}>
            <Text style={styles.threadBig}>{visualData.endScore}</Text>
            <Text style={styles.threadSmall}>THREAD</Text>
          </View>
          <Text style={styles.threadNote}>
            {visualData.note || `${visualData.startScore} → ${visualData.endScore} this week`}
          </Text>
        </View>

        <Svg width="100%" height={75} viewBox="0 0 322 75">
          <Line x1={14} x2={308} y1={60} y2={60} stroke={colors.border.default} strokeWidth={1} />
          <Line
            x1={14}
            x2={308}
            y1={24}
            y2={24}
            stroke={colors.border.default}
            strokeWidth={1}
            opacity={0.45}
          />
          <Path
            d={pathD}
            fill="none"
            stroke={accentColor}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <Circle
              key={`pt-${i}`}
              cx={p[0]}
              cy={p[1]}
              r={3.2}
              fill={colors.canvas}
              stroke={accentColor}
              strokeWidth={2}
            />
          ))}
        </Svg>
        <View style={styles.threadLabelsRow}>
          {DAY_LABELS.map((d, i) => (
            <Text key={`lbl-${i}`} style={styles.threadDayLabel}>
              {d}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  // 2. Chart / Waypoint Route Visual
  if (
    (visualType === 'chart' || visualType === 'chartReached') &&
    (visualData.type === 'chart' || visualData.type === 'chartReached')
  ) {
    const reached = visualType === 'chartReached' || visualData.reached;
    return (
      <View style={styles.shell} testID={`${testID}-chart`}>
        <Svg width="100%" height={110} viewBox="0 0 326 110">
          <Path
            d="M23 86 C70 75 68 31 117 37 S167 92 214 68 S267 16 306 26"
            fill="none"
            stroke={colors.border.default}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <Path
            d="M23 86 C70 75 68 31 117 37 S167 92 214 68"
            fill="none"
            stroke={accentColor}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <Circle cx={23} cy={86} r={6} fill={accentColor} stroke={accentColor} strokeWidth={2} />
          <Circle cx={117} cy={37} r={6} fill={accentColor} stroke={accentColor} strokeWidth={2} />
          <Circle
            cx={214}
            cy={68}
            r={14}
            fill="none"
            stroke={`${accentColor}3D`}
            strokeWidth={1.5}
          />
          <Circle
            cx={214}
            cy={68}
            r={reached ? 6 : 7}
            fill={reached ? accentColor : colors.canvas}
            stroke={accentColor}
            strokeWidth={reached ? 2 : 3}
          />
          <Circle
            cx={306}
            cy={26}
            r={reached ? 7 : 5}
            fill={colors.canvas}
            stroke={reached ? accentColor : colors.border.default}
            strokeWidth={2}
          />
        </Svg>
        <View style={styles.routeLabelsRow}>
          <Text style={styles.routeLabel}>Reached</Text>
          <Text style={styles.routeLabel}>Reached</Text>
          <Text style={[styles.routeLabel, styles.routeLabelCurrent]}>
            {reached ? (visualData.reachedDay ? `Reached ${visualData.reachedDay}` : 'Reached Thu') : 'Current'}
          </Text>
          <Text style={styles.routeLabel}>{reached ? 'Next' : 'Destination'}</Text>
        </View>
      </View>
    );
  }

  // 3. Activity Days Rhythm Visual
  if (visualType === 'activity' && visualData.type === 'activity') {
    const days = visualData.activeDays;
    return (
      <View style={styles.shell} testID={`${testID}-activity`}>
        <View style={styles.activityContainer}>
          <Text style={styles.activityLabel}>THIS WEEK</Text>
          <View style={styles.daysRow}>
            {days.map((isActive, i) => (
              <View key={`day-${i}`} style={styles.dayCol}>
                <View
                  style={[
                    styles.dayDot,
                    isActive && {
                      borderColor: `${accentColor}7A`,
                      backgroundColor: `${accentColor}1F`,
                    },
                  ]}
                >
                  <Text style={[styles.dayCheck, isActive && { color: colors.text.primary }]}>
                    {isActive ? '✓' : ''}
                  </Text>
                </View>
                <Text style={styles.dayName}>{DAY_LABELS[i]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.activityCaption}>
            {visualData.note || `${visualData.activeDaysCount} active days`}
          </Text>
          <Text style={styles.activitySub}>Activity is evidence, not the headline.</Text>
        </View>
      </View>
    );
  }

  // 4. Evolution Milestone Visual
  if (visualType === 'evolution' && visualData.type === 'evolution') {
    return (
      <View style={styles.shell} testID={`${testID}-evolution`}>
        <View style={styles.evolutionRow}>
          <View style={styles.evolutionStage}>
            <PrototypeAnchorSvg accent={accentColor} size={82} opacity={0.45} />
            <Text style={styles.evolutionLabel}>Grounded</Text>
          </View>
          <Text style={styles.evolutionArrow}>→</Text>
          <View style={styles.evolutionStage}>
            <PrototypeAnchorSvg accent={accentColor} variant="rooted" size={124} />
            <Text style={styles.evolutionLabel}>{visualData.newStage}</Text>
          </View>
        </View>
      </View>
    );
  }

  // 5. Release / Completion Visual
  if (visualType === 'release' && visualData.type === 'release') {
    return (
      <View style={styles.shell} testID={`${testID}-release`}>
        <View style={styles.releaseWrap}>
          <View style={[styles.releaseRing, { borderColor: `${accentColor}5C` }]}>
            <View style={[styles.releaseInnerRing1, { borderColor: `${accentColor}2E` }]} />
            <View style={[styles.releaseInnerRing2, { borderColor: `${accentColor}24` }]} />
            <PrototypeAnchorSvg accent={accentColor} size={110} opacity={0.3} />
          </View>
          <Text style={styles.releaseCaption}>
            {visualData.anchorName} Anchor · preserved in history
          </Text>
        </View>
      </View>
    );
  }

  // 6. Anchor Artwork Visual (Default)
  const anchorName = (visualData as any).anchorName || 'Career';
  const customSvg = (visualData as any).svg;

  return (
    <View style={styles.shell} testID={`${testID}-anchor`}>
      <View style={styles.anchorStage}>
        {customSvg ? (
          <View style={styles.customAnchorWrap}>
            <SigilSvg xml={customSvg} width={100} height={100} color={accentColor} />
          </View>
        ) : (
          <PrototypeAnchorSvg accent={accentColor} size={130} />
        )}
        <Text style={styles.anchorName}>{anchorName.toUpperCase()} ANCHOR</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    minHeight: 205,
    marginHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorStage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  customAnchorWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF9F4',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  anchorName: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.88,
    color: colors.text.disabled,
  },
  evolutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  evolutionStage: {
    alignItems: 'center',
  },
  evolutionArrow: {
    fontSize: 20,
    color: colors.text.disabled,
  },
  evolutionLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.text.disabled,
    marginTop: 8,
  },
  releaseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  releaseInnerRing1: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 58,
    borderWidth: 1,
  },
  releaseInnerRing2: {
    position: 'absolute',
    top: 26,
    left: 26,
    right: 26,
    bottom: 26,
    borderRadius: 44,
    borderWidth: 1,
  },
  releaseCaption: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.text.disabled,
    marginTop: 13,
  },
  threadTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: spacing[3],
  },
  threadBigWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  threadBig: {
    fontFamily: typography.displaySemiBold,
    fontSize: 44,
    color: colors.text.primary,
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  threadSmall: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.text.disabled,
    letterSpacing: 0.6,
  },
  threadNote: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.text.disabled,
    textAlign: 'right',
    maxWidth: 120,
    lineHeight: 15,
  },
  threadLabelsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 4,
  },
  threadDayLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    color: colors.text.disabled,
    textAlign: 'center',
    width: 24,
  },
  routeLabelsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 6,
  },
  routeLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    color: colors.text.disabled,
  },
  routeLabelCurrent: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  activityContainer: {
    width: '100%',
    paddingHorizontal: spacing[2],
  },
  activityLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.text.disabled,
    letterSpacing: 0.66,
    marginBottom: 16,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
  },
  dayDot: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayCheck: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    color: colors.text.disabled,
  },
  dayName: {
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    color: colors.text.disabled,
  },
  activityCaption: {
    fontFamily: typography.displaySemiBold,
    fontSize: 19,
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginTop: 18,
  },
  activitySub: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.text.disabled,
    marginTop: 4,
  },
});
