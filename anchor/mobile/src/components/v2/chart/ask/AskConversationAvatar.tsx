import React from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { ChartAnchorArt } from '../ChartLandscape';
import type { AskAccent } from './askChartTheme';
import { AskSpeakingAvatar } from './AskAnchorAvatar';
import { askReveal, useRevealing } from './askReveal';
import { useMinimumThinking } from './useMinimumThinking';
import { spacing } from '@/theme/v2';

/** One Anchor for the conversation. It travels between reply rows and scrolls with its current bubble. */
export function AskConversationAvatar({ messageKey, text, draft, animate, handoffThinking, art, category, accent, reducedMotion, rowY, scrollY }: {
  messageKey: string;
  text: string;
  draft: boolean;
  animate: boolean;
  handoffThinking: boolean;
  art: ChartAnchorArt | null;
  category: string | null | undefined;
  accent: AskAccent;
  reducedMotion: boolean;
  rowY: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const revealing = useRevealing(messageKey);
  const thinking = useMinimumThinking(messageKey, text.length > 0, reducedMotion ? 0 : 720);
  const speaking = !reducedMotion && animate && (revealing || !askReveal.isDone(messageKey));
  const position = useAnimatedStyle(() => ({ transform: [{ translateY: rowY.value - scrollY.value + 2 }] }));
  return (
    <Animated.View pointerEvents="none" testID="ask-anchor" style={[{ position: 'absolute', top: 0, left: spacing[4], width: 34, height: 34 }, position]}>
      <AskSpeakingAvatar art={art} category={category} accent={accent} reducedMotion={reducedMotion} mode={handoffThinking || thinking ? 'thinking' : speaking ? 'speaking' : 'off'} testID={draft ? 'ask-thinking' : undefined} />
    </Animated.View>
  );
}
