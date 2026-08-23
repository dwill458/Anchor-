import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PracticeEntrySource, RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingStore } from '@/stores/teachingStore';
import {
  normalizeSuggestionIndex,
  useVisualizationSceneStore,
} from '@/stores/visualizationSceneStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import VisualizationSceneService, {
  normalizeVisualizationSceneText,
  validateVisualizationSceneText,
  visualizationLatencyBucket,
  type GenerateResult,
} from '@/services/VisualizationSceneService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { persistSessionAudioDefaults } from '@/services/SessionAudioPreferencesService';
import { SessionConfigurationPill } from '@/components/practice/SessionConfiguration';
import {
  SessionConfigurationSheet,
  VISUALIZE_MODE,
  type SessionDraft,
} from '@/components/practice/SessionConfigurationSheet';
import { colors as themeColors, typography } from '@/theme';
import type { SessionAudioDefaults } from '@/types/sessionAudio';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useChartPracticeReturn } from '@/hooks/useChartPracticeReturn';
import {
  VisualizeAnchorField,
  VisualizeFieldBackground,
} from './VisualizeAnchorField';
import { VisualizationPrimaryButton } from './VisualizationPrimitives';
import type { VisualizeDuration } from './visualizeSessionConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'VisualizePreparation'>;

const colors = {
  ...themeColors,
  gold: '#D4AF37',
  goldBright: '#F0CB6A',
  goldDim: '#8a6f23',
  goldLine: 'rgba(212,175,55,0.28)',
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.34)',
  sheetBg: 'rgba(13,21,40,0.96)',
};

const SCENE_MAX = 180;
const durLabel = (s: number) => (s === 60 ? '1 min' : s === 300 ? '5 min' : '3 min');

