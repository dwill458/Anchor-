import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { askReveal, isWordToken, tokenize, wordDelay } from './askReveal';

type Props = {
  revealKey: string;
  text: string;
  style: StyleProp<TextStyle>;
  /** Reveal word by word. False renders the whole text at once (restored history, reduced motion). */
  animate: boolean;
  /** The text is complete. While false (a streaming draft) the reveal waits at the end of what has arrived. */
  final: boolean;
  /** Called with a function that reveals the rest immediately; the bubble's tap uses it. */
  registerSkip?: (skip: (() => void) | null) => void;
};

/**
 * Shows a reply one word at a time. The whole text is always laid out (the unrevealed tail is transparent), so the
 * bubble never grows or re-wraps while it fills in and the list does not have to chase it.
 */
export const AskRevealText = memo(function AskRevealText({ revealKey, text, style, animate, final, registerSkip }: Props) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const wordTotal = useMemo(() => tokens.filter(isWordToken).length, [tokens]);
  const instant = !animate || askReveal.isDone(revealKey);
  const [shown, setShown] = useState(() => (instant ? wordTotal : Math.min(askReveal.count(revealKey), wordTotal)));
  const [skipped, setSkipped] = useState(false);

  const skip = useCallback(() => {
    askReveal.finish(revealKey);
    setSkipped(true);
  }, [revealKey]);

  useEffect(() => {
    if (!animate) return undefined;
    registerSkip?.(skip);
    return () => registerSkip?.(null);
  }, [animate, registerSkip, skip]);

  useEffect(() => {
    if (instant || skipped) return undefined;
    askReveal.begin(revealKey);
    if (shown >= wordTotal) {
      if (final) askReveal.finish(revealKey);
      return undefined;
    }
    // The delay follows the word just shown, so a full stop lingers before the next sentence starts.
    let seen = 0;
    let last = '';
    let following: string | undefined;
    for (let index = 0; index < tokens.length; index += 1) {
      if (!isWordToken(tokens[index])) continue;
      seen += 1;
      if (seen === shown) {
        last = tokens[index];
        following = tokens[index + 1];
        break;
      }
    }
    const timer = setTimeout(() => {
      askReveal.setCount(revealKey, shown + 1);
      setShown(shown + 1);
    }, shown === 0 ? 120 : wordDelay(last, following));
    return () => clearTimeout(timer);
  }, [instant, skipped, shown, wordTotal, final, tokens, revealKey]);

  // Leaving mid-reveal (navigation, unmount) must not leave the speaking glow or the reply gate stuck on.
  useEffect(() => () => askReveal.pause(revealKey), [revealKey]);

  if (instant || skipped || shown >= wordTotal) {
    return <Text style={style} selectable={final && (instant || skipped || shown >= wordTotal)}>{text}</Text>;
  }

  let seen = 0;
  let cut = tokens.length;
  for (let index = 0; index < tokens.length; index += 1) {
    if (isWordToken(tokens[index])) {
      seen += 1;
      if (seen > shown) {
        cut = index;
        break;
      }
    }
  }
  const visible = tokens.slice(0, cut).join('');
  const hidden = tokens.slice(cut).join('');
  return (
    <Text style={style}>
      {visible}
      <Text style={HIDDEN}>{hidden}</Text>
    </Text>
  );
});

const HIDDEN: TextStyle = { color: 'transparent' };
