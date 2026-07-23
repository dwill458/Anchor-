import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/types";
import { useAnchorStore } from "@/stores/anchorStore";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVisualizationSceneStore } from "@/stores/visualizationSceneStore";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import VisualizationSceneService, {
  normalizeVisualizationSceneText,
  validateVisualizationSceneText,
} from "@/services/VisualizationSceneService";
import { AnalyticsEvents, AnalyticsService } from "@/services/AnalyticsService";
import {
  SessionConfigurationPill,
  SessionConfigurationSheet,
} from "@/components/practice/SessionConfiguration";
import { colors, spacing, typography } from "@/theme";
import type { SessionAudioDefaults } from "@/types/sessionAudio";
import { MicroTeachCard } from "@/components/teaching";
import { useTeachingGate } from "@/utils/useTeachingGate";
import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { getVisualizationLensSize, shouldPinPreparationCta } from "./visualizePresentation";
import { VisualizationAnchorLens, VisualizationPrimaryButton } from './VisualizationPrimitives';

type Props = NativeStackScreenProps<RootStackParamList, "VisualizePreparation">;

export const VisualizePreparationScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { navigateToPaywall } = useTabNavigation();
  const anchor = useAnchorStore((state) =>
    state.getAnchorById(route.params.anchorId),
  );
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const { hasActiveEntitlement, subscriptionStatus } = useTrialStatus();
  const globalDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults.visualize,
  );
  const defaultDuration = useSettingsStore(
    (state) => state.visualizeSessionDuration,
  );
  const recentDuration = useSettingsStore(
    (state) => state.lastSessionDurationByMode.visualize,
  );
  const setRecentDuration = useSettingsStore(
    (state) => state.setLastSessionDuration,
  );
  const scene = useVisualizationSceneStore(
    (state) =>
      state.scenes[route.params.anchorId] ??
      (anchor?.localId ? state.scenes[anchor.localId] : undefined),
  );
  const suggestions = useVisualizationSceneStore(
    (state) =>
      state.suggestions[route.params.anchorId] ??
      (anchor?.localId ? state.suggestions[anchor.localId] : undefined) ??
      [],
  );
  const [duration, setDuration] = useState<60 | 180 | 300>(
    recentDuration ?? defaultDuration,
  );
  const [audio, setAudio] = useState<SessionAudioDefaults>({
    ...globalDefaults,
  });
  const [sceneText, setSceneText] = useState("");
  const [loading, setLoading] = useState(hasActiveEntitlement);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configVisible, setConfigVisible] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [stickyCta, setStickyCta] = useState(false);
  const startingRef = useRef(false);
  const sceneTeaching = useTeachingGate({
    screenId: "visualize_preparation",
    candidateIds: ["visualize_scene_explainer"],
  });

  const sigilSvg = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || "";
  const imageUrl = anchor?.enhancedImageUrl;
  const validationError = useMemo(
    () => validateVisualizationSceneText(sceneText),
    [sceneText],
  );
  const savedSceneText = normalizeVisualizationSceneText(
    scene?.currentText ?? "",
  );
  const hasUnsavedChanges =
    !!scene && normalizeVisualizationSceneText(sceneText) !== savedSceneText;
  const artworkSize = getVisualizationLensSize('entrance', window.width);
  const compactHeight = window.height < 780;
  const stickyButtonHeight = 52 + 10 + insets.bottom;

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
      const result = loaded
        ? null
        : await VisualizationSceneService.generate(anchor, accountId);
      if (!active) return;
      const resolved = loaded ?? result?.scene;
      setSceneText(resolved?.currentText ?? "");
      if (result) {
        AnalyticsService.track(AnalyticsEvents.VISUALIZE_SCENE_GENERATED, {
          anchor_id: anchor.id,
          source: result.scene.generationSource,
          version: result.scene.generationVersion,
          fallback: result.fallbackUsed,
        });
        if (result.fallbackUsed) {
          AnalyticsService.track(
            AnalyticsEvents.VISUALIZE_SCENE_FALLBACK_USED,
            {
              anchor_id: anchor.id,
              source: result.scene.generationSource,
            },
          );
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [
    accountId,
    anchor,
    hasActiveEntitlement,
    route.params.anchorId,
    subscriptionStatus,
  ]);

  useEffect(() => {
    if (scene && !sceneText) setSceneText(scene.currentText);
  }, [scene, sceneText]);

  useEffect(() => {
    setStickyCta(false);
    setViewportHeight(0);
    setContentHeight(0);
  }, [window.height, window.width]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (
      !stickyCta &&
      shouldPinPreparationCta(contentHeight, viewportHeight, false)
    ) {
      setStickyCta(true);
    }
  }, [contentHeight, stickyCta, viewportHeight]);

  const saveScene = useCallback(async () => {
    if (!anchor || !scene || validationError) {
      setError(validationError);
      return;
    }
    if (!hasUnsavedChanges) return;
    setSaving(true);
    setError(null);
    await VisualizationSceneService.save(anchor, {
      ...scene,
      currentText: sceneText.trim(),
      generationSource:
        sceneText.trim() === scene.originalSuggestion
          ? scene.generationSource
          : "user_edited",
      clientUpdatedAt: new Date().toISOString(),
    });
    AnalyticsService.track(AnalyticsEvents.VISUALIZE_SCENE_EDITED, {
      anchor_id: anchor.id,
      source: "preparation",
    });
    setSaving(false);
  }, [anchor, hasUnsavedChanges, scene, sceneText, validationError]);

  const tryAnother = useCallback(async () => {
    if (!anchor || !accountId) return;
    AnalyticsService.track(AnalyticsEvents.VISUALIZE_SUGGESTION_REQUESTED, {
      anchor_id: anchor.id,
    });
    let next = suggestions[suggestionIndex + 1];
    if (!next) {
      const generated = await VisualizationSceneService.generate(
        anchor,
        accountId,
      );
      next = generated.suggestions[0];
      setSuggestionIndex(0);
    } else {
      setSuggestionIndex((value) => value + 1);
    }
    setSceneText(next);
    setError(null);
  }, [accountId, anchor, suggestionIndex, suggestions]);

  if (!anchor) return <View style={styles.container} />;

  const start = async () => {
    // Guard against double-taps: saveScene() is awaited before we navigate, so
    // a second press could otherwise fire a duplicate replace("VisualizeSession").
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await runStart();
    } finally {
      // Only the success path navigates away; reset so paywall/validation/error
      // exits stay tappable.
      startingRef.current = false;
    }
  };

  const runStart = async () => {
    if (!hasActiveEntitlement) {
      AnalyticsService.track(AnalyticsEvents.VISUALIZE_PRO_LOCK_VIEWED, {
        anchor_id: anchor.id,
        tier: subscriptionStatus,
      });
      AnalyticsService.track(AnalyticsEvents.VISUALIZE_TRIAL_CTA_SELECTED, {
        anchor_id: anchor.id,
        tier: subscriptionStatus,
      });
      navigateToPaywall({
        source: "gated_feature",
        preferredPlanId: "annual",
        resumeTarget: { kind: "visualize_prepare", anchorId: anchor.id },
      });
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    await saveScene();
    setRecentDuration("visualize", duration);
    navigation.replace("VisualizeSession", {
      anchorId: anchor.id,
      durationSeconds: duration,
      sceneText: sceneText.trim(),
      guidanceVoice: audio.guidanceVoice,
      backgroundAudio: audio.backgroundAudio,
    });
  };

  const beginCta = (
    <View
      testID={stickyCta ? "visualize-begin-sticky" : "visualize-begin-inline"}
      style={[styles.begin, stickyCta && styles.beginSticky]}
    >
      <VisualizationPrimaryButton
        label={hasActiveEntitlement ? "BEGIN VISUALIZATION" : "UNLOCK VISUALIZE"}
        onPress={() => void start()}
      />
    </View>
  );

  return (
    <LinearGradient
      colors={["#06101F", "#0B2440", "#071321"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <ArrowLeft color={colors.gold} size={20} />
          </Pressable>
          <Text style={styles.headerTitle}>VISUALIZE</Text>
          <View style={styles.iconButton} />
        </View>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              compactHeight && styles.contentCompact,
              stickyCta && { paddingBottom: stickyButtonHeight + 28 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onLayout={(event) =>
              setViewportHeight(event.nativeEvent.layout.height)
            }
            onContentSizeChange={(_width, height) => setContentHeight(height)}
          >
          <Text style={styles.eyebrow}>MENTAL REHEARSAL</Text>
          <Text style={styles.title}>
            See the moment.{`\n`}Feel the choice.
          </Text>
          <Text style={styles.subtitle}>
            Rehearse a real behavior through five quiet phases. Your Anchor
            supports the scene—it never becomes literal imagery.
          </Text>
          <View style={[styles.artwork, { height: artworkSize + 8 }]}>
            <VisualizationAnchorLens size={artworkSize} imageUrl={imageUrl} svg={sigilSvg} />
          </View>
          <View style={styles.intentionCard}>
            <Text style={styles.sceneLabel}>ORIGINAL INTENTION</Text>
            <Text
              style={styles.intentionText}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {anchor.intentionText}
            </Text>
          </View>
          <View style={styles.sceneCard}>
            <View style={styles.sceneHeader}>
              <Text style={[styles.sceneLabel, styles.sceneHeaderLabel]}>
                YOUR SCENE
              </Text>
              {hasActiveEntitlement && !loading ? (
                <Text style={styles.count}>{sceneText.length}/180</Text>
              ) : null}
            </View>
            {!hasActiveEntitlement ? (
              <View style={styles.locked}>
                <LockKeyhole color={colors.gold} size={23} />
                <Text style={styles.lockedTitle}>Preview the practice</Text>
                <Text style={styles.lockedText}>
                  Your scene is generated only after Pro or trial access is
                  confirmed.
                </Text>
              </View>
            ) : loading ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Visualization scene"
                  multiline
                  value={sceneText}
                  maxLength={180}
                  onChangeText={(text) => {
                    setSceneText(text);
                    setError(null);
                  }}
                  style={styles.sceneInput}
                />
                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}
                <View style={styles.sceneActions}>
                  <Pressable
                    onPress={() => void tryAnother()}
                    style={styles.sceneActionButton}
                  >
                    <RefreshCw color={colors.gold} size={14} />
                    <Text style={styles.textButtonLabel}>Try Another</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (scene) {
                        setSceneText(scene.originalSuggestion);
                        AnalyticsService.track(
                          AnalyticsEvents.VISUALIZE_ORIGINAL_RESTORED,
                          { anchor_id: anchor.id },
                        );
                      }
                    }}
                    style={styles.sceneActionButton}
                  >
                    <RotateCcw color={colors.gold} size={14} />
                    <Text style={styles.textButtonLabel}>Restore Original</Text>
                  </Pressable>
                </View>
                {hasUnsavedChanges ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: saving || !!validationError,
                    }}
                    disabled={saving || !!validationError}
                    onPress={() => void saveScene()}
                    style={styles.saveScene}
                  >
                    <Text style={styles.saveSceneText}>
                      {saving ? "Saving…" : "Save Scene"}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
          <MicroTeachCard
            teaching={sceneTeaching}
            screenId="visualize_preparation"
            style={styles.teachingCard}
          />
          <View style={styles.configurationBlock}>
            <Text style={styles.sceneLabel}>THIS SESSION</Text>
            <SessionConfigurationPill
              value={audio}
              durationSeconds={duration}
              onPress={() => setConfigVisible(true)}
            />
          </View>
            {!stickyCta ? beginCta : null}
          </ScrollView>
          {stickyCta && !keyboardVisible ? (
            <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 8 }]}>{beginCta}</View>
          ) : null}
        </KeyboardAvoidingView>
        <SessionConfigurationSheet
          visible={configVisible}
          value={audio}
          onChange={(next) => {
            setAudio(next);
            AnalyticsService.track(
              AnalyticsEvents.PRACTICE_TEMPORARY_SETTINGS_CHANGED,
              {
                practice_mode: "visualize",
                guidance_voice: next.guidanceVoice,
                background_audio: next.backgroundAudio,
                duration_seconds: duration,
              },
            );
          }}
          sessionType="visualize"
          durationSeconds={duration}
          durationOptions={[60, 180, 300]}
          onDurationChange={(next) => setDuration(next as 60 | 180 | 300)}
          onClose={() => setConfigVisible(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06101F" },
  safe: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    height: 50,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 3,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    alignItems: "stretch",
  },
  contentCompact: { paddingHorizontal: 20, paddingBottom: 16 },
  eyebrow: {
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 2.6,
    textAlign: "center",
    marginTop: 4,
  },
  title: {
    color: "#F4EDD8",
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
    marginTop: 7,
  },
  subtitle: {
    color: "rgba(224,231,239,.65)",
    fontFamily: typography.fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  },
  artwork: { alignItems: "center", justifyContent: "center", marginTop: 2 },
  sceneCard: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: "rgba(5,17,31,.72)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.2)",
  },
  sceneLabel: {
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 2.2,
    marginBottom: 7,
  },
  sceneHeader: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  sceneHeaderLabel: { marginBottom: 0 },
  sceneInput: {
    minHeight: 68,
    maxHeight: 92,
    color: "#F5F0DF",
    fontFamily: typography.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  count: {
    color: "rgba(255,255,255,.35)",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  error: { color: "#E89087", fontSize: 12, marginTop: 4 },
  sceneActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 9,
    gap: 8,
  },
  sceneActionButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: "rgba(212,175,55,.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212,175,55,.18)",
  },
  textButtonLabel: {
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontSize: 11,
  },
  saveScene: {
    marginTop: 4,
    alignSelf: "flex-end",
    minHeight: 36,
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(212,175,55,.1)",
  },
  saveSceneText: { color: colors.gold, fontSize: 11 },
  locked: { alignItems: "center", paddingVertical: 12, gap: 6 },
  lockedTitle: {
    color: "#F4EDD8",
    fontFamily: typography.fonts.heading,
    fontSize: 16,
  },
  lockedText: {
    color: "rgba(224,231,239,.6)",
    textAlign: "center",
    lineHeight: 19,
  },
  teachingCard: { marginTop: 12 },
  begin: { marginTop: 12 },
  beginSticky: { marginTop: 0 },
  intentionCard: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 25,
    backgroundColor: "rgba(5,17,31,.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.07)",
  },
  intentionText: {
    color: "rgba(244,237,216,.78)",
    fontFamily: typography.fonts.body,
    fontSize: 14,
    lineHeight: 19,
  },
  configurationBlock: { marginTop: 14, marginBottom: 2 },
  stickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "rgba(5,14,27,.94)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,175,55,.18)",
  },
});
