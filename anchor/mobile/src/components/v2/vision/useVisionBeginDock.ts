import { useCallback, useEffect, useRef, useState } from 'react';
import { type ViewInstance } from 'react-native';

/** Visibility is derived from the actual button's measured bounds, never a photo count or scroll distance. */
export function visibleButtonFraction(
  top: number,
  height: number,
  scrollY: number,
  viewportHeight: number,
) {
  return height > 0
    ? Math.max(
        0,
        Math.min(top + height, scrollY + viewportHeight) -
          Math.max(top, scrollY),
      ) / height
    : 1;
}
export function useVisionBeginDock({
  blocked,
  newBoard,
  landed,
}: {
  blocked: boolean;
  newBoard: boolean;
  landed: boolean;
}) {
  const buttonRef = useRef<ViewInstance>(null),
    viewportRef = useRef<ViewInstance>(null);
  const metrics = useRef({ top: 0, height: 0, viewport: 0, y: 0 });
  const [offscreen, setOffscreen] = useState(false),
    [quiet, setQuiet] = useState(true),
    [armed, setArmed] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evaluate = useCallback(() => {
    const m = metrics.current,
      f = visibleButtonFraction(m.top, m.height, m.y, m.viewport);
    setOffscreen((previous) => f < (previous ? 0.65 : 0.6));
  }, []);
  const measure = useCallback(
    () =>
      viewportRef.current?.measureInWindow?.(
        (_x, viewportTop, _w, viewportHeight) => {
          buttonRef.current?.measureInWindow?.(
            (_bx, buttonTop, _bw, buttonHeight) => {
              if (buttonHeight <= 0 || viewportHeight <= 0) return;
              metrics.current = {
                ...metrics.current,
                top: buttonTop - viewportTop + metrics.current.y,
                height: buttonHeight,
                viewport: viewportHeight,
              };
              evaluate();
            },
          );
        },
      ),
    [evaluate],
  );
  const onScroll = useCallback(
    (y: number) => {
      metrics.current.y = y;
      evaluate();
      setQuiet(false);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setQuiet(true), 650);
    },
    [evaluate],
  );
  useEffect(() => {
    setArmed(false);
    if (newBoard && !landed) return;
    const t = setTimeout(() => setArmed(true), newBoard ? 1400 : 1200);
    return () => clearTimeout(t);
  }, [newBoard, landed]);
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    [],
  );
  return {
    buttonRef,
    viewportRef,
    measure,
    onScroll,
    visible: armed && quiet && offscreen && !blocked,
  };
}
