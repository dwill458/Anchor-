import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useSessionAudio, type ManagedSessionAudioPlayer } from '@/hooks/useSessionAudio';
import { FULL_MIX_PHASE_ID, resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { useAnchorTransitionPlace } from '@/navigation/v2/ProgressiveFocusTransition';
import { resolveFocusSessionGeometry } from '@/navigation/v2/anchorHeroGeometry';
import { safeHaptics } from '@/utils/haptics';
import { playCreationSound } from '@/services/CreationSounds';
import { setAudioSessionMode } from '@/services/audio/AudioSession';
import { AnchorMotion, colors, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { V2FocusAnchorArtwork } from '../focus/V2FocusAnchorArtwork';
import { V2FocusField } from '../focus/V2FocusField';
import { FOCUS_SCREEN_BACKGROUND } from '../focus/V2FocusActiveScreen';
import { deepFocusVisualAt, type DeepFocusDuration } from './deepFocusTimeline';
import { shouldPlayDeepFocusCompletionCue } from './completionCue';
import { useDeepFocusSession, type DeepFocusSessionData } from './useDeepFocusSession';

export function V2DeepFocusActiveScreen({ anchor, durationSeconds, voice, ambient, haptics = true, anchorHandoff = false, onExit, onComplete }: {
  anchor: Anchor;
  durationSeconds: DeepFocusDuration;
  voice: GuidanceVoice;
  ambient: boolean;
  haptics?: boolean;
  /** The Anchor arrives by hero flight, so the entry curtain is skipped and the Anchor is already in place. */
  anchorHandoff?: boolean;
  onExit?: () => void;
  onComplete: (data: DeepFocusSessionData) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const reduced = useReduceMotionEnabled();
  const geometry = resolveFocusSessionGeometry({ width, height, topInset: insets.top, bottomInset: insets.bottom });
  const place = useAnchorTransitionPlace('deepFocusSession', anchor.id, 'dark', { artSize: geometry.anchorSize, plainMark: true });
  useKeepAwake('deep-focus-session');
  // Practice normally permits the iOS edge swipe. An active Deep Focus session
  // uses its deliberate controls instead, then restores Practice navigation.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation]);
  const [controls, setControls] = useState(false);
  const [sound, setSound] = useState(ambient || voice !== 'none');
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seconds = useSharedValue(0);
  const manualStart = useSharedValue(-1);
  const orbitProgress = useSharedValue(1);
  const controlsOpacity = useSharedValue(0);
  const { createSessionAudioPlayer } = useSessionAudio();
  const ambientPlayer = useRef<ManagedSessionAudioPlayer | null>(null);
  const ambientAttempted = useRef(false);
  const voicePlayer = useRef<ManagedSessionAudioPlayer | null>(null);
  const fullMixFinished = useRef(false);
  const played = useRef(new Set<string>());
  const settled = useRef(false);
  const plan = useMemo(() => resolveSessionAudioPlan({
    sessionType: 'deep_prime', durationSeconds,
    configuration: { guidanceVoice: voice, backgroundAudio: ambient ? 'ambient' : 'off', source: 'default' },
  }), [ambient, durationSeconds, voice]);

  const sampleAudio = useCallback((time: number) => {
    if (!settled.current) {
      settled.current = true;
      if (haptics) void safeHaptics.selection();
    }
    // Create at most one ambient instance, including when sound is enabled late.
    if (soundRef.current && plan.ambientTrack && !ambientAttempted.current) {
      ambientAttempted.current = true;
      ambientPlayer.current = createSessionAudioPlayer(plan.ambientTrack.asset, { loop: true, volume: 0 });
      ambientPlayer.current?.play();
    }
    const endFade = manualStart.value >= 0 ? Math.max(0, 1 - (time - manualStart.value) / 0.45) : 1;
    let gain = deepFocusVisualAt(time, durationSeconds, true).ambientGain;
    gain *= endFade;
    ambientPlayer.current?.setVolume(gain);
    // The finished mix is one full-length recording (voice and bed together),
    // played once from the session start. Sound switched on late seeks to the clock.
    const cue = plan.voiceCues.find(item => item.phaseId === FULL_MIX_PHASE_ID);
    if (cue && voicePlayer.current) {
      if (endFade <= 0) {
        voicePlayer.current.stop();
        voicePlayer.current = null;
      } else {
        voicePlayer.current.setVolume(cue.track.playbackGain * endFade);
      }
      return;
    }
    if (!cue || !soundRef.current || played.current.has(cue.phaseId) || manualStart.value >= 0) return;
    played.current.add(cue.phaseId);
    const player = createSessionAudioPlayer(cue.track.asset, {
      volume: cue.track.playbackGain,
      onFinish: () => { fullMixFinished.current = true; },
    });
    if (time > 1) void player?.seekTo(time);
    voicePlayer.current = player;
    player?.play();
  }, [createSessionAudioPlayer, durationSeconds, haptics, manualStart, plan]);
  const complete = useCallback((data: DeepFocusSessionData) => {
    ambientPlayer.current?.stop();
    voicePlayer.current?.stop();
    const hasFullMix = plan.voiceCues.some((cue) => cue.phaseId === FULL_MIX_PHASE_ID);
    if (shouldPlayDeepFocusCompletionCue({
      soundEnabled: soundRef.current,
      hasFullMix,
      fullMixFinished: fullMixFinished.current,
    })) {
      void setAudioSessionMode('effects').then(() => playCreationSound('practiceComplete')).catch(() => undefined);
    }
    if (haptics) void safeHaptics.selection();
    onComplete(data);
  }, [haptics, onComplete, plan]);
  const session = useDeepFocusSession({ duration: durationSeconds, showTime: controls, onSample: sampleAudio, onComplete: complete });
  const { state, phase, ending, readElapsed, pause, resume, end } = session;

  const handleEndEarly = useCallback(() => {
    session.end();
    ambientPlayer.current?.stop();
    voicePlayer.current?.stop();
    onExit?.();
  }, [onExit, session]);

  useEffect(() => {
    cancelAnimation(seconds);
    seconds.value = readElapsed();
    if (ending && manualStart.value < 0) manualStart.value = session.manualEndAt.current ?? seconds.value;
    if (state === 'running') {
      seconds.value = withTiming(session.finishAt.current, {
        duration: Math.max(0, session.finishAt.current - seconds.value) * 1000,
        easing: Easing.linear,
        // Opacity timelines still run in reduced motion; spatial motion is removed.
        reduceMotion: ReduceMotion.Never,
      });
      if (soundRef.current) {
        ambientPlayer.current?.play();
        voicePlayer.current?.play();
      }
    } else {
      ambientPlayer.current?.pause();
      voicePlayer.current?.pause();
    }
    return () => cancelAnimation(seconds);
  }, [ending, manualStart, readElapsed, seconds, session.finishAt, session.manualEndAt, state]);

  const reveal = useCallback(() => {
    if (state !== 'running' || ending) return;
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setControls(true);
    controlsOpacity.value = withTiming(1, { duration: 180, easing: AnchorMotion.easing.enter });
    controlsTimer.current = setTimeout(() => {
      controlsOpacity.value = withTiming(0, { duration: 420 });
      controlsTimer.current = setTimeout(() => setControls(false), 420);
    }, 3200);
  }, [controlsOpacity, ending, state]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state !== 'complete') pause('hardware_back');
      return true;
    });
    return () => subscription.remove();
  }, [pause, state]);
  useEffect(() => () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    cancelAnimation(controlsOpacity);
    cancelAnimation(manualStart);
    ambientPlayer.current?.stop();
    voicePlayer.current?.stop();
  }, [controlsOpacity, manualStart]);

  const anchorStyle = useAnimatedStyle(() => {
    const visual = deepFocusVisualAt(seconds.value, durationSeconds, reduced);
    const fade = manualStart.value < 0 ? 1 : Math.max(0, 1 - (seconds.value - (manualStart.value + 0.35)) / 0.85);
    return { opacity: visual.anchorOpacity * fade, transform: [{ scale: visual.anchorScale }] };
  });
  const fieldStyle = useAnimatedStyle(() => {
    const visual = deepFocusVisualAt(seconds.value, durationSeconds, reduced);
    const fade = manualStart.value < 0 ? 1 : Math.max(0, 1 - (seconds.value - manualStart.value) / 0.45);
    return {
      opacity: visual.orbitOpacity * fade,
      transform: [
        { scale: visual.orbitScale },
        { rotate: `${visual.orbitRotation}deg` },
      ] as [{ scale: number }, { rotate: string }],
    };
  });
  // Inner counter-rotation and spacing breath sit inside the field so the lines read as layered depth.
  const weaveStyle = useAnimatedStyle(() => {
    const visual = deepFocusVisualAt(seconds.value, durationSeconds, reduced);
    return { transform: [{ scale: visual.weaveScale }, { rotate: `${visual.weaveRotation}deg` }] as [{ scale: number }, { rotate: string }] };
  });
  const guidanceStyle = useAnimatedStyle(() => ({ opacity: deepFocusVisualAt(seconds.value, durationSeconds, reduced).guidance }));
  const intentionStyle = useAnimatedStyle(() => ({ opacity: deepFocusVisualAt(seconds.value, durationSeconds, reduced).intention }));
  const darknessStyle = useAnimatedStyle(() => ({ opacity: deepFocusVisualAt(seconds.value, durationSeconds, reduced).darkness }));
  const curtainStyle = useAnimatedStyle(() => ({ opacity: anchorHandoff ? 0 : Math.max(0, 1 - seconds.value / 0.8) }));
  const controlStyle = useAnimatedStyle(() => ({ opacity: controlsOpacity.value }));
  const toggleSound = () => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSound(next);
    if (next && state === 'running') {
      ambientPlayer.current?.play(); voicePlayer.current?.play();
    } else {
      ambientPlayer.current?.pause(); voicePlayer.current?.pause();
    }
  };
  const remaining = Math.max(0, Math.ceil(durationSeconds - readElapsed()));

  return (
    <Pressable testID="v2-deep-focus-active-screen" style={styles.screen} onPress={reveal}
      accessible={state === 'running' && !controls && !ending}
      accessibilityRole="button" accessibilityLabel="Show Deep Focus controls"
      accessibilityHint="Reveal remaining time, sound, pause and end controls."
      accessibilityActions={[{ name: 'activate', label: 'Show Deep Focus controls' }]}
      onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') reveal(); }}>
      <StatusBar barStyle="light-content" backgroundColor={FOCUS_SCREEN_BACKGROUND} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.black, darknessStyle]} />
      {phase === 'arrive' && <Animated.View pointerEvents="none" style={[styles.copy, { top: insets.top + 54 }, guidanceStyle]}
        accessibilityElementsHidden={phase !== 'arrive'} importantForAccessibility={phase === 'arrive' ? 'auto' : 'no-hide-descendants'}>
        <Text style={styles.guidance}>Settle your attention.</Text>
      </Animated.View>}
      {(phase === 'hold' || phase === 'descend') && <Animated.View style={[styles.copy, { top: insets.top + 54, height: Math.max(52, geometry.centerY - geometry.fieldSize / 2 - insets.top - 68) }, intentionStyle]}
        pointerEvents={phase === 'hold' || phase === 'descend' ? 'auto' : 'none'}
        accessibilityElementsHidden={phase !== 'hold'} importantForAccessibility={phase === 'hold' ? 'auto' : 'no-hide-descendants'}>
        <ScrollView contentContainerStyle={styles.intentionScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intention}>{anchor.intentionText}</Text>
        </ScrollView>
      </Animated.View>}
      <View ref={place.ref} collapsable={false} onLayout={place.onLayout} pointerEvents="none"
        style={[styles.stage, { top: geometry.centerY - geometry.fieldSize / 2, left: (width - geometry.fieldSize) / 2, width: geometry.fieldSize, height: geometry.fieldSize }]}>
        <Animated.View style={[StyleSheet.absoluteFill, fieldStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, weaveStyle]}>
            <V2FocusField size={geometry.fieldSize} category={anchor.category} progress={orbitProgress} reduceMotion={reduced} motionActive={false} />
          </Animated.View>
        </Animated.View>
        {/* The flight hides on a wrapper with no animated opacity, so the animated Anchor cannot override it. */}
        <View style={[styles.artwork, place.hidden && styles.hidden]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.artwork, anchorStyle]}>
            <V2FocusAnchorArtwork svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl} category={anchor.category}
              size={geometry.anchorSize} surface={FOCUS_SCREEN_BACKGROUND} accessibilityLabel={`${anchor.category} Anchor artwork`} testID="deep-focus-anchor-artwork" threadStrength={anchor.threadStrength ?? null} anchorId={anchor.id} />
          </Animated.View>
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]} />
      {controls && state === 'running' && !ending && (
        <Animated.View style={[styles.controls, { bottom: insets.bottom + 12 }, controlStyle]}>
          <Text testID="deep-focus-remaining-time" style={styles.timer}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="switch" accessibilityLabel={`Sound: ${sound ? 'On' : 'Off'}`} accessibilityState={{ checked: sound }}
              disabled={!ambient && voice === 'none'} onPress={event => { event?.stopPropagation?.(); toggleSound(); reveal(); }} style={styles.button}><Text style={styles.controlText}>Sound {sound ? 'on' : 'off'}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pause Deep Focus" onPress={event => { event?.stopPropagation?.(); pause(); }} style={styles.button}><Text style={styles.controlText}>Pause</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="End session" onPress={event => { event?.stopPropagation?.(); handleEndEarly(); }} style={styles.button}><Text style={styles.controlText}>End Session</Text></Pressable>
          </View>
        </Animated.View>
      )}
      {state === 'paused' && (
        <View style={styles.paused} testID="deep-focus-paused-overlay">
          <Text style={styles.pausedTitle}>Paused</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Resume Deep Focus" onPress={resume} style={styles.button}><Text style={styles.controlText}>Resume</Text></Pressable>
          {!ending && <Pressable accessibilityRole="button" accessibilityLabel="End session" onPress={handleEndEarly} style={styles.button}><Text style={styles.controlText}>End Session</Text></Pressable>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: FOCUS_SCREEN_BACKGROUND, overflow: 'hidden' },
  black: { backgroundColor: '#000000' },
  curtain: { backgroundColor: colors.canvas },
  stage: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  artwork: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  copy: { position: 'absolute', left: 24, right: 24, alignItems: 'center', justifyContent: 'center' },
  guidance: { ...typography.bodyMD, fontSize: 14, lineHeight: 20, textAlign: 'center', color: 'rgba(255,255,255,0.6)' },
  intentionScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  intention: { ...typography.headingMD, fontFamily: typography.display, fontSize: 18, lineHeight: 25, letterSpacing: -0.1, maxWidth: 320, textAlign: 'center', color: 'rgba(255,255,255,0.82)' },
  controls: { position: 'absolute', left: 12, right: 12, alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  button: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  controlText: { ...typography.labelSM, color: '#FFFFFF' },
  timer: { ...typography.labelSM, color: 'rgba(255,255,255,0.55)' },
  paused: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,24,0.94)', justifyContent: 'center', alignItems: 'center', gap: 12 },
  pausedTitle: { ...typography.headingMD, color: '#FFFFFF' },
});
