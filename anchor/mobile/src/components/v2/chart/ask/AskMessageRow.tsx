import React, { memo, useCallback, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import type { ChartAnchorArt } from '../ChartLandscape';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { AskAnchorAvatar, AskSpeakingAvatar } from './AskAnchorAvatar';
import { ASK_TOKENS, type AskAccent } from './askChartTheme';
import { askReveal, useRevealing } from './askReveal';
import { AskRevealText } from './AskRevealText';

const COPY = CHART_COPY.ask;
const AVATAR = 34;

/** Keys that have already played their entrance, so a row scrolled out and back in never animates twice. */
const played = new Set<string>();

export type AskRowItem =
  | { kind: 'message'; message: AskUiMessage }
  | { kind: 'draft'; key: string; text: string; thinking: boolean };

type Props = {
  item: AskRowItem;
  accent: AskAccent;
  art: ChartAnchorArt | null;
  category: string | null | undefined;
  reducedMotion: boolean;
  onRetry: () => void;
  /** Extra content under an assistant message (proposals, photo request). */
  renderExtra?: (message: AskUiMessage) => React.ReactNode;
};

function enteringFor(key: string, animate: boolean, kind: 'user' | 'assistant') {
  const first = animate && !played.has(key);
  if (first) played.add(key);
  if (!first) return undefined;
  // The person's own message rises into place; the answer simply arrives.
  return kind === 'user' ? FadeInDown.duration(210) : FadeIn.duration(220);
}

export const AskMessageRow = memo(function AskMessageRow({ item, accent, art, category, reducedMotion, onRetry, renderExtra }: Props) {
  const isUser = item.kind === 'message' && item.message.role === 'USER';
  const key = item.kind === 'message' ? item.message.key : item.key;
  const entering = enteringFor(key, item.kind === 'message' ? item.message.animate : false, isUser ? 'user' : 'assistant');

  if (item.kind === 'draft') {
    return (
      <View style={styles.assistantRow} testID="ask-draft">
        <View style={styles.avatarSlot}>
          <AskSpeakingAvatar art={art} category={category} accent={accent} size={AVATAR} reducedMotion={reducedMotion} active testID="ask-thinking" />
        </View>
        {item.thinking ? (
          <View style={styles.flexShrink} />
        ) : (
          <View style={[styles.assistantBubble, styles.flexShrink]}>
            <AskRevealText revealKey={item.key} text={item.text} style={styles.assistantText} animate={!reducedMotion} final={false} />
          </View>
        )}
      </View>
    );
  }

  const { message } = item;
  if (isUser) {
    const failed = message.status === 'failed';
    return (
      <Animated.View entering={entering} style={styles.userRow} testID={`ask-user-${message.key}`}>
        <View style={[styles.userBubble, message.status === 'queued' && styles.queued]}>
          {message.previewUris?.length ? (
            <View style={styles.photos}>
              {message.previewUris.map(uri => <Image key={uri} source={{ uri }} style={styles.photo} accessibilityLabel="Photo you sent" accessibilityIgnoresInvertColors />)}
            </View>
          ) : message.attachments.length > 0 ? (
            <Text style={styles.attachmentNote} accessibilityLabel={`${message.attachments.length} photo attached`}>
              {message.attachments.length === 1 ? '1 photo' : `${message.attachments.length} photos`}
            </Text>
          ) : null}
          {message.text ? <Text style={styles.userText} selectable>{message.text}</Text> : null}
        </View>
        {failed ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${COPY.failedToSend}. ${COPY.retry}`} onPress={onRetry} hitSlop={8} style={styles.failedRow} testID="ask-retry">
            <Text style={styles.failedText}>{COPY.failedToSend}</Text>
            <Text style={[styles.retryText, { color: accent.text }]}>{COPY.retry}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  return <AssistantRow message={message} entering={entering} accent={accent} art={art} category={category} reducedMotion={reducedMotion} renderExtra={renderExtra} />;
});

type AssistantProps = Pick<Props, 'accent' | 'art' | 'category' | 'reducedMotion' | 'renderExtra'> & {
  message: AskUiMessage;
  entering: ReturnType<typeof enteringFor>;
};

/** The Anchor's message: its glow lasts exactly as long as its words are still arriving. */
const AssistantRow = memo(function AssistantRow({ message, entering, accent, art, category, reducedMotion, renderExtra }: AssistantProps) {
  const revealing = useRevealing(message.key);
  const animate = message.animate && !reducedMotion;
  const speaking = revealing || (animate && !askReveal.isDone(message.key));
  const skipRef = useRef<(() => void) | null>(null);
  const registerSkip = useCallback((skip: (() => void) | null) => {
    skipRef.current = skip;
  }, []);
  const skipReveal = useCallback(() => skipRef.current?.(), []);
  return (
    <Animated.View entering={entering} style={styles.assistantRow} testID={`ask-assistant-${message.key}`}>
      <View style={styles.avatarSlot}>
        <AskSpeakingAvatar art={art} category={category} accent={accent} size={AVATAR} reducedMotion={reducedMotion} active={speaking} />
      </View>
      <View style={styles.flexShrink}>
        <Pressable onPress={skipReveal} disabled={!speaking} accessible={false} style={[styles.assistantBubble, { borderColor: accent.border }]} testID={`ask-bubble-${message.key}`}>
          <AskRevealText revealKey={message.key} text={message.text} style={styles.assistantText} animate={animate} final registerSkip={registerSkip} />
        </Pressable>
        {renderExtra?.(message)}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1, flex: 1 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingRight: spacing[6] },
  avatarSlot: { width: AVATAR, height: AVATAR, marginTop: 2 },
  assistantBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingTop: 14,
    paddingBottom: 15,
    borderRadius: 26,
    borderTopLeftRadius: 8,
    backgroundColor: ASK_TOKENS.ivory,
    borderWidth: 1,
    ...ASK_TOKENS.shadow,
  },
  assistantText: { ...typography.bodyLG, fontSize: 16, lineHeight: 24, color: ASK_TOKENS.ink },
  userRow: { alignItems: 'flex-end', paddingLeft: spacing[8] },
  userBubble: { paddingHorizontal: spacing[4], paddingVertical: 12, borderRadius: 26, borderBottomRightRadius: 8, gap: 4, backgroundColor: ASK_TOKENS.navy, ...ASK_TOKENS.shadow },
  queued: { opacity: 0.72 },
  userText: { ...typography.bodyLG, fontSize: 16, lineHeight: 23, color: ASK_TOKENS.onNavy },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'flex-end' },
  photo: { width: 112, height: 112, borderRadius: radii.md },
  attachmentNote: { ...typography.labelSM, color: ASK_TOKENS.onNavy },
  failedRow: { flexDirection: 'row', gap: spacing[2], paddingTop: spacing[1], minHeight: 32, alignItems: 'center' },
  failedText: { ...typography.bodySM, color: colors.semantic.error },
  retryText: { ...typography.labelMD, textDecorationLine: 'underline' },
});
