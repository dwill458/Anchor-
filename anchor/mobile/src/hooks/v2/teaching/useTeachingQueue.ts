import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { scheduleAfterInteractions } from '@/utils/scheduleAfterInteractions';
import type { BeatId } from '@/constants/v2/teachingCopy';
import { getTeachingSeen, setTeachingSeen } from './teachingSeen';
import { canStartCoachSequence, recordCoachSequence, resetTeachingSession } from './teachingSession';

type Options = { screenId: string; accountId: string | null; eligible: BeatId[]; cap: number; blocked: boolean; isFocused: boolean };

/** Freeze one batch after data and interactions settle; interruption spends the visit, not the flags. */
export function useTeachingQueue({ screenId, accountId, eligible, cap, blocked, isFocused }: Options) {
  const [batch, setBatch] = useState<BeatId[]>([]);
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('replayAppTeaching', () => {
      resetTeachingSession();
      setReplay(value => value + 1);
    });
    return () => sub.remove();
  }, []);
  const decided = useRef(false);
  const batchRef = useRef<BeatId[]>([]);
  const session = `${screenId}:${accountId ?? 'guest'}`;
  const owner = useRef(session);
  const live = useRef({ blocked, isFocused, session, accountId });
  live.current = { blocked, isFocused, session, accountId };
  const eligibleKey = eligible.join('|');

  useEffect(() => {
    decided.current = false;
    owner.current = session;
    batchRef.current = [];
    setBatch([]);
    setReady(false);
  }, [session, isFocused, replay]);

  useEffect(() => {
    if (!isFocused || owner.current !== session) return;
    if (blocked) {
      if (decided.current) { batchRef.current = []; setBatch([]); setReady(false); }
      return;
    }
    if (decided.current) return;
    let cancelled = false;
    let interaction: ReturnType<typeof scheduleAfterInteractions> | undefined;
    const candidates = eligibleKey ? eligibleKey.split('|') as BeatId[] : [];
    void Promise.all(candidates.map(beat => getTeachingSeen(accountId, beat))).then(seen => {
      if (cancelled) return;
      interaction = scheduleAfterInteractions(() => {
        if (cancelled || live.current.blocked || !live.current.isFocused || live.current.session !== session || decided.current) return;
        const next = candidates.filter((_, index) => !seen[index]).slice(0, cap);
        if (next.length > 0 && next[0] !== 'vision.first' && !canStartCoachSequence(screenId)) {
          return;
        }
        decided.current = true;
        batchRef.current = next;
        setBatch(next);
        setReady(true);
      });
    });
    return () => { cancelled = true; interaction?.cancel(); };
  }, [accountId, blocked, cap, eligibleKey, isFocused, session, replay, screenId]);

  const markShown = useCallback((beat?: BeatId) => {
    if (owner.current === session && live.current.session === session && live.current.isFocused && !live.current.blocked) {
      decided.current = true;
      batchRef.current = batch;
      if (beat) {
        setTeachingSeen(live.current.accountId, beat);
        if (beat !== 'vision.first') {
          recordCoachSequence(screenId);
        }
      }
    }
  }, [session, batch, screenId]);
  const dismiss = useCallback((beatsToCommit?: BeatId[]) => {
    if (owner.current !== session || live.current.session !== session || !live.current.isFocused || live.current.blocked) return;
    // Presented beats are already marked by markShown; this commits the unpresented remainder.
    const committed = Array.isArray(beatsToCommit) ? beatsToCommit : batchRef.current;
    committed.forEach(beat => setTeachingSeen(live.current.accountId, beat));
    batchRef.current = [];
    setBatch([]);
  }, [session]);
  return { steps: owner.current === session && isFocused && !blocked ? batch : [], ready: ready && isFocused && !blocked, markShown, dismiss };
}
