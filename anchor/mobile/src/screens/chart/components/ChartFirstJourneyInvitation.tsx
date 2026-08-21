import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { canViewChart } from '@/types/chart';
import { colors, typography } from '@/theme';
import { ChartButton, ChartGhostButton } from '../chartUi';

type Props = {
  visible: boolean;
  onContinue: () => void;
  /** Close any parent-owned completion overlay before switching tabs. */
  onCourseSelected?: () => void;
};

/** Lightweight two-beat invitation shown only after the first durable Practice. */
export const ChartFirstJourneyInvitation: React.FC<Props> = ({ visible, onContinue, onCourseSelected }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const { navigateToChart } = useTabNavigation();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const flags = useAuthStore((state) => state.user?.chartFlags);
  const capabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const journeyAccountId = useChartJourneyStore((state) => state.accountId);
  const firstAnchorId = useChartJourneyStore((state) => state.firstAnchorId);
  const resolveIntro = useChartJourneyStore((state) => state.resolveNewUserIntro);
  const reduceMotion = useReduceMotionEnabled();
  const available = canViewChart(flags, capabilities);
  const wasVisibleRef = useRef(false);
  const sessionAccountIdRef = useRef<string | null>(null);
  const ownerAccountIdRef = useRef<string | null>(null);
  const releasedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      sessionAccountIdRef.current = null;
      ownerAccountIdRef.current = null;
      releasedRef.current = false;
      setStep(1);
      return;
    }

    if (!wasVisibleRef.current) {
      wasVisibleRef.current = true;
      sessionAccountIdRef.current = accountId;
      ownerAccountIdRef.current = accountId && journeyAccountId === accountId ? accountId : null;
      releasedRef.current = false;
      setStep(1);
      if (accountId) return;
    } else if (
      !releasedRef.current &&
      sessionAccountIdRef.current === accountId &&
      journeyAccountId === accountId
    ) {
      ownerAccountIdRef.current = accountId;
      return;
    }

    // A completion screen can remain mounted briefly during sign-out/account
    // replacement. Never let that account-A surface become account B's intro.
    ownerAccountIdRef.current = null;
    if (!releasedRef.current) {
      releasedRef.current = true;
      onContinue();
    }
  }, [accountId, journeyAccountId, onContinue, visible]);

  const stillOwnedByVisibleAccount = (): boolean => {
    const ownerAccountId = ownerAccountIdRef.current;
    return Boolean(
      visible &&
      !releasedRef.current &&
      ownerAccountId &&
      useAuthStore.getState().user?.id === ownerAccountId &&
      useChartJourneyStore.getState().accountId === ownerAccountId,
    );
  };

  const accountStillCurrent = (ownerAccountId: string): boolean => (
    useAuthStore.getState().user?.id === ownerAccountId &&
    useChartJourneyStore.getState().accountId === ownerAccountId
  );

  const releaseParent = () => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    ownerAccountIdRef.current = null;
    onContinue();
  };

  useEffect(() => {
    if (!visible || !accountId || !stillOwnedByVisibleAccount()) return;
    AnalyticsService.track('chart_intro_viewed', {
      intro_type: 'new_user_post_first_practice',
      account_id: accountId,
      step,
    });
  }, [accountId, step, visible]);

  useEffect(() => {
    if (!visible || available) return;
    // Capability can be revoked while the native modal is mounted. Resolve and
    // release the parent completion surface instead of rendering an invisible
    // modal that leaves its flow paused forever.
    if (!stillOwnedByVisibleAccount()) {
      releaseParent();
      return;
    }
    void Promise.resolve(resolveIntro()).finally(releaseParent);
  }, [available, resolveIntro, visible]);

  const continueStandalone = async (choice: 'maybe_later' | 'standalone') => {
    if (!stillOwnedByVisibleAccount()) {
      releaseParent();
      return;
    }
    AnalyticsService.track('chart_intro_skipped', {
      intro_type: 'new_user_post_first_practice',
      choice,
    });
    await resolveIntro();
    releaseParent();
  };

  const chartCourse = async () => {
    if (!stillOwnedByVisibleAccount()) {
      releaseParent();
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    const actionAccountId = ownerAccountIdRef.current;
    if (!actionAccountId) {
      releaseParent();
      return;
    }
    AnalyticsService.track('chart_intro_course_selected', {
      intro_type: 'new_user_post_first_practice',
      has_seed_anchor: Boolean(firstAnchorId),
    });
    await resolveIntro();
    // Resolving the milestone may intentionally make the parent pass
    // visible=false before secure persistence finishes. Validate the captured
    // account directly so that expected hide does not cancel navigation, while
    // an A -> B switch still does.
    if (!accountStillCurrent(actionAccountId)) {
      releaseParent();
      return;
    }
    releasedRef.current = true;
    ownerAccountIdRef.current = null;
    onCourseSelected?.();
    // Only the opaque Anchor identifier crosses navigation. Setup resolves any
    // display text from the account-bound Anchor store.
    navigateToChart('CourseSetup', firstAnchorId ? ({ seedAnchorId: firstAnchorId } as never) : undefined);
  };

  const ownedVisibleSession = Boolean(
    visible &&
    available &&
    !releasedRef.current &&
    accountId &&
    journeyAccountId === accountId &&
    (!ownerAccountIdRef.current || ownerAccountIdRef.current === accountId),
  );

  if (!available || (visible && !ownedVisibleSession)) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={() => void continueStandalone(step === 1 ? 'maybe_later' : 'standalone')}
    >
      <SafeAreaView style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card} accessible accessibilityLabel={step === 1 ? 'You have created your first Anchor' : 'Is this part of something larger?'}>
          <Text style={styles.kicker}>{step === 1 ? "YOU'VE CREATED YOUR FIRST ANCHOR" : 'IS THIS PART OF SOMETHING LARGER?'}</Text>
          <Text style={styles.title}>{step === 1 ? 'One intention now has a form.' : 'Some intentions are destinations.'}</Text>
          <Text style={styles.body}>
            {step === 1
              ? 'You have begun practicing with it. Chart can turn a larger destination into the meaningful results between here and there.'
              : 'Chart is for destinations that take more than one result to reach. This Anchor can also remain complete on its own.'}
          </Text>
          <ChartButton
            label="Chart a Course"
            onPress={() => void chartCourse()}
            disabled={!available}
            hint={step === 1 ? 'Explains whether this Anchor belongs to a larger destination.' : 'Opens Course setup.'}
          />
          <ChartGhostButton
            label={step === 1 ? 'Maybe later' : 'Keep this as a standalone Anchor'}
            onPress={() => void continueStandalone(step === 1 ? 'maybe_later' : 'standalone')}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(4,7,10,0.82)',
  },
  card: {
    gap: 16,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.34)',
    backgroundColor: '#111820',
    shadowColor: colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  kicker: {
    color: colors.gold,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 11,
    letterSpacing: 1.8,
  },
  title: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    color: 'rgba(244,239,230,0.72)',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 15,
    lineHeight: 23,
  },
});

export default ChartFirstJourneyInvitation;
