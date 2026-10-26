import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextLayoutEvent, type StyleProp, type TextStyle } from 'react-native';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import { ASK_REVEAL, askReveal, charDelay } from './askReveal';

type Props = {
  revealKey: string;
  text: string;
  style: StyleProp<TextStyle>;
  /** Reveal code points; false restores the whole reply without motion. */
  animate: boolean;
  final: boolean;
  registerSkip?: (skip: (() => void) | null) => void;
  /** Bottom of the current line relative to Text, only on a line change. */
  onLine?: (lineBottomY: number) => void;
};

export const CHARS_PER_TICK = 1;
const HIDDEN: TextStyle = { opacity: 0 };

/** Full text reserves its native layout invisibly; visible prefixes use those exact line breaks. */
export const AskRevealText = memo(function AskRevealText({ revealKey, text, style, animate, final, registerSkip, onLine }: Props) {
  const chars = useMemo(() => Array.from(text), [text]);
  const instant = !animate || askReveal.isDone(revealKey);
  const [shown, setShown] = useState(() => instant ? chars.length : Math.min(askReveal.count(revealKey), chars.length));
  const [skipped, setSkipped] = useState(false);
  const [lines, setLines] = useState<TextLayoutEvent['nativeEvent']['lines']>([]);
  const lastLine = useRef(-1);

  const skip = useCallback(() => {
    if (askReveal.isDone(revealKey)) return;
    trackChart('ask_chart_reveal_skipped', { chars: askReveal.count(revealKey), total: chars.length });
    askReveal.setCount(revealKey, chars.length);
    askReveal.finish(revealKey);
    setSkipped(true);
  }, [chars.length, revealKey]);

  useEffect(() => {
    if (!animate) return undefined;
    registerSkip?.(skip);
    return () => registerSkip?.(null);
  }, [animate, registerSkip, skip]);

  useEffect(() => {
    if (instant || skipped) return undefined;
    askReveal.begin(revealKey);
    if (shown >= chars.length) {
      if (final) askReveal.finish(revealKey);
      return undefined;
    }
    const base = final ? Math.max(ASK_REVEAL.minMsPerChar, Math.min(ASK_REVEAL.msPerChar, ASK_REVEAL.capMs / chars.length)) : ASK_REVEAL.msPerChar;
    const backlog = chars.length - shown;
    const speed = !final ? backlog > 320 ? 4 : backlog > 140 ? 2 : 1 : 1;
    const previous = chars[shown - 1];
    // Re-read the next character on each delta: a period at the stream frontier may become 3.5 or e.g.
    let last = shown - 1;
    while (last >= 0 && /\s/.test(chars[last])) last -= 1;
    let delay = last < 0 ? ASK_REVEAL.msPerChar : charDelay(chars[last], chars[last + 1]);
    if (chars[last] === '.' && /\b(?:[a-z]\.){2,}$/i.test(chars.slice(Math.max(0, last - 7), last + 1).join(''))) delay = ASK_REVEAL.msPerChar;
    if (/\n\s*\n/.test(chars.slice(last + 1, shown).join(''))) delay += 300;
    const timer = setTimeout(() => {
      let next = Math.min(chars.length, shown + CHARS_PER_TICK);
      let boundary = shown > 0 && /\S/.test(previous) && /\s/.test(chars[shown]);
      while (next < chars.length && /\s/.test(chars[next])) {
        if (/\S/.test(chars[next - 1])) boundary = true;
        next += 1;
      }
      if (boundary) askReveal.bump();
      askReveal.setCount(revealKey, next);
      setShown(next);
    }, (Math.max(0, delay - ASK_REVEAL.msPerChar) + base) / speed);
    return () => clearTimeout(timer);
  }, [instant, skipped, shown, chars, final, revealKey]);

  useEffect(() => () => askReveal.pause(revealKey), [revealKey]);
  const visibleCount = instant || skipped ? chars.length : shown;
  const lineRanges = useMemo(() => {
    let offset = 0;
    return lines.map(line => {
      const lineChars = Array.from(line.text);
      while (offset < chars.length && /\s/.test(chars[offset]) && chars[offset] !== lineChars[0]) offset += 1;
      const start = offset;
      offset += lineChars.length;
      return { line, start, end: offset };
    });
  }, [chars, lines]);
  useEffect(() => {
    if (!onLine || !visibleCount || !lines.length || !animate) return;
    const found = lineRanges.findIndex(range => visibleCount <= range.end);
    const lineIndex = found < 0 ? lines.length - 1 : found;
    if (lastLine.current !== lineIndex) {
      lastLine.current = lineIndex;
      onLine(lines[lineIndex].y + lines[lineIndex].height);
    }
  }, [animate, lineRanges, lines, onLine, visibleCount]);
  const onTextLayout = useCallback((event: TextLayoutEvent) => {
    const next = event.nativeEvent.lines;
    setLines(current => current.length === next.length && current.every((line, index) => line.text === next[index].text && line.y === next[index].y && line.height === next[index].height) ? current : next);
  }, []);

  // DEFERRED: word counting and wordDelay were replaced by code-point ticks (Oct 2026).
  if (visibleCount >= chars.length) return <Text style={style} selectable={final} onTextLayout={onTextLayout}>{text}</Text>;
  // DEFERRED: transparent text spans exposed the whole reply on Android (Oct 2026).
  // Native opacity hides the layout copy; per-line prefixes cannot rewrap a partial word.
  return <View>
    <Text style={[style, HIDDEN]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onTextLayout={onTextLayout}>{text}</Text>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lineRanges.map(({ line, start, end }, index) => visibleCount > start ? (
        <Text key={index} testID={`ask-reveal-line-${index}`} numberOfLines={1} style={[style, { position: 'absolute', top: line.y, left: line.x }]}>{chars.slice(start, Math.min(visibleCount, end)).join('').replace(/[\r\n]+$/, '')}</Text>
      ) : null)}
    </View>
  </View>;
});
