import { useCallback, useEffect, useRef, useState } from 'react';
import { askChartApi, type AskMemoryKey, type AskProfile, type CoachStyle } from '@/services/v2/askChartApi';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';

type Api = Pick<typeof askChartApi, 'getProfile' | 'setStyle' | 'setMemory' | 'deleteMemory' | 'deleteAllMemories' | 'clearConversation'>;

export const MEMORY_LABELS: Record<AskMemoryKey, string> = {
  availability: 'When you can work',
  hoursPerWeek: 'Hours per week',
  constraints: 'Constraints',
  approach: 'How you like to work',
  resources: 'Resources you have',
};

export const COACH_STYLE_COPY: Record<CoachStyle, { label: string; blurb: string }> = {
  SUPPORTIVE: { label: 'Supportive', blurb: 'Gentle and patient' },
  DRIVEN: { label: 'Driven', blurb: 'Focused, with a push' },
  DIRECT: { label: 'Direct', blurb: 'Short and to the point' },
};

/**
 * The person's coaching style and what Ask Chart remembers for this Anchor, with the controls to change, correct and
 * delete it. Loaded when the sheet opens; every change is saved by the server before the screen shows it as saved,
 * and a failed change puts the old value back.
 */
export function useAskProfile({ anchorId, open, api = askChartApi }: { anchorId: string; open: boolean; api?: Api }) {
  const [profile, setProfile] = useState<AskProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.getProfile(anchorId);
      if (mounted.current) setProfile(next);
    } catch {
      if (mounted.current) setError('Couldn’t load your settings. Check your connection and try again.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [anchorId, api]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const setStyle = useCallback(
    async (style: CoachStyle) => {
      const previous = profile;
      if (!previous || previous.style === style) return;
      setProfile({ ...previous, style });
      setError(null);
      try {
        await api.setStyle(style);
        trackChart('ask_chart_style_set', { style });
      } catch {
        if (mounted.current) {
          setProfile(previous);
          setError('That didn’t save. Your style is unchanged.');
        }
      }
    },
    [api, profile]
  );

  const editMemory = useCallback(
    async (key: AskMemoryKey, value: string) => {
      const clean = value.replace(/\s+/g, ' ').trim();
      if (!profile || !clean) return false;
      try {
        await api.setMemory(anchorId, key, clean);
        if (mounted.current) setProfile(current => current && { ...current, memories: current.memories.map(memory => (memory.key === key ? { ...memory, value: clean, source: 'USER_EDITED' } : memory)) });
        return true;
      } catch {
        if (mounted.current) setError('That didn’t save. Nothing was changed.');
        return false;
      }
    },
    [anchorId, api, profile]
  );

  const forgetMemory = useCallback(
    async (key: AskMemoryKey) => {
      try {
        await api.deleteMemory(anchorId, key);
        if (mounted.current) setProfile(current => current && { ...current, memories: current.memories.filter(memory => memory.key !== key) });
        trackChart('ask_chart_memory_deleted', { scope: 'one' });
      } catch {
        if (mounted.current) setError('That didn’t delete. Try again.');
      }
    },
    [anchorId, api]
  );

  const forgetAll = useCallback(async () => {
    try {
      await api.deleteAllMemories(anchorId);
      if (mounted.current) setProfile(current => current && { ...current, memories: [] });
      trackChart('ask_chart_memory_deleted', { scope: 'all' });
    } catch {
      if (mounted.current) setError('That didn’t delete. Try again.');
    }
  }, [anchorId, api]);

  const clearConversation = useCallback(async () => {
    try {
      await api.clearConversation(anchorId);
      trackChart('ask_chart_conversation_cleared', {});
      return true;
    } catch {
      if (mounted.current) setError('That didn’t clear. Try again.');
      return false;
    }
  }, [anchorId, api]);

  return { profile, loading, error, reload: load, setStyle, editMemory, forgetMemory, forgetAll, clearConversation };
}
