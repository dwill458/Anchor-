import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn, useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, spacing } from '@/theme/v2';
import type { useAskChart } from '@/hooks/v2/chart/useAskChart';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { chartTypography as typography } from '../chartTypography';
import { CHART_MAP_TOKENS } from '../map/chartMapTokens';
import type { ChartAnchorArt } from '../ChartLandscape';
import { AskComposer } from './AskComposer';
import { AskMessageRow, type AskRowItem } from './AskMessageRow';
import { AskSuggestions } from './AskSuggestions';
import { useAskAccent } from './askChartTheme';

const COPY = CHART_COPY.ask;

export type AskCta = { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string };

type Props = {
  ask: ReturnType<typeof useAskChart>;
  intention: string;
  category: string | null | undefined;
  anchorArt: ChartAnchorArt | null;
  reducedMotion: boolean;
  /** Omit for a screen that cannot go back (the creation flow supplies its own handler). */
  onBack?: () => void;
  headerRight?: React.ReactNode;
  /** The one thing the conversation is working toward, e.g. "Build my route". Shown above the composer. */
  primaryAction?: AskCta | null;
  /** A quieter alternative, e.g. "Draft my route now". */
  secondaryAction?: AskCta | null;
  composerValue: string;
  onComposerChange: (value: string) => void;
  /** Sends the composer text (the screen decides about attachments). */
  onSend: () => void;
  composerLeading?: React.ReactNode;
  composerTrailing?: React.ReactNode;
  canSendEmpty?: boolean;
  sendBlocked?: boolean;
  /** Replaces the composer while it is in use (voice recording). */
  composerReplacement?: React.ReactNode;
  /** Layers over the whole conversation: the attachment sheet and the photo preview. */
  overlay?: React.ReactNode;
  /** Content shown above the suggestions inside the footer (attachment preview, recording state). */
  footerExtra?: React.ReactNode;
  renderExtra?: (message: AskUiMessage) => React.ReactNode;
  testID?: string;
};

/** One row object per message, so unchanged rows keep their identity (and skip re-rendering) while a reply streams. */
const rowCache = new WeakMap<AskUiMessage, AskRowItem>();
const rowFor = (message: AskUiMessage): AskRowItem => {
  let row = rowCache.get(message);
  if (!row) {
    row = { kind: 'message', message };
    rowCache.set(message, row);
  }
  return row;
};

const keyOf = (item: AskRowItem) => (item.kind === 'message' ? item.message.key : item.key);

function errorLine(kind: string | undefined): string {
  switch (kind) {
    case 'offline': return COPY.offline;
    case 'unavailable': return COPY.unavailable;
    case 'conflict': return COPY.busy;
    case 'rate_limited': return COPY.rateLimited;
    case 'disabled': return COPY.disabled;
    case 'cancelled': return COPY.stopped;
    default: return COPY.unknown;
  }
}

/**
 * The cream conversation, shared by Chart creation and ongoing help. It is purely presentational: the parent owns the
 * conversation (useAskChart), the composer text and anything that leaves the screen.
 */
