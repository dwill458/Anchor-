import { useEffect, useRef, useState } from 'react';

/** Holds only the visual. Stream dispatch and API completion are never delayed. */
export function useMinimumThinking(key: string, hasText: boolean, minimumMs = 600) {
  const visit = useRef({ key, started: hasText ? null : Date.now() });
  const [, refresh] = useState(0);
  if (visit.current.key !== key) visit.current = { key, started: hasText ? null : Date.now() };
  const started = visit.current.started;
  const remaining = started === null ? 0 : Math.max(0, started + minimumMs - Date.now());
  useEffect(() => {
    if (!hasText || remaining === 0) return;
    const timer = setTimeout(() => refresh(value => value + 1), remaining);
    return () => clearTimeout(timer);
  }, [hasText, key, remaining]);
  return !hasText || remaining > 0;
}
