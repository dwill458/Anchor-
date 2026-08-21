import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AnchorSelectorSheet } from '@/screens/practice/components/AnchorSelectorSheet';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import type { ChartStackParamList } from '@/types/chart';
import { colors, typography } from '@/theme';
import { ChartButton, ChartGhostButton } from '../chartUi';

type Props = {
  visible: boolean;
  navigation: NativeStackNavigationProp<ChartStackParamList>;
};

/** One-time introduction for accounts that already understand Anchors. */
export const ExistingUserChartIntro: React.FC<Props> = ({ visible, navigation }) => {
  const [selectorVisible, setSelectorVisible] = useState(false);
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const journeyAccountId = useChartJourneyStore((state) => state.accountId);
  const anchors = useAnchorStore((state) =>
    state.anchors.filter((anchor) => !anchor.isReleased && !anchor.archivedAt),
  );
  const resolveIntro = useChartJourneyStore((state) => state.resolveExistingUserIntro);
  const reduceMotion = useReduceMotionEnabled();
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
      setSelectorVisible(false);
      return;
    }

    if (!wasVisibleRef.current) {
      wasVisibleRef.current = true;
      sessionAccountIdRef.current = accountId;
      ownerAccountIdRef.current = accountId && journeyAccountId === accountId ? accountId : null;
      releasedRef.current = false;
      setSelectorVisible(false);
      if (accountId) return;
    } else if (
      !releasedRef.current &&
      sessionAccountIdRef.current === accountId &&
      journeyAccountId === accountId
    ) {
      ownerAccountIdRef.current = accountId;
      return;
    }

    // A selector opened for account A must disappear immediately when auth or
    // the private journey binding changes, and must not be adopted by B.
    ownerAccountIdRef.current = null;
    releasedRef.current = true;
    setSelectorVisible(false);
  }, [accountId, journeyAccountId, visible]);

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

  const plotNew = async () => {
    if (!stillOwnedByVisibleAccount()) return;
    const actionAccountId = ownerAccountIdRef.current;
    if (!actionAccountId) return;
    AnalyticsService.track('chart_intro_course_selected', {
      intro_type: 'existing_user',
      source: 'new_destination',
    });
    await resolveIntro();
    if (!accountStillCurrent(actionAccountId)) return;
    releasedRef.current = true;
    ownerAccountIdRef.current = null;
    navigation.navigate('CourseSetup');
  };

  const useExisting = () => {
    if (!stillOwnedByVisibleAccount()) return;
    AnalyticsService.track('chart_intro_anchor_picker_opened', {
      intro_type: 'existing_user',
      available_anchor_count: anchors.length,
    });
    setSelectorVisible(true);
  };

  const dismiss = async () => {
    if (!stillOwnedByVisibleAccount()) return;
    AnalyticsService.track('chart_intro_skipped', {
      intro_type: 'existing_user',
      choice: 'not_now',
    });
    await resolveIntro();
  };

  const selectAnchor = async (anchorId: string) => {
    if (!stillOwnedByVisibleAccount()) {
      setSelectorVisible(false);
      return;
    }
    const actionAccountId = ownerAccountIdRef.current;
    if (!actionAccountId) {
      setSelectorVisible(false);
      return;
    }
    AnalyticsService.track('chart_intro_course_selected', {
      intro_type: 'existing_user',
      source: 'existing_anchor',
      anchor_id: anchorId,
    });
    setSelectorVisible(false);
    await resolveIntro();
    // The parent normally hides this intro as soon as the milestone resolves;
    // only an actual account/binding change should cancel the queued route.
    if (!accountStillCurrent(actionAccountId)) return;
    releasedRef.current = true;
    ownerAccountIdRef.current = null;
    navigation.navigate('CourseSetup', { seedAnchorId: anchorId } as never);
  };

  const ownedVisibleSession = Boolean(
    visible &&
    !releasedRef.current &&
    accountId &&
    journeyAccountId === accountId &&
    (!ownerAccountIdRef.current || ownerAccountIdRef.current === accountId),
  );

  return (
    <>
      <Modal
        visible={ownedVisibleSession && !selectorVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        statusBarTranslucent
        onShow={() => AnalyticsService.track('chart_intro_viewed', { intro_type: 'existing_user' })}
        onRequestClose={() => void dismiss()}
      >
        <SafeAreaView style={styles.backdrop} accessibilityViewIsModal>
          <View style={styles.card}>
            <Text style={styles.kicker}>CHART YOUR NEXT DESTINATION</Text>
            <Text style={styles.title}>Turn what matters into a path forward.</Text>
            <Text style={styles.body}>
              You already have Anchors for what matters to you. Chart connects them to the next real result without changing what is already yours.
            </Text>
            <ChartButton
              label="Use an Existing Anchor"
              onPress={useExisting}
              disabled={anchors.length === 0}
              hint={anchors.length === 0 ? 'Create an Anchor first, or plot a new destination.' : 'Choose an Anchor as context. Nothing is linked silently.'}
            />
            <ChartButton label="Plot a New Destination" secondary onPress={() => void plotNew()} />
            <ChartGhostButton label="Not now" onPress={() => void dismiss()} />
          </View>
        </SafeAreaView>
      </Modal>
      <AnchorSelectorSheet
        visible={ownedVisibleSession && selectorVisible}
        anchors={anchors}
        onClose={() => setSelectorVisible(false)}
        onSelect={(anchor) => void selectAnchor(anchor.id)}
      />
    </>
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

export default ExistingUserChartIntro;
