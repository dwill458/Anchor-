import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';
import type { Anchor } from '@/types';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { V2FocusActiveScreen } from '@/screens/v2/practice/focus/V2FocusActiveScreen';
import { V2DeepFocusActiveScreen } from '@/screens/v2/practice/deepFocus/V2DeepFocusActiveScreen';
import { isDeepFocusDuration } from '@/screens/v2/practice/deepFocus/deepFocusTimeline';
import { V2CinematicSessionScreen } from '@/screens/v2/practice/visualize/V2CinematicSessionScreen';
import { isV2VisualizeDuration } from '@/screens/v2/practice/visualize/visualizeVisionPlan';

const fixture: Anchor = {
  id: 'qa-session-audio', localId: 'qa-session-audio', intentionText: 'Audio timing verification.',
  userId: 'qa-session-audio', distilledLetters: [], structureVariant: 'balanced', isCharged: false,
  activationCount: 0, createdAt: new Date('2026-10-25T00:00:00Z'), updatedAt: new Date('2026-10-25T00:00:00Z'),
  category: 'desire', baseSigilSvg: V2_SAMPLE_ANCHOR_SVGS.medium,
};

/** Dev-only, real session components with local callbacks and no account writes. */
export function SessionAudioPlaybackLab({ runId, tiles }: { runId: string; tiles: V2VisionTile[] }) {
  const [, mode, rawDuration, rawVoice, background] = runId.split('-');
  const duration = Number(rawDuration);
  const voice: GuidanceVoice = rawVoice === 'male' || rawVoice === 'female' || rawVoice === 'warm' || rawVoice === 'soothing' ? rawVoice : 'none';
  const ambient = background !== 'off';
  const [finished, setFinished] = useState(false);
  const completed = useRef(false);
  const mountedAt = useRef(Date.now());
  const report = useCallback((event: string, detail: Record<string, unknown> = {}) => {
    console.info('[SESSION_AUDIO_QA]', JSON.stringify({ runId, event, wallTime: new Date().toISOString(), elapsedMs: Date.now() - mountedAt.current, ...detail }));
  }, [runId]);
  useEffect(() => { report('mounted', { mode, duration, voice, ambient, fixture: true, persistence: false }); }, [ambient, duration, mode, report, voice]);
  const complete = useCallback((data?: unknown) => {
    if (completed.current) return;
    completed.current = true;
    report('completed', { data });
    setFinished(true);
  }, [report]);
  const exit = () => { report('exited'); setFinished(true); };
  if (finished) return <View style={styles.done}><Text style={styles.text}>Audio QA complete</Text><Text style={styles.text}>{runId}</Text></View>;
  let session: React.ReactNode;
  if (mode === 'focus' && [10, 30, 60].includes(duration)) {
    session = <V2FocusActiveScreen anchor={fixture} durationSeconds={duration} voice={voice} ambient={ambient}
      haptics={false} initialStage="entry" onExit={exit} onComplete={complete} />;
  } else if (mode === 'deep_prime' && isDeepFocusDuration(duration)) {
    session = <V2DeepFocusActiveScreen anchor={fixture} durationSeconds={duration} voice={voice} ambient={ambient}
      haptics={false} onExit={exit} onComplete={complete} />;
  } else if (mode === 'visualize' && isV2VisualizeDuration(duration)) {
    session = <V2CinematicSessionScreen anchor={fixture} accountId={null} tiles={tiles} statement="Audio timing verification."
      durationSeconds={duration} voice={voice} ambient={ambient} haptics={false} source="practice_hub"
      onExit={exit} onContinue={complete} onPreparationIssue={message => report('preparation_failed', { message })} />;
  } else return <View style={styles.done}><Text style={styles.text}>Invalid audio QA case: {runId}</Text></View>;
  return <View style={styles.root}>{session}<View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}>{runId}</Text></View></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, done: { flex: 1, backgroundColor: '#0B0F18', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontSize: 17, margin: 8 },
  badge: { position: 'absolute', top: 34, left: 8, right: 8, alignItems: 'center' },
  badgeText: { fontSize: 10, color: '#FFFFFF', backgroundColor: '#333333' },
});
