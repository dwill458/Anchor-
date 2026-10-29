import React, { memo, useEffect, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { GETTING_STARTED_COPY, type GettingStartedStepId } from '@/constants/v2/gettingStartedCopy';
import type { GettingStartedStepState } from '@/hooks/v2/guidance/useGettingStarted';
import { typography } from '@/theme/v2';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type V2HomeGettingStartedProps = {
  visible: boolean;
  steps: GettingStartedStepState[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  reduceMotion?: boolean;
  onShowMe: (stepId: GettingStartedStepId) => void;
  onDismiss: () => void;
  testID?: string;
};

function CheckIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M2.3 6.3L4.9 8.9L9.8 3.6" stroke="#181612" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <View style={expanded ? styles.chevronExpanded : undefined}>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="rgba(244,239,230,0.46)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function ProgressRing({ completed, total, reduceMotion }: { completed: number; total: number; reduceMotion?: boolean }) {
  const segments = Array.from({ length: total }, (_, idx) => idx < completed);
  return (
    <View testID="v2-getting-started-ring" style={styles.ringWrap}>
      <View style={styles.ringCircle}>
        <Text testID="v2-getting-started-count" style={styles.ringLabel}>
          {completed}/{total}
        </Text>
      </View>
      <View style={styles.ringSegments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {segments.map((filled, idx) => (
          <RingDot key={idx} filled={filled} reduceMotion={reduceMotion} />
        ))}
      </View>
    </View>
  );
}

function RingDot({ filled, reduceMotion }: { filled: boolean; reduceMotion?: boolean }) {
  const fillProgress = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fillProgress.value = reduceMotion ? (filled ? 1 : 0) : withTiming(filled ? 1 : 0, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [fillProgress, filled, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + fillProgress.value * 0.75,
    backgroundColor: fillProgress.value > 0.5 ? '#D4B675' : 'rgba(244,239,230,0.22)',
  }));
  return <Animated.View style={[styles.ringSegment, style]} />;
}

function V2HomeGettingStartedComponent({
  visible,
  steps,
  completedCount,
  totalCount,
  allComplete,
  reduceMotion,
  onShowMe,
  onDismiss,
  testID = 'v2-home-getting-started',
}: V2HomeGettingStartedProps) {
  const [expanded, setExpanded] = useState(true);

  if (!visible) return null;

  const toggleExpanded = () => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(prev => !prev);
  };

  return (
    <View testID={testID} style={styles.card}>
      <Pressable
        testID="v2-getting-started-header"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${GETTING_STARTED_COPY.header.eyebrow}. ${allComplete ? GETTING_STARTED_COPY.header.doneTitle : GETTING_STARTED_COPY.header.title}. ${completedCount} of ${totalCount} complete.`}
        onPress={toggleExpanded}
        style={styles.header}
      >
        <ProgressRing completed={completedCount} total={totalCount} reduceMotion={reduceMotion} />
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{GETTING_STARTED_COPY.header.eyebrow}</Text>
          <Text style={styles.title}>
            {allComplete ? GETTING_STARTED_COPY.header.doneTitle : GETTING_STARTED_COPY.header.title}
          </Text>
        </View>
        <Pressable
          testID="v2-getting-started-hide"
          accessibilityRole="button"
          accessibilityLabel={allComplete ? GETTING_STARTED_COPY.actions.close : GETTING_STARTED_COPY.actions.hide}
          hitSlop={10}
          onPress={onDismiss}
          style={styles.hideButton}
        >
          <Text style={styles.hideText}>
            {allComplete ? GETTING_STARTED_COPY.actions.close : GETTING_STARTED_COPY.actions.hide}
          </Text>
        </Pressable>
        <ChevronIcon expanded={expanded} />
      </Pressable>

      {expanded ? (
        allComplete ? (
          <View testID="v2-getting-started-done-body" style={styles.doneBody}>
            <Text style={styles.doneSub}>{GETTING_STARTED_COPY.header.doneSub}</Text>
          </View>
        ) : (
          <View testID="v2-getting-started-steps" style={styles.steps}>
            {steps.map(step => (
              <Pressable
                key={step.id}
                testID={`v2-getting-started-step-${step.id}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: step.done || step.locked, checked: step.done }}
                disabled={step.done || step.locked}
                onPress={() => onShowMe(step.id)}
                style={[styles.stepRow, step.locked && styles.stepRowLocked]}
              >
                <View style={[styles.checkCircle, step.done && styles.checkCircleDone]}>
                  {step.done ? <CheckIcon /> : <Text style={styles.stepNum}>{step.number}</Text>}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, step.done && styles.stepTitleDone]}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
                {step.done ? null : step.locked ? (
                  <Text testID={`v2-getting-started-locked-${step.id}`} style={styles.lockedLabel}>
                    {GETTING_STARTED_COPY.actions.afterPractice}
                  </Text>
                ) : (
                  <View testID={`v2-getting-started-show-me-${step.id}`} style={styles.showMePill}>
                    <Text style={styles.showMeText}>{GETTING_STARTED_COPY.actions.showMe}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#22201C',
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.1)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(212, 182, 117, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: '#D4B675',
    fontVariant: ['tabular-nums'],
  },
  ringSegments: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
  },
  ringSegment: {
    width: 4,
    height: 2,
    borderRadius: 1,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#D4B675',
  },
  title: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 19,
    lineHeight: 22,
    color: '#F4EFE6',
    marginTop: 1,
  },
  hideButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
  hideText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: 'rgba(244, 239, 230, 0.46)',
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  steps: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(244, 239, 230, 0.08)',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  stepRowLocked: {
    opacity: 0.48,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 239, 230, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: '#D4B675',
    borderColor: '#D4B675',
  },
  stepNum: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: 'rgba(244, 239, 230, 0.62)',
    fontVariant: ['tabular-nums'],
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontFamily: typography.bodySemiBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#F4EFE6',
  },
  stepTitleDone: {
    color: 'rgba(244, 239, 230, 0.46)',
    textDecorationLine: 'line-through',
  },
  stepDesc: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(244, 239, 230, 0.62)',
    marginTop: 1,
  },
  showMePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.14)',
    backgroundColor: 'rgba(244, 239, 230, 0.06)',
  },
  showMeText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 11,
    color: '#D4B675',
  },
  lockedLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: 'rgba(244, 239, 230, 0.46)',
  },
  doneBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(244, 239, 230, 0.08)',
  },
  doneSub: {
    fontFamily: typography.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(244, 239, 230, 0.62)',
  },
});

export const V2HomeGettingStarted = memo(V2HomeGettingStartedComponent);
