import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, withTiming, type SharedValue } from 'react-native-reanimated';
import type { AudioSource, AudioStatus } from 'expo-audio';
import { useSessionAudio, type ManagedSessionAudioPlayer } from '@/hooks/useSessionAudio';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';

export type GuidedPlaybackState = 'preparing' | 'running' | 'paused' | 'completing' | 'completed' | 'ended_early' | 'failed';
export type GuidedSessionTiming = { startedAt: string; completedAt: string };

/** Audio position is sampled this often; the stage interpolates between samples on the UI thread. */
const SAMPLE_MS = 50;
/** The position state that drives captions and haptics refreshes at this cadence. */
const STATE_PUBLISH_MS = 100;
/** A position this far from the previous sample is a seek or a resync, not playback: the stage snaps to it. */
const SNAP_FORWARD_MS = 400;
const END_TOLERANCE_MS = 120;
const EARLY_EXIT_FADE_MS = 300;
/** Status events this soon after a start or resume may still describe the previous state. */
const STATUS_SETTLE_MS = 600;

/**
 * The narration track is the master clock. Everything on screen is derived from `player.currentTime`;
 * there is no second timer that can drift. Pausing, buffering, a backgrounded app, a Bluetooth change or
 * a system interruption all show up as the audio position not advancing, and the visuals follow it.
 */
