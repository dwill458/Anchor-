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
import { ThinkingBubble } from './ThinkingBubble';
import { useMinimumThinking } from './useMinimumThinking';

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
  onFollow?: (key: string, y: number) => void;
  handoffThinking?: boolean;
  /** The conversation owns one travelling Anchor; standalone rows can still supply their own avatar. */
  showAvatar?: boolean;
};

function enteringFor(key: string, animate: boolean, kind: 'user' | 'assistant') {
  const first = animate && !played.has(key);
  if (first) played.add(key);
  if (!first) return undefined;
  // The person's own message rises into place; the answer simply arrives.
  return kind === 'user' ? FadeInDown.duration(210) : FadeIn.duration(220);
}

export const AskMessageRow = memo(function AskMessageRow({ item, accent, art, category, reducedMotion, onRetry, renderExtra, onFollow, handoffThinking, showAvatar = true }: Props) {
  const isUser = item.kind === 'message' && item.message.role === 'USER';
  const key = item.kind === 'message' ? item.message.key : item.key;
  const entering = enteringFor(key, !reducedMotion && (item.kind === 'message' ? item.message.animate : false), isUser ? 'user' : 'assistant');
  const hasText = item.kind === 'message' || item.text.length > 0;
  const held = useMinimumThinking(key, hasText, reducedMotion ? 0 : 600);
  const thinkingVisible = useMinimumThinking(key, hasText, reducedMotion ? 0 : 720);
  const follow = useCallback((y: number) => onFollow?.(key, y + 14), [key, onFollow]);

  if (!isUser && (item.kind === 'draft' || thinkingVisible)) {
    return (
      <View style={styles.assistantRow} testID="ask-draft">
        <View style={styles.avatarSlot}>
          {showAvatar ? <AskSpeakingAvatar art={art} category={category} accent={accent} size={AVATAR} reducedMotion={reducedMotion} mode={thinkingVisible || handoffThinking ? 'thinking' : 'speaking'} testID="ask-thinking" /> : null}
        </View>
        {thinkingVisible ? (
          // DEFERRED: the empty avatar-only placeholder is replaced by ThinkingBubble (Oct 2026).
          <ThinkingBubble accent={accent} reducedMotion={reducedMotion} opening={key === 'loading'} leaving={!held} />
        ) : (
          <View style={[styles.assistantBubble, styles.flexShrink, { borderColor: accent.border }]}>
            <AskRevealText revealKey={key} text={item.kind === 'draft' ? item.text : item.message.text} style={styles.assistantText} animate={!reducedMotion} final={item.kind === 'message'} onLine={follow} />
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

  return <AssistantRow message={message} entering={entering} accent={accent} art={art} category={category} reducedMotion={reducedMotion} renderExtra={renderExtra} onFollow={onFollow} handoffThinking={handoffThinking} showAvatar={showAvatar} />;
});

type AssistantProps = Pick<Props, 'accent' | 'art' | 'category' | 'reducedMotion' | 'renderExtra' | 'onFollow' | 'handoffThinking' | 'showAvatar'> & {
  message: AskUiMessage;
  entering: ReturnType<typeof enteringFor>;
};

/** The Anchor's message: its glow lasts exactly as long as its words are still arriving. */
const AssistantRow = memo(function AssistantRow({ message, entering, accent, art, category, reducedMotion, renderExtra, onFollow, handoffThinking, showAvatar }: AssistantProps) {
  const revealing = useRevealing(message.key);
  const animate = message.animate && !reducedMotion;
  const speaking = revealing || (animate && !askReveal.isDone(message.key));
  const skipRef = useRef<(() => void) | null>(null);
  const registerSkip = useCallback((skip: (() => void) | null) => {
    skipRef.current = skip;
  }, []);
  const skipReveal = useCallback(() => skipRef.current?.(), []);
  const follow = useCallback((y: number) => onFollow?.(message.key, y + 14), [message.key, onFollow]);
  return (
    <Animated.View entering={entering} style={styles.assistantRow} testID={`ask-assistant-${message.key}`}>
      <View style={styles.avatarSlot}>
        {/* DEFERRED: per-bubble avatars are replaced by the conversation's travelling Anchor (Oct 2026). */}
        {showAvatar ? <AskSpeakingAvatar art={art} category={category} accent={accent} size={AVATAR} reducedMotion={reducedMotion} mode={handoffThinking ? 'thinking' : speaking ? 'speaking' : 'off'} /> : null}
      </View>
      <View style={styles.flexShrink}>
        <Pressable onPress={skipReveal} disabled={!speaking} accessible={false} style={[styles.assistantBubble, { borderColor: accent.border }]} testID={`ask-bubble-${message.key}`}>
          <AskRevealText revealKey={message.key} text={message.text} style={styles.assistantText} animate={animate} final registerSkip={registerSkip} onLine={follow} />
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
