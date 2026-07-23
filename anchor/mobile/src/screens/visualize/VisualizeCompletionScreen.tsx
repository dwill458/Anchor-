import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/types";
import { useAnchorStore } from "@/stores/anchorStore";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { PracticeCompletionService } from "@/services/PracticeCompletionService";
import { AnalyticsEvents, AnalyticsService } from "@/services/AnalyticsService";
import { colors, typography } from "@/theme";
import { getVisualizationLensSize } from './visualizePresentation';
import {
  VisualizationAnchorLens,
  VisualizationPhaseProgress,
  VisualizationPrimaryButton,
} from './VisualizationPrimitives';

type Props = NativeStackScreenProps<RootStackParamList, "VisualizeCompletion">;

export const VisualizeCompletionScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const window = useWindowDimensions();
  const anchor = useAnchorStore((state) =>
    state.getAnchorById(route.params.anchorId),
  );
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const completedSession = useSessionStore((state) =>
    state.practiceHistory.find(
      (session) => session.id === route.params.sessionId,
    ),
  );
  const [nextAction, setNextAction] = useState("");
  const [saved, setSaved] = useState(false);
  const sigilSvg = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || "";
  const allowsNextAction = route.params.durationSeconds > 60;
  const durationLabel = useMemo(
    () =>
      `${route.params.durationSeconds / 60} minute${route.params.durationSeconds === 60 ? "" : "s"}`,
    [route.params.durationSeconds],
  );
  const lensSize = getVisualizationLensSize('completion', window.width);

  const saveNextAction = async () => {
    if (!accountId || !nextAction.trim()) return;
    await PracticeCompletionService.saveNextAction({
      accountId,
      sessionId: route.params.sessionId,
      nextAction,
    });
    setSaved(true);
    AnalyticsService.track(AnalyticsEvents.VISUALIZE_NEXT_ACTION_SAVED, {
      session_id: route.params.sessionId,
      anchor_id: route.params.anchorId,
      duration_seconds: route.params.durationSeconds,
      sync_outcome: "queued",
    });
  };

  return (
    <LinearGradient
      colors={["#071321", "#102B47", "#071321"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>MENTAL REHEARSAL COMPLETE</Text>
          <Text style={styles.title}>SCENE REHEARSED</Text>
          <Text style={styles.subtitle}>
            You rehearsed the moment, practiced how you would respond, and
            connected that experience to your anchor.
          </Text>
          <View style={[styles.artwork, { height: lensSize + 16 }]}>
            <VisualizationAnchorLens size={lensSize} imageUrl={anchor?.enhancedImageUrl} svg={sigilSvg} />
          </View>
          <VisualizationPhaseProgress
            label="FIVE PHASES COMPLETE"
            segmentStates={['completed', 'completed', 'completed', 'completed', 'completed']}
          />

          <View style={styles.summaryCard}>
            <Text style={styles.actionLabel}>SESSION SUMMARY</Text>
            <Text style={styles.summaryMeta}>Duration · {durationLabel}</Text>
            <Text style={styles.summaryLabel}>Scene</Text>
            <Text style={styles.summaryText}>
              {completedSession?.sceneSnapshot ||
                route.params.sceneText ||
                'Scene unavailable'}
            </Text>
            <Text style={styles.summaryLabel}>Intention</Text>
            <Text style={styles.summaryText}>{anchor?.intentionText}</Text>
          </View>

          {allowsNextAction ? (
            <View style={styles.actionCard}>
              <Text style={styles.actionLabel}>CARRY IT FORWARD</Text>
              <Text style={styles.prompt}>
                What is one action that matches the version of you that you just
                rehearsed?
              </Text>
              <TextInput
                accessibilityLabel="Next action"
                placeholder="Optional next action…"
                placeholderTextColor="rgba(230,235,240,.35)"
                value={nextAction}
                onChangeText={(value) => {
                  setNextAction(value.slice(0, 240));
                  setSaved(false);
                }}
                multiline
                style={styles.input}
              />
              <View style={styles.inputFooter}>
                <Text style={styles.count}>{nextAction.length}/240</Text>
                <Pressable
                  disabled={!nextAction.trim()}
                  onPress={() => void saveNextAction()}
                >
                  <Text style={styles.save}>{saved ? "Saved" : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.actionSection}>
            <VisualizationPrimaryButton
              label="PRACTICE AGAIN"
              onPress={() => {
              AnalyticsService.track(
                AnalyticsEvents.VISUALIZE_PRACTICE_AGAIN_SELECTED,
                { anchor_id: route.params.anchorId },
              );
              navigation.replace("VisualizePreparation", {
                anchorId: route.params.anchorId,
                source: "practice_again",
              });
              }}
            />
          <Pressable
            onPress={() => {
              AnalyticsService.track(
                AnalyticsEvents.VISUALIZE_RETURN_TO_SANCTUARY_SELECTED,
                { anchor_id: route.params.anchorId },
              );
              navigation.popToTop();
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>RETURN TO SANCTUARY</Text>
          </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: "stretch",
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 2.6,
    textAlign: "center",
  },
  title: {
    color: "#F4EDD8",
    fontFamily: typography.fonts.heading,
    fontSize: 29,
    lineHeight: 38,
    textAlign: "center",
    marginTop: 10,
  },
  subtitle: {
    color: "rgba(224,231,239,.62)",
    fontFamily: typography.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 9,
  },
  artwork: { alignItems: "center", justifyContent: "center", marginTop: 2 },
  summaryCard: {
    borderRadius: 25,
    padding: 17,
    backgroundColor: "rgba(5,17,31,.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    marginTop: 14,
    marginBottom: 10,
  },
  summaryMeta: {
    color: "#F4EDD8",
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    marginTop: 7,
  },
  summaryLabel: {
    color: colors.gold,
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 10,
  },
  summaryText: {
    color: "rgba(244,237,216,.76)",
    fontFamily: typography.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  actionCard: {
    borderRadius: 25,
    padding: 17,
    backgroundColor: "rgba(5,17,31,.66)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.18)",
  },
  actionLabel: {
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 2,
  },
  prompt: {
    color: "rgba(244,237,216,.72)",
    fontFamily: typography.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  input: {
    minHeight: 55,
    color: "#F4EDD8",
    fontFamily: typography.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    marginTop: 10,
  },
  inputFooter: { flexDirection: "row", justifyContent: "space-between" },
  count: { color: "rgba(255,255,255,.3)", fontSize: 10 },
  save: { color: colors.gold, fontFamily: typography.fonts.body, fontSize: 12 },
  actionSection: { marginTop: 16 },
  secondary: { paddingVertical: 18, alignItems: "center" },
  secondaryText: {
    color: "rgba(244,237,216,.72)",
    fontFamily: typography.fonts.body,
    fontSize: 12,
    letterSpacing: 1.2,
  },
});