export function useGuidedPlayback(params: {
  asset: AudioSource;
  /** False for the hidden preparation pass, which must not load a track it will never play. */
  enabled?: boolean;
  /** Sound off: the track still plays, at zero volume, because it is the clock. */
  muted: boolean;
  durationMs: number;
  /** Written by the sampler on the JS thread; the stage reads it on the UI thread. */
  positionSV: SharedValue<number>;
  onComplete: (timing: GuidedSessionTiming) => Promise<void> | void;
  /** Injected only by deterministic tests. */
  wallClock?: () => number;
}) {
  const { createSessionAudioPlayer } = useSessionAudio();
  const readWallClock = params.wallClock ?? Date.now;
  const [state, setStateValue] = useState<GuidedPlaybackState>('preparing');
  const [positionMs, setPositionMs] = useState(0);
  const stateRef = useRef<GuidedPlaybackState>('preparing');
  const playerRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const lastSampleRef = useRef(0);
  const lastPublishRef = useRef(0);
  const sawPlayingRef = useRef(false);
  const intentionalPauseRef = useRef(false);
  const ignoreStatusUntilRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const completionStartedRef = useRef(false);
  const completionPromiseRef = useRef<Promise<void> | null>(null);
  const mutedRef = useRef(params.muted);
  const onCompleteRef = useRef(params.onComplete);
  onCompleteRef.current = params.onComplete;
  mutedRef.current = params.muted;

  const setState = useCallback((next: GuidedPlaybackState) => { stateRef.current = next; setStateValue(next); }, []);

  const readPositionMs = useCallback(() => {
    const player = playerRef.current;
    if (!player) return lastSampleRef.current;
    let seconds = 0;
    try { seconds = player.getCurrentTime(); } catch { /* a removed player keeps its last position */ }
    return Number.isFinite(seconds) ? Math.max(0, Math.min(params.durationMs, seconds * 1000)) : lastSampleRef.current;
  }, [params.durationMs]);

  /** Publishes one audio position. `snap` assigns directly; otherwise the stage glides to the next expected sample. */
  const publish = useCallback((ms: number, mode: 'snap' | 'play') => {
    const jumped = ms < lastSampleRef.current - SAMPLE_MS || ms - lastSampleRef.current > SNAP_FORWARD_MS;
    lastSampleRef.current = ms;
    if (mode === 'snap' || jumped) {
      cancelAnimation(params.positionSV);
      params.positionSV.value = ms;
    } else {
      params.positionSV.value = withTiming(ms + SAMPLE_MS, { duration: SAMPLE_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    }
    if (mode === 'snap' || Math.abs(ms - lastPublishRef.current) >= STATE_PUBLISH_MS) {
      lastPublishRef.current = ms;
      setPositionMs(ms);
    }
  }, [params.positionSV]);

  const beginCompletion = useCallback(() => {
    if (completionStartedRef.current || stateRef.current === 'ended_early') return;
    completionStartedRef.current = true;
    publish(params.durationMs, 'snap');
    const startedAt = new Date(startedAtRef.current ?? readWallClock()).toISOString();
    const completedAt = new Date(readWallClock()).toISOString();
    completionPromiseRef.current = Promise.resolve().then(() => onCompleteRef.current({ startedAt, completedAt })).catch(() => undefined);
    setState('completing');
  }, [params.durationMs, publish, readWallClock, setState]);
  const beginCompletionRef = useRef(beginCompletion); beginCompletionRef.current = beginCompletion;

  const handleStatus = useCallback((status: AudioStatus) => {
    // The managed player's failure callback owns source errors. A failed stream
    // must not first become a resumable interruption of a player being removed.
    if (status.error) return;
    if (status.playing) sawPlayingRef.current = true;
    // A status queued before a start or resume describes the old state; it must not read as an interruption.
    if (readWallClock() < ignoreStatusUntilRef.current) return;
    if (status.didJustFinish) { if (stateRef.current === 'running') beginCompletionRef.current(); return; }
    // The platform can restart audio on its own (it resumes players when the app returns to the foreground).
    // A paused session owns the audio: the narration must never play on under the Paused state.
    if (status.playing && stateRef.current === 'paused') { playerRef.current?.pause(); return; }
    // Playback stopped without being asked to: a call, Siri, a route change. Hold the frame where the audio is.
    if (!status.playing && !status.isBuffering && sawPlayingRef.current && !intentionalPauseRef.current && stateRef.current === 'running') {
      const ms = readPositionMs();
      if (ms >= params.durationMs - END_TOLERANCE_MS) { beginCompletionRef.current(); return; }
      publish(ms, 'snap');
      setState('paused');
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, { practice_mode: 'visualize', source: 'audio_interruption' });
    }
  }, [params.durationMs, publish, readPositionMs, readWallClock, setState]);
  const handleStatusRef = useRef(handleStatus); handleStatusRef.current = handleStatus;

  useEffect(() => {
    if (params.enabled === false) return;
    const player = createSessionAudioPlayer(params.asset, {
      volume: mutedRef.current ? 0 : 1,
      onStatus: status => handleStatusRef.current(status),
      onFinish: () => { if (stateRef.current === 'running') beginCompletionRef.current(); },
      onFailure: () => { if (stateRef.current === 'preparing' || stateRef.current === 'running' || stateRef.current === 'paused') setState('failed'); },
    });
    playerRef.current = player;
    if (!player) setState('failed');
    return () => { playerRef.current = null; };
    // The player belongs to this route instance; the asset never changes under a running session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { playerRef.current?.setVolume(params.muted ? 0 : 1); }, [params.muted]);

  const start = useCallback(() => {
    if (startedAtRef.current != null || !playerRef.current) return;
    startedAtRef.current = readWallClock();
    intentionalPauseRef.current = false;
    ignoreStatusUntilRef.current = readWallClock() + STATUS_SETTLE_MS;
    publish(0, 'snap');
    setState('running');
    playerRef.current.play();
  }, [publish, readWallClock, setState]);

  const pause = useCallback((source: string = 'user') => {
    if (stateRef.current !== 'running') return;
    intentionalPauseRef.current = true;
    playerRef.current?.pause();
    publish(readPositionMs(), 'snap');
    setState('paused');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, { practice_mode: 'visualize', source });
  }, [publish, readPositionMs, setState]);

  const resume = useCallback(() => {
    if (stateRef.current !== 'paused') return;
    intentionalPauseRef.current = false;
    ignoreStatusUntilRef.current = readWallClock() + STATUS_SETTLE_MS;
    // Whatever happened while paused, the first frame back is the one the audio position calls for.
    publish(readPositionMs(), 'snap');
    setState('running');
    playerRef.current?.play();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_RESUMED, { practice_mode: 'visualize' });
  }, [publish, readPositionMs, readWallClock, setState]);

  const stopAudio = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    intentionalPauseRef.current = true;
    const steps = 5;
    for (let step = 1; step <= steps; step += 1) {
      player.setVolume(mutedRef.current ? 0 : 1 - step / steps);
      await new Promise<void>(resolve => setTimeout(resolve, EARLY_EXIT_FADE_MS / steps));
    }
    player.pause();
    player.stop();
    playerRef.current = null;
  }, []);

  const endEarly = useCallback(() => {
    if (stateRef.current === 'completed' || stateRef.current === 'completing' || stateRef.current === 'ended_early') return Promise.resolve();
    const elapsed = readPositionMs();
    setState('ended_early');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
      practice_mode: 'visualize', duration_seconds: Math.round(params.durationMs / 1000), elapsed_seconds: Math.floor(elapsed / 1000),
    });
    return stopAudio();
  }, [params.durationMs, readPositionMs, setState, stopAudio]);

  const markCompleted = useCallback(() => { if (stateRef.current === 'completing') setState('completed'); }, [setState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') { pause(`app_${next}`); return; }
      // Back in the foreground: show the state the audio is at now, never a replay of what was missed.
      if (stateRef.current === 'running' || stateRef.current === 'paused') publish(readPositionMs(), 'snap');
      if (stateRef.current === 'paused') playerRef.current?.pause();
    });
    return () => subscription.remove();
  }, [pause, publish, readPositionMs]);

  useEffect(() => {
    if (state !== 'running') return;
    const sample = () => {
      const ms = readPositionMs();
      publish(ms, 'play');
      if (ms >= params.durationMs - END_TOLERANCE_MS && stateRef.current === 'running') beginCompletionRef.current();
    };
    const timer = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [params.durationMs, publish, readPositionMs, state]);

  return {
    state, start, pause, resume, endEarly, stopAudio, markCompleted,
    completionPromise: completionPromiseRef.current,
    positionMs,
    remainingSeconds: Math.max(0, Math.ceil((params.durationMs - positionMs) / 1000)),
  };
}
