import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pause, Play, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useKeepAwake } from "expo-keep-awake";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/types";
import { useAnchorStore } from "@/stores/anchorStore";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { useReduceMotionEnabled } from "@/hooks/useReduceMotionEnabled";
import { PracticeCompletionService } from "@/services/PracticeCompletionService";
import { AnalyticsEvents, AnalyticsService } from "@/services/AnalyticsService";
import { resolveSessionAudioPlan } from "@/services/SessionAudioManifest";
import { getVisualizeSessionAudioManifest } from "@/services/visualizeAudioManifest";
import { colors, typography } from "@/theme";
import { safeHaptics } from "@/utils/haptics";
import { VisualizeAnchorField } from "./VisualizeAnchorField";
import {
  VISUALIZE_PHASE_PRESENTATION,
  getVisualizationLensSize,
  getVisualizePresentationPhase,
  getVisualizeSegmentState,
} from "./visualizePresentation";
import { VisualizationAnchorLens, VisualizationPhaseProgress } from './VisualizationPrimitives';
import { useVisualizeSessionAudio } from "./useVisualizeSessionAudio";
import { useVisualizeSessionEngine } from "./useVisualizeSessionEngine";

type Props = NativeStackScreenProps<RootStackParamList, "VisualizeSession">;

const KeepAwake: React.FC = () => {
  useKeepAwake("visualize-session");
  return null;
};

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const VisualizeSessionScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const window = useWindowDimensions();
  const anchor = useAnchorStore((state) =>
    state.getAnchorById(route.params.anchorId),
  );
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const reduceMotion = useReduceMotionEnabled();
  const performanceTier = usePerformanceTier();
  const sessionIdRef = useRef(
    `visualize:${accountId ?? "guest"}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
  );
  const completionRef = useRef(false);
  const exitingRef = useRef(false);
  const exitPromptOpenRef = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [displayPhase, setDisplayPhase] = useState(
    getVisualizePresentationPhase("arrive"),
  );
  const [feedback, setFeedback] = useState<"Paused" | "Resumed" | null>(null);
  const copyOpacity = useRef(new Animated.Value(1)).current;
  const copyTranslateY = useRef(new Animated.Value(0)).current;
  const phaseReveal = useRef(new Animated.Value(1)).current;
  const directiveReveal = useRef(new Animated.Value(1)).current;
  const sceneReveal = useRef(new Animated.Value(1)).current;
  const audioWave = useRef(new Animated.Value(0)).current;
  const iconReveal = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const phaseTransitionRef = useRef<Animated.CompositeAnimation | null>(null);

  const complete = useCallback(
    async ({
      startedAt,
      completedAt,
    }: {
      startedAt: string;
      completedAt: string;
    }) => {
      if (!anchor || !accountId || completionRef.current) return;
      completionRef.current = true;
      await PracticeCompletionService.commitVisualizeCompletion({
        id: sessionIdRef.current,
        accountId,
        anchor,
        durationSeconds: route.params.durationSeconds,
        startedAt,
        completedAt,
        guidanceVoice: route.params.guidanceVoice,
        backgroundAudio: route.params.backgroundAudio,
        sceneSnapshot: route.params.sceneText,
      });
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
        practice_mode: "visualize",
        session_id: sessionIdRef.current,
        anchor_id: anchor.id,
        duration_seconds: route.params.durationSeconds,
        guidance_voice: route.params.guidanceVoice,
        background_audio: route.params.backgroundAudio,
        sync_outcome: "queued",
        completed_at: completedAt,
      });
    },
    [accountId, anchor, route.params],
  );

  const engine = useVisualizeSessionEngine({
    durationSeconds: route.params.durationSeconds,
    hapticsEnabled: hapticIntensity > 0,
    onComplete: complete,
  });
  const lastRuntimePhaseRef = useRef(engine.phase.id);

  const audioPlan = useMemo(
    () =>
      resolveSessionAudioPlan({
        sessionType: "visualize",
        durationSeconds: route.params.durationSeconds,
        configuration: {
          guidanceVoice: route.params.guidanceVoice,
          backgroundAudio: route.params.backgroundAudio,
          source: "session_override",
        },
      }),
    [
      route.params.backgroundAudio,
      route.params.durationSeconds,
      route.params.guidanceVoice,
    ],
  );
  const visualizeAudioManifest = useMemo(
    () => getVisualizeSessionAudioManifest(route.params.durationSeconds),
    [route.params.durationSeconds],
  );
  const handleAudioInterruption = useCallback(
    () => engine.pause("audio_interruption"),
    [engine.pause],
  );
  const sessionAudio = useVisualizeSessionAudio({
    plan: audioPlan,
    manifest: visualizeAudioManifest,
    elapsedMs: engine.elapsedMs,
    isActive: engine.state === "running",
    isComplete:
      engine.state === "completing" ||
      engine.state === "completed",
    onInterruption: handleAudioInterruption,
  });
  const { fadeOutAndStop } = sessionAudio;

  const continueAfterExitPrompt = useCallback(() => {
    exitPromptOpenRef.current = false;
    engine.resume();
  }, [engine.resume]);

  const confirmEarlyEnd = useCallback((navigateAfterStop: () => void) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    exitPromptOpenRef.current = false;
    engine.endEarly();
    void fadeOutAndStop().finally(navigateAfterStop);
  }, [engine.endEarly, fadeOutAndStop]);

  const showEarlyExitPrompt = useCallback((navigateAfterStop: () => void) => {
    if (exitingRef.current || exitPromptOpenRef.current) return;
    exitPromptOpenRef.current = true;
    engine.pause("exit_prompt");
    Alert.alert(
      "End visualization?",
      "Your progress in this session will not be recorded.",
      [
        {
          text: "Continue Session",
          style: "cancel",
          onPress: continueAfterExitPrompt,
        },
        {
          text: "End Session",
          style: "destructive",
          onPress: () => confirmEarlyEnd(navigateAfterStop),
        },
      ],
    );
  }, [confirmEarlyEnd, continueAfterExitPrompt, engine.pause]);

  useEffect(() => {
    engine.start();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
      practice_mode: "visualize",
      session_id: sessionIdRef.current,
      anchor_id: route.params.anchorId,
      duration_seconds: route.params.durationSeconds,
      guidance_voice: route.params.guidanceVoice,
      background_audio: route.params.backgroundAudio,
      started_at: new Date().toISOString(),
    });
    // Engine start is deliberately one-shot for this route instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engine.state !== "completed") return;
    navigation.replace("VisualizeCompletion", {
      anchorId: route.params.anchorId,
      sessionId: sessionIdRef.current,
      durationSeconds: route.params.durationSeconds,
    });
  }, [
    engine.state,
    navigation,
    route.params.anchorId,
    route.params.durationSeconds,
  ]);

  useEffect(() => {
    if (engine.state !== "running") {
      setControlsVisible(true);
      return;
    }
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [controlsVisible, engine.state]);

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: reduceMotion ? 0 : 280,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, controlsVisible, reduceMotion]);

  useEffect(() => {
    if (lastRuntimePhaseRef.current === engine.phase.id) return;
    lastRuntimePhaseRef.current = engine.phase.id;
    const nextPhase = getVisualizePresentationPhase(engine.phase.id);
    phaseTransitionRef.current?.stop();

    if (reduceMotion) {
      setDisplayPhase(nextPhase);
      copyOpacity.setValue(1);
      copyTranslateY.setValue(0);
      phaseReveal.setValue(1);
      directiveReveal.setValue(1);
      sceneReveal.setValue(1);
      return;
    }

    const transition = Animated.sequence([
      Animated.parallel([
        Animated.timing(copyOpacity, {
          toValue: 0,
          duration: 130,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(copyTranslateY, {
          toValue: -7,
          duration: 130,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(20),
    ]);

    transition.start(({ finished }) => {
      if (!finished) return;
      setDisplayPhase(nextPhase);
      copyOpacity.setValue(1);
      copyTranslateY.setValue(7);
      phaseReveal.setValue(0);
      directiveReveal.setValue(0);
      sceneReveal.setValue(0);

      phaseTransitionRef.current = Animated.parallel([
        Animated.timing(copyTranslateY, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.stagger(85, [
          Animated.timing(phaseReveal, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(directiveReveal, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(sceneReveal, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]);
      phaseTransitionRef.current.start();
    });
    phaseTransitionRef.current = transition;

    return () => transition.stop();
  }, [
    copyOpacity,
    copyTranslateY,
    directiveReveal,
    engine.phase.id,
    phaseReveal,
    reduceMotion,
    sceneReveal,
  ]);

  useEffect(() => {
    audioWave.stopAnimation();
    if (reduceMotion || engine.state !== "running") {
      audioWave.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(audioWave, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(audioWave, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [audioWave, engine.state, reduceMotion]);

  useEffect(() => {
    iconReveal.stopAnimation();
    if (reduceMotion) {
      iconReveal.setValue(1);
      return;
    }
    iconReveal.setValue(0);
    Animated.timing(iconReveal, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [engine.state, iconReveal, reduceMotion]);

  useEffect(
    () => () => {
      phaseTransitionRef.current?.stop();
      audioWave.stopAnimation();
      iconReveal.stopAnimation();
      feedbackOpacity.stopAnimation();
    }, [
      audioWave,
      feedbackOpacity,
      iconReveal,
    ],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (
        exitingRef.current ||
        engine.state === "completed" ||
        engine.state === "completing"
      ) {
        return;
      }
      event.preventDefault();
      showEarlyExitPrompt(() => navigation.dispatch(event.data.action));
    });
    return unsubscribe;
  }, [engine.state, navigation, showEarlyExitPrompt]);

  const requestEarlyEnd = () => {
    showEarlyExitPrompt(() => navigation.goBack());
  };

  const togglePlayback = () => {
    const willResume = engine.state === "paused";
    if (hapticIntensity > 0) void safeHaptics.selection();
    willResume ? engine.resume() : engine.pause();
    setControlsVisible(true);
    setFeedback(willResume ? "Resumed" : "Paused");
    feedbackOpacity.stopAnimation();
    feedbackOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 130,
        useNativeDriver: true,
      }),
      Animated.delay(620),
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setFeedback(null);
    });
  };

  if (!anchor || !accountId) return <View style={styles.container} />;
  const currentPresentationPhase = getVisualizePresentationPhase(
    engine.phase.id,
  );
  const presentation = VISUALIZE_PHASE_PRESENTATION[displayPhase];
  const currentPhaseIndex = engine.schedule.findIndex(
    (phase) => phase.id === engine.phase.id,
  );
  const sigilSvg = anchor.reinforcedSigilSvg || anchor.baseSigilSvg || "";
  const heroSize = getVisualizationLensSize('practice', window.width);
  const phaseLabel = `PHASE ${currentPhaseIndex + 1} OF ${engine.schedule.length} · ${presentation.title}`;

  return (
    <Pressable
      style={styles.container}
      onPress={() => setControlsVisible((value) => !value)}
    >
      {engine.state === "running" ? <KeepAwake /> : null}
      <LinearGradient
        colors={VISUALIZE_PHASE_PRESENTATION[currentPresentationPhase].gradient}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <Animated.View
          pointerEvents={controlsVisible ? "auto" : "none"}
          style={[styles.topControls, { opacity: controlsOpacity }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End visualization"
            onPress={(event) => {
              event.stopPropagation();
              requestEarlyEnd();
            }}
            style={styles.circleButton}
          >
            <X color="#F4EDD8" size={19} />
          </Pressable>
          <Text
            accessibilityLabel={`${engine.remainingSeconds} seconds remaining`}
            style={styles.time}
          >
            {formatTime(engine.remainingSeconds)}
          </Text>
          <View style={styles.circleButton} />
        </Animated.View>

        <VisualizationPhaseProgress
          label={phaseLabel}
          segmentStates={engine.schedule.map((_, index) =>
            getVisualizeSegmentState(index, currentPhaseIndex),
          )}
        />

        <View style={styles.stage}>
          <VisualizeAnchorField
            phase={currentPresentationPhase}
            phaseProgress={engine.phaseProgress}
            totalProgress={engine.totalProgress}
            active={engine.state === "running"}
            reduceMotion={reduceMotion}
            performanceTier={performanceTier}
            heroSize={heroSize}
            compact={window.height < 720}
          >
            <VisualizationAnchorLens size={heroSize} imageUrl={anchor.enhancedImageUrl} svg={sigilSvg} />
          </VisualizeAnchorField>
        </View>

        <Animated.View
          style={[
            styles.copy,
            {
              opacity: copyOpacity,
              transform: [{ translateY: copyTranslateY }],
            },
          ]}
        >
          <Animated.View
            style={[styles.directiveHaze, { opacity: directiveReveal }]}
          >
            <Animated.Text style={[styles.phaseTitle, { opacity: phaseReveal }]}>
              {presentation.title}
            </Animated.Text>
            <Text accessibilityLiveRegion="polite" style={styles.cue}>
              {engine.currentCue?.text ?? presentation.supportingInstruction}
            </Text>
          </Animated.View>
          <Animated.Text
            numberOfLines={4}
            ellipsizeMode="tail"
            style={[
              styles.sceneSupport,
              {
                opacity: sceneReveal,
                transform: [
                  {
                    scale: sceneReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.985, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {route.params.sceneText}
          </Animated.Text>
        </Animated.View>

        <Animated.View
          pointerEvents={controlsVisible ? "auto" : "none"}
          style={[styles.bottomControls, { opacity: controlsOpacity }]}
        >
          <View style={styles.audioControlField}>
            {feedback ? (
              <Animated.Text
                accessibilityLiveRegion="polite"
                style={[styles.audioFeedback, { opacity: feedbackOpacity }]}
              >
                {feedback}
              </Animated.Text>
            ) : null}
            <Animated.View
              style={[
                styles.audioWaveRing,
                {
                  opacity: audioWave.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.12, 0.34],
                  }),
                  transform: [
                    {
                      scale: audioWave.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1.1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.waveform} pointerEvents="none">
              {[0.58, 1, 0.72].map((height, index) => (
                <Animated.View
                  key={`audio-wave-${index}`}
                  style={[
                    styles.waveBar,
                    {
                      height: 15 * height,
                      transform: [
                        {
                          scaleY: audioWave.interpolate({
                            inputRange: [0, 1],
                            outputRange:
                              index === 1 ? [0.5, 1] : [0.72, 1.12],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                engine.state === "paused"
                  ? "Resume visualization"
                  : "Pause visualization"
              }
              accessibilityState={{ disabled: engine.state === "completing" }}
              disabled={engine.state === "completing"}
              onPress={(event) => {
                event.stopPropagation();
                togglePlayback();
              }}
              style={styles.pauseButton}
            >
              <Animated.View
                style={{
                  opacity: iconReveal,
                  transform: [
                    {
                      scale: iconReveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                }}
              >
                {engine.state === "paused" ? (
                  <Play color="#071321" fill="#071321" size={22} />
                ) : (
                  <Pause color="#071321" fill="#071321" size={22} />
                )}
              </Animated.View>
            </Pressable>
          </View>
          <View style={styles.totalTrack}>
            <View
              style={[
                styles.totalFill,
                { width: `${engine.totalProgress * 100}%` },
              ]}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06101F" },
  safe: { flex: 1 },
  topControls: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,10,20,.36)",
  },
  time: {
    color: "#F4EDD8",
    fontFamily: typography.fonts.body,
    fontVariant: ["tabular-nums"],
    fontSize: 14,
  },
  stage: {
    flex: 1,
    minHeight: 228,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    minHeight: 202,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  phaseTitle: {
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 2.7,
    marginBottom: 7,
  },
  directiveHaze: {
    width: "100%",
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: "rgba(6,17,31,.46)",
    borderWidth: 1,
    borderColor: "rgba(224,237,248,.1)",
  },
  cue: {
    color: "#F4EDD8",
    fontFamily: typography.fonts.body,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  sceneSupport: {
    color: "rgba(244,237,216,.78)",
    fontFamily: typography.fonts.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },
  bottomControls: {
    paddingHorizontal: 28,
    paddingBottom: 14,
    alignItems: "center",
    gap: 10,
  },
  audioControlField: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,21,37,.45)",
    borderWidth: 1,
    borderColor: "rgba(224,232,240,.09)",
  },
  audioWaveRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(232,198,91,.58)",
  },
  waveform: {
    position: "absolute",
    bottom: -2,
    height: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: "rgba(226,199,105,.72)",
  },
  audioFeedback: {
    position: "absolute",
    top: -24,
    color: "rgba(244,237,216,.72)",
    fontFamily: typography.fonts.body,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  pauseButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  totalTrack: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,.12)",
    overflow: "hidden",
  },
  totalFill: { height: "100%", backgroundColor: colors.gold },
});