export function AskChartView({
  ask, intention, category, anchorArt, reducedMotion, onBack, headerRight, primaryAction, secondaryAction,
  composerValue, onComposerChange, onSend, composerLeading, composerTrailing, canSendEmpty, sendBlocked, composerReplacement, overlay, footerExtra, renderExtra, testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const accent = useAskAccent(category);
  const keyboard = useAnimatedKeyboard();
  const listRef = useRef<FlatList<AskRowItem>>(null);
  const stick = useRef(true);
  const { state } = ask;

  const draft = state.draft;
  const loadingGreeting = state.status === 'loading';
  const rows = useMemo<AskRowItem[]>(() => {
    const list = state.messages.map(rowFor);
    if (draft) {
      // The reply being written sits under the message it answers, not under anything typed since.
      const sending = state.messages.findIndex(message => message.status === 'sending');
      const row: AskRowItem = { kind: 'draft', key: draft.key, text: draft.text, thinking: draft.text.length === 0 };
      if (sending >= 0) list.splice(sending + 1, 0, row);
      else list.push(row);
    } else if (loadingGreeting) list.push({ kind: 'draft', key: 'loading', text: '', thinking: true });
    return list;
  }, [state.messages, draft, loadingGreeting]);

  const scrollToEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: false }), []);

  // A new message from the person always brings the list to the bottom, even if they had scrolled up.
  const lastUserKey = useRef<string | null>(null);
  useEffect(() => {
    const latestUser = [...state.messages].reverse().find(message => message.role === 'USER');
    if (latestUser && latestUser.key !== lastUserKey.current) {
      lastUserKey.current = latestUser.key;
      stick.current = true;
    }
  }, [state.messages]);

  // Tell assistive tech once per finished answer, never per streamed token.
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (state.turn === 'idle' && last?.role === 'ASSISTANT' && last.animate && last.key !== lastAnnounced.current) {
      lastAnnounced.current = last.key;
      AccessibilityInfo.announceForAccessibility(`${COPY.assistantSaid}: ${last.text}`);
    }
  }, [state.messages, state.turn]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // Following the conversation only while the person is at (or near) the bottom: never yank them back mid-read.
    stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 96;
  }, []);
  const onContentSizeChange = useCallback(() => {
    if (stick.current) scrollToEnd();
  }, [scrollToEnd]);
  const onListLayout = useCallback((_event: LayoutChangeEvent) => {
    // The keyboard (or the footer) resized the list: keep the newest message in view.
    if (stick.current) requestAnimationFrame(scrollToEnd);
  }, [scrollToEnd]);

  const footerStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(keyboard.height.value, insets.bottom) + spacing[2] }));

  const renderItem = useCallback(
    ({ item }: { item: AskRowItem }) => (
      <AskMessageRow item={item} accent={accent} art={anchorArt} category={category} reducedMotion={reducedMotion} onRetry={ask.retry} renderExtra={renderExtra} />
    ),
    [accent, anchorArt, category, reducedMotion, ask.retry, renderExtra]
  );

  const pickSuggestion = useCallback((text: string) => ask.send(text), [ask]);
  const error = state.error;
  const showSuggestions = ask.suggestions.length > 0 && !primaryAction;

  return (
    <View style={styles.root} testID={testID ?? 'ask-chart'}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerSide}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} style={styles.back} testID="ask-back">
              <ArrowLeft size={22} color={colors.text.primary} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.headerCenter} accessibilityRole="header">
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{intention}</Text>
        </View>
        <View style={[styles.headerSide, styles.headerRight]}>{headerRight}</View>
      </View>

      {state.status === 'load_failed' ? (
        <View style={styles.centered} testID="ask-load-failed">
          <Text style={styles.failTitle}>{COPY.historyFailed}</Text>
          <Text style={styles.failSupport}>{COPY.historyFailedSupport}</Text>
          <V2Button variant="secondary" size="medium" onPress={ask.reload} testID="ask-reload">{COPY.retry}</V2Button>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={keyOf}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onContentSizeChange={onContentSizeChange}
          onLayout={onListLayout}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          initialNumToRender={14}
          windowSize={9}
          maxToRenderPerBatch={8}
          removeClippedSubviews
          accessibilityLabel={COPY.messages}
          testID="ask-list"
        />
      )}

      <Animated.View style={[styles.footer, footerStyle]}>
        {error ? (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(160)} style={styles.errorBox} accessibilityLiveRegion="polite" testID="ask-error">
            <Text style={styles.errorText}>{errorLine(error.kind)}</Text>
            <Pressable accessibilityRole="button" onPress={ask.retry} hitSlop={8} testID="ask-error-retry">
              <Text style={[styles.errorAction, { color: accent.text }]}>{error.kind === 'cancelled' ? COPY.getAnswer : COPY.retry}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {state.turn !== 'idle' ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText} accessibilityLiveRegion="polite">{state.stage === 'preparing_change' ? COPY.preparingChange : ''}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={COPY.stop} onPress={ask.cancel} hitSlop={8} testID="ask-stop">
              <Text style={[styles.errorAction, { color: accent.text }]}>{COPY.stop}</Text>
            </Pressable>
          </View>
        ) : null}

        {showSuggestions ? <AskSuggestions key={ask.state.messages[ask.state.messages.length - 1]?.key} suggestions={ask.suggestions} accent={accent} reducedMotion={reducedMotion} onPick={pickSuggestion} /> : null}

        {primaryAction || secondaryAction ? (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(200)} style={styles.actions}>
            {primaryAction ? (
              <V2Button size="large" onPress={primaryAction.onPress} loading={primaryAction.loading} disabled={primaryAction.disabled} testID={primaryAction.testID ?? 'ask-primary'}>
                {primaryAction.label}
              </V2Button>
            ) : null}
            {secondaryAction ? (
              <Pressable accessibilityRole="button" onPress={secondaryAction.onPress} disabled={secondaryAction.disabled} hitSlop={8} style={styles.secondary} testID={secondaryAction.testID ?? 'ask-secondary'}>
                <Text style={[styles.secondaryText, { color: accent.text }]}>{secondaryAction.label}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}

        {footerExtra}
        {composerReplacement ?? <AskComposer
          value={composerValue}
          onChangeText={onComposerChange}
          onSend={onSend}
          accent={accent}
          leading={composerLeading}
          trailing={composerTrailing}
          canSendEmpty={canSendEmpty}
          blocked={sendBlocked}
          editable={state.status !== 'load_failed'}
        />}
      </Animated.View>
      {overlay}
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  headerSide: { width: 48, minHeight: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  title: { ...typography.headingMD, fontFamily: CHART_MAP_TOKENS.serif, fontSize: 21, lineHeight: 26, color: colors.text.primary },
  subtitle: { ...typography.bodySM, color: colors.text.secondary, maxWidth: '100%' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[4] },
  separator: { height: spacing[4] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  failTitle: { ...typography.headingMD, color: colors.text.primary, textAlign: 'center' },
  failSupport: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center' },
  footer: { backgroundColor: colors.canvas, paddingTop: spacing[2], gap: spacing[2] },
  errorBox: { marginHorizontal: spacing[5], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  errorText: { ...typography.bodySM, color: colors.semantic.error, flex: 1 },
  errorAction: { ...typography.labelMD, textDecorationLine: 'underline' },
  statusRow: { marginHorizontal: spacing[5], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  statusText: { ...typography.bodySM, color: colors.text.secondary, flex: 1 },
  actions: { paddingHorizontal: spacing[5], gap: spacing[2], paddingBottom: spacing[1] },
  secondary: { alignSelf: 'center', minHeight: 36, justifyContent: 'center' },
  secondaryText: { ...typography.labelMD },
});
