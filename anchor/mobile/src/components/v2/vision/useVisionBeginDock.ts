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
/** True when the board's visible area reaches into the strip the floating button occupies at the viewport's foot. */
export function boardUnderDock(
  boardTop: number,
  boardHeight: number,
  scrollY: number,
  viewportHeight: number,
  dockHeight: number,
) {
  if (boardHeight <= 0 || viewportHeight <= 0) return false;
  const dockTop = scrollY + viewportHeight - dockHeight;
  return boardTop + boardHeight > dockTop && boardTop < scrollY + viewportHeight;
}
export function useVisionBeginDock({
  blocked,
  newBoard,
  landed,
  dockHeight = 76,
}: {
  blocked: boolean;
  newBoard: boolean;
  landed: boolean;
  /** Height of the strip at the viewport's foot the floating button covers, bottom inset included. */
  dockHeight?: number;
}) {
  const buttonRef = useRef<ViewInstance>(null),
    viewportRef = useRef<ViewInstance>(null),
    boardRef = useRef<ViewInstance>(null);
  const metrics = useRef({ top: 0, height: 0, viewport: 0, y: 0, boardTop: 0, boardHeight: 0 });
  const [overBoard, setOverBoard] = useState(false);
  const [offscreen, setOffscreen] = useState(false),
    [quiet, setQuiet] = useState(true),
    [armed, setArmed] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evaluate = useCallback(() => {
    const m = metrics.current,
      f = visibleButtonFraction(m.top, m.height, m.y, m.viewport);
    setOffscreen((previous) => f < (previous ? 0.65 : 0.6));
    setOverBoard(boardUnderDock(m.boardTop, m.boardHeight, m.y, m.viewport, dockHeight));
  }, [dockHeight]);
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
          boardRef.current?.measureInWindow?.(
            (_x, boardTop, _w, boardHeight) => {
              if (boardHeight <= 0 || viewportHeight <= 0) return;
              metrics.current = {
                ...metrics.current,
                boardTop: boardTop - viewportTop + metrics.current.y,
                boardHeight,
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
    boardRef,
    /** The floating button is currently over the photo board. */
    overBoard,
    measure,
    onScroll,
    visible: armed && quiet && offscreen && !blocked,
  };
}