export const VisualizePreparationScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const returnToChart = useChartPracticeReturn(navigation);
  const {
    navigateToSanctuary: canonicalNavigateToSanctuary,
    navigateToVault,
    returnToAnchorDetail: canonicalReturnToAnchorDetail,
  } = useTabNavigation();
  const navigateToSanctuary = canonicalNavigateToSanctuary ?? (() => navigateToVault());
  const returnToAnchorDetail =
    canonicalReturnToAnchorDetail ??
    ((anchorId: string) => navigateToVault('AnchorDetail', { anchorId }));

  const anchor = useAnchorStore((state) =>
    state.getAnchorById(route.params.anchorId),
  );
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const { hasActiveEntitlement, subscriptionStatus } = useTrialStatus();

  const globalDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults.visualize,
  );

  const [duration, setDuration] = useState<VisualizeDuration>(180);

  // Suggestions state
  const suggestions = useVisualizationSceneStore((state) =>
    anchor ? state.suggestions[anchor.id] ?? [] : [],
  );
  const suggestionIndex = useVisualizationSceneStore((state) =>
    anchor
      ? normalizeSuggestionIndex(
          state.selectedSuggestionIndex[anchor.id],
          suggestions.length,
        )
      : 0,
  );
  const [audio, setAudio] = useState<SessionAudioDefaults>({
    ...globalDefaults,
  });
  const [sceneText, setSceneText] = useState('');
  const [loading, setLoading] = useState(hasActiveEntitlement);
  const [saving, setSaving] = useState(false);
  const isExplainerExhausted = useTeachingStore((state) =>
    state.isExhausted('visualize_scene_explainer'),
  );
  const recordShown = useTeachingStore((state) => state.recordShown);

  const [sceneSheetVisible, setSceneSheetVisible] = useState(false);
  const [draftScene, setDraftScene] = useState('');
  const [eduOpen, setEduOpen] = useState(!isExplainerExhausted);
  const startingRef = useRef(false);

  useEffect(() => {
    if (!isExplainerExhausted) {
      setEduOpen(true);
      recordShown('visualize_scene_explainer', 'glass_card', 1);
      AnalyticsService.track('teaching_shown', {
        teaching_id: 'visualize_scene_explainer',
        pattern: 'glass_card',
        screen: 'visualize_preparation',
        trigger: 'first_time',
        guide_mode: true,
      });
    }
  }, [isExplainerExhausted, recordShown]);

  const handleDismissEdu = useCallback(() => {
    recordShown('visualize_scene_explainer', 'glass_card', 1);
    AnalyticsService.track('teaching_dismissed', {
      teaching_id: 'visualize_scene_explainer',
      pattern: 'glass_card',
      screen: 'visualize_preparation',
    });
    setEduOpen(false);
  }, [recordShown]);

  const sigilSvg = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '';
  const imageUrl = anchor?.enhancedImageUrl;
  const anchorName = anchor?.intentionText || 'Anchor';

  const trackGeneration = useCallback(
    (anchorId: string, result: GenerateResult): void => {
      const diagnosticProps = {
        anchor_id: anchorId,
        source: result.diagnostics.source,
        fallback_reason: result.diagnostics.fallbackReason,
        prompt_version: result.diagnostics.promptVersion,
        model: result.diagnostics.model,
        latency_ms: result.diagnostics.latencyMs,
        latency_bucket: visualizationLatencyBucket(result.diagnostics.latencyMs),
        raw_candidate_count: result.diagnostics.rawCandidateCount,
        valid_candidate_count: result.diagnostics.validCandidateCount,
      };
      AnalyticsService.track(AnalyticsEvents.VISUALIZE_SCENE_GENERATED, {
        ...diagnosticProps,
        version: result.scene.generationVersion,
        fallback: result.fallbackUsed,
      });
    },
    [],
  );

  useEffect(() => {
    AnalyticsService.track(AnalyticsEvents.VISUALIZE_PREPARATION_VIEWED, {
      anchor_id: route.params.anchorId,
      tier: subscriptionStatus,
    });
    if (!anchor || !accountId || !hasActiveEntitlement) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const loaded = await VisualizationSceneService.load(anchor, accountId);
      const outcome = await VisualizationSceneService.ensureBatch(
        anchor,
        accountId,
        loaded,
      );
      if (!active) return;

      const cachedSelection = () =>
        VisualizationSceneService.getSuggestions(anchor)[
          VisualizationSceneService.getSelectedIndex(anchor)
        ] ?? '';

      if (outcome.kind === 'generated') {
        setSceneText(outcome.result.scene.currentText);
        trackGeneration(anchor.id, outcome.result);
      } else {
        const initialText = loaded?.currentText ?? cachedSelection();
        setSceneText(initialText || 'I move through an important task calmly, make clear decisions, and finish without rushing.');
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [accountId, anchor, hasActiveEntitlement, route.params.anchorId, subscriptionStatus, trackGeneration]);

  const handleOpenSceneSheet = () => {
    setDraftScene(sceneText);
    setSceneSheetVisible(true);
  };

  const handleSaveScene = async (newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setSceneText(trimmed);
    setSceneSheetVisible(false);
    if (anchor && accountId) {
      const currentScene = useVisualizationSceneStore.getState().scenes[anchor.id];
      const updated = {
        accountId,
        anchorId: anchor.id,
        anchorLocalId: anchor.localId ?? null,
        currentText: trimmed,
        originalSuggestion: currentScene?.originalSuggestion ?? trimmed,
        generationSource: 'user_edited' as const,
        generationVersion: currentScene?.generationVersion ?? 'scene-v1',
        clientUpdatedAt: new Date().toISOString(),
        syncState: 'pending' as const,
      };
      await VisualizationSceneService.save(anchor, updated);
    }
  };

  const handleNextSuggestion = () => {
    if (!anchor || !suggestions.length) return;
    const nextIdx = (suggestionIndex + 1) % suggestions.length;
    useVisualizationSceneStore
      .getState()
      .setSelectedSuggestionIndex(anchor.id, nextIdx);
    const nextText = suggestions[nextIdx];
    if (nextText) {
      setDraftScene(nextText);
    }
  };

  const handleRestoreOriginal = () => {
    if (!anchor || !suggestions.length) return;
    useVisualizationSceneStore
      .getState()
      .setSelectedSuggestionIndex(anchor.id, 0);
    const origText = suggestions[0];
    if (origText) {
      setDraftScene(origText);
    }
  };

  const handleCancel = () => {
    if (route.params.returnTo === 'chart') {
      returnToChart({
        returnTo: route.params.returnTo,
        anchorId: route.params.anchorId,
        chartContext: route.params.chartContext,
      });
      return;
    }
    if (route.params.returnTarget?.kind === 'anchorDetail') {
      returnToAnchorDetail(route.params.returnTarget.anchorId);
      return;
    }
    navigation.popToTop();
  };

  const handleBegin = async () => {
    if (startingRef.current || !hasActiveEntitlement || !sceneText.trim()) return;
    startingRef.current = true;
    setSaving(true);

    try {
      if (anchor && accountId) {
        const currentScene = useVisualizationSceneStore.getState().scenes[anchor.id];
        const updated = {
          accountId,
          anchorId: anchor.id,
          anchorLocalId: anchor.localId ?? null,
          currentText: sceneText,
          originalSuggestion: currentScene?.originalSuggestion ?? sceneText,
          generationSource: (currentScene?.generationSource === 'user_edited' ? 'user_edited' : 'seeded_legacy') as any,
          generationVersion: currentScene?.generationVersion ?? 'scene-v1',
          clientUpdatedAt: new Date().toISOString(),
          syncState: 'pending' as const,
        };
        await VisualizationSceneService.save(anchor, updated);
      }
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
        practice_mode: 'visualize',
        anchor_id: route.params.anchorId,
        duration_seconds: duration,
        guidance_voice: audio.guidanceVoice,
        background_audio: audio.backgroundAudio,
      });

      navigation.replace('VisualizeSession', {
        anchorId: route.params.anchorId,
        durationSeconds: duration,
        sceneText,
        guidanceVoice: audio.guidanceVoice,
        backgroundAudio: audio.backgroundAudio,
        source: 'practice_screen',
        returnTo: route.params.returnTo === 'chart' ? 'chart' : 'practice',
        returnTarget: route.params.returnTarget,
        chartContext: route.params.chartContext,
        practiceMode: route.params.practiceMode ?? 'visualize',
        practiceEntrySource: route.params.source as PracticeEntrySource | undefined,
      });
    } finally {
      setSaving(false);
      startingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <VisualizeFieldBackground phase="arrive" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleCancel}
            style={styles.iconBtn}
          >
            <X size={15} color={colors.boneSoft} />
          </Pressable>

          <Text style={styles.topHeaderLabel}>
            VISUALIZE · {durLabel(duration)}
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Scrollable Main Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Framed Stage */}
          <View style={styles.stageWrap}>
            <VisualizeAnchorField
              phase="arrive"
              compact={false}
              heroSize={300}
              sigilSize={216}
              imageUrl={imageUrl}
              sigilSvg={sigilSvg}
            />
          </View>

          {/* Anchor Name & Subtitle */}
          <Text style={styles.prepName}>{anchorName}</Text>
          <Text style={styles.prepTag}>
            Practice how you want to show up in a specific moment.
          </Text>

          {/* Scene Card */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scene to Rehearse, tap to edit"
            onPress={handleOpenSceneSheet}
            style={styles.sceneCard}
          >
            <View style={styles.sceneCardHeader}>
              <Text style={styles.sceneCardLabel}>SCENE TO REHEARSE</Text>
              <View style={styles.sceneEditPill}>
                <Pencil size={11} color={colors.gold} />
                <Text style={styles.sceneEditText}>EDIT</Text>
              </View>
            </View>
            <Text style={styles.sceneCardQuote}>
              "{sceneText || 'Describe the moment you will rehearse…'}"
            </Text>
          </Pressable>

          {/* "Why a scene?" Micro-Teaching */}
          {eduOpen ? (
            <View style={styles.eduCard}>
              <Pressable
                accessibilityLabel="Dismiss explanation"
                onPress={() => setEduOpen(false)}
                style={styles.eduCloseBtn}
              >
                <X size={13} color={colors.boneFaint} />
              </Pressable>
              <Text style={styles.eduTitle}>Why a scene?</Text>
              <Text style={styles.eduBody}>
                Specific moments are easier to rehearse than abstract goals. We
                suggested one for this Anchor. Make it yours.
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setEduOpen(true)}
              style={styles.whyLink}
            >
              <Text style={styles.whyLinkText}>Why a scene?</Text>
            </Pressable>
          )}

          {/* Session Configuration Pill */}
          <View style={styles.pillWrap}>
            <SessionConfigurationPill
              value={audio}
              durationSeconds={duration}
              onPress={() => setConfigVisible(true)}
            />
          </View>
        </ScrollView>

        {/* Bottom Begin CTA */}
        <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <VisualizationPrimaryButton
            label={saving ? 'PREPARING…' : 'BEGIN VISUALIZE →'}
            disabled={saving || !sceneText.trim()}
            onPress={() => void handleBegin()}
          />
        </View>

        {/* Session Configuration Sheet */}
        <SessionConfigurationSheet
          visible={configVisible}
          mode={VISUALIZE_MODE}
          config={{
            durationSeconds: duration,
            guidanceVoice: audio.guidanceVoice,
            backgroundAudio: audio.backgroundAudio,
            makeDefault: false,
          }}
          onClose={() => setConfigVisible(false)}
          onApply={(draft: SessionDraft) => {
            setDuration(draft.durationSeconds as VisualizeDuration);
            setAudio({ guidanceVoice: draft.guidanceVoice, backgroundAudio: draft.backgroundAudio });
            setConfigVisible(false);
            if (draft.makeDefault) {
              void persistSessionAudioDefaults('visualize', {
                guidanceVoice: draft.guidanceVoice,
                backgroundAudio: draft.backgroundAudio,
              }).catch(() => undefined);
            }
          }}
        />

        {/* Scene Editing Modal Sheet */}
        <Modal
          visible={sceneSheetVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSceneSheetVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <Pressable
              style={styles.modalScrim}
              onPress={() => setSceneSheetVisible(false)}
            />
            <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom + 10, 24) }]}>
              <View style={styles.sheetGrab} />
              <Text style={styles.sheetTitle}>Scene to Rehearse</Text>

              <View style={styles.sheetInputWrap}>
                <TextInput
                  value={draftScene}
                  onChangeText={(t) => setDraftScene(t.slice(0, SCENE_MAX))}
                  placeholder="Describe the moment you will rehearse…"
                  placeholderTextColor="rgba(245,240,232,0.3)"
                  multiline
                  numberOfLines={3}
                  style={styles.sheetTextInput}
                  autoFocus
                />
                <Text style={styles.sheetCharCount}>
                  {draftScene.length} / {SCENE_MAX}
                </Text>
              </View>

              <View style={styles.sheetActionsStack}>
                <VisualizationPrimaryButton
                  label="SAVE SCENE"
                  disabled={!draftScene.trim()}
                  onPress={() => void handleSaveScene(draftScene)}
                />

                <View style={styles.sheetSecondaryRow}>
                  {suggestions.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleNextSuggestion}
                      style={styles.sheetGhostBtn}
                    >
                      <Text style={styles.sheetGhostText}>Try Another Suggestion</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRestoreOriginal}
                    style={styles.sheetGhostBtn}
                  >
                    <Text style={styles.sheetGhostText}>Restore Original</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04060c',
  },
  safe: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: 'rgba(245,240,232,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 2.8,
    color: colors.boneSoft,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    paddingHorizontal: 22,
    alignItems: 'center',
    paddingBottom: 24,
    gap: 14,
  },
  stageWrap: {
    marginTop: 4,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepName: {
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    fontWeight: '500',
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.8,
    lineHeight: 28,
  },
  prepTag: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.boneSoft,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 20,
    marginTop: -6,
  },
  sceneCard: {
    width: '100%',
    backgroundColor: 'rgba(10,16,32,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldLine,
    padding: 16,
    gap: 10,
  },
  sceneCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sceneCardLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  sceneEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  sceneEditText: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.goldBright,
  },
  sceneCardQuote: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
    lineHeight: 22,
  },
  eduCard: {
    width: '100%',
    backgroundColor: 'rgba(245,240,232,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.09)',
    padding: 14,
    gap: 6,
    position: 'relative',
  },
  eduCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  eduTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 12.5,
    letterSpacing: 1.4,
    color: colors.boneSoft,
    textTransform: 'uppercase',
  },
  eduBody: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.boneFaint,
    lineHeight: 18,
  },
  whyLink: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  whyLinkText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.goldDim,
    textDecorationLine: 'underline',
  },
  pillWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  bottomActions: {
    paddingHorizontal: 22,
    paddingTop: 10,
    backgroundColor: '#04060c',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,4,10,0.65)',
  },
  sheetContainer: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 8,
  },
  sheetGrab: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,240,232,0.16)',
    alignSelf: 'center',
    marginBottom: 2,
  },
  sheetTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 17,
    letterSpacing: 0.6,
    color: colors.bone,
    textAlign: 'center',
  },
  sheetInputWrap: {
    position: 'relative',
  },
  sheetTextInput: {
    backgroundColor: 'rgba(245,240,232,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: 14,
    paddingBottom: 28,
    color: colors.bone,
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  sheetCharCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    color: colors.boneFaint,
  },
  sheetActionsStack: {
    gap: 10,
    marginTop: 2,
  },
  sheetSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  sheetGhostBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sheetGhostText: {
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    color: colors.boneSoft,
  },
});
