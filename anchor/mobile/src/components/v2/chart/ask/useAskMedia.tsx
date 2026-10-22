import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/v2';
import type { useAskChart } from '@/hooks/v2/chart/useAskChart';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { useAskAttachments } from '@/hooks/v2/chart/useAskAttachments';
import { useAskDictation } from '@/hooks/v2/chart/useAskDictation';
import { chartTypography as typography } from '../chartTypography';
import { useAskAccent } from './askChartTheme';
import { AskAttachSheet } from './AskAttachSheet';
import { AskAttachmentStrip, AskMicButton, AskPhotoPreview, AskPhotoRequest, AskPlusButton } from './AskAttachments';
import { AskVoiceRecorder } from './AskVoiceRecorder';
import { AskSettingsButton, AskSettingsSheet } from './AskSettingsSheet';
import { useAskProfile } from '@/hooks/v2/chart/useAskProfile';

const MAX_LENGTH = 1000;

type Options = {
  ask: ReturnType<typeof useAskChart>;
  anchorId: string;
  category: string | null | undefined;
  reducedMotion: boolean;
  /** Test seam for the upload. */
  uploadApi?: Parameters<typeof useAskAttachments>[0]['api'];
};

/**
 * Everything the composer needs beyond text: voice input, photos, the attachment sheet, the preview and the
 * AI-requested-photo card. Returns props for AskChartView, so creation and ongoing Ask Chart share one behaviour.
 */
export function useAskMedia({ ask, anchorId, category, reducedMotion, uploadApi }: Options) {
  const accent = useAskAccent(category);
  const [text, setText] = useState('');
  const textRef = useRef('');
  textRef.current = text;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [skippedRequest, setSkippedRequest] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profile = useAskProfile({ anchorId, open: settingsOpen });

  const attachments = useAskAttachments({ anchorId, api: uploadApi });
  const getText = useCallback(() => textRef.current, []);
  const dictation = useAskDictation({ getText, onText: setText, maxChars: MAX_LENGTH });

  const openSheet = useCallback(() => {
    Keyboard.dismiss();
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const choose = useCallback(
    (source: 'camera' | 'library') => {
      setSheetOpen(false);
      void attachments.add(source);
    },
    [attachments]
  );

  const sendBlocked = attachments.pending || attachments.failed || dictation.recording;
  const onSend = useCallback(() => {
    if (sendBlocked) return;
    const ready = attachments.items.filter(item => item.status === 'ready' && item.assetId);
    const accepted = ask.send(textRef.current, { attachments: ready.map(item => item.assetId as string), previewUris: ready.map(item => item.uri) });
    if (accepted) {
      setText('');
      attachments.clear();
    }
  }, [ask, attachments, sendBlocked]);

  const lastAssistantKey = useMemo(() => [...ask.state.messages].reverse().find(message => message.role === 'ASSISTANT')?.key ?? null, [ask.state.messages]);

  const renderExtra = useCallback(
    (message: AskUiMessage) => {
      // Only the newest answer can ask for a photo, only while nothing has followed it, and only until it is waved off.
      if (!ask.requestPhoto || message.key !== lastAssistantKey || skippedRequest === message.key || attachments.items.length > 0) return null;
      return <AskPhotoRequest accent={accent} onCamera={() => choose('camera')} onLibrary={() => choose('library')} onSkip={() => setSkippedRequest(message.key)} />;
    },
    [accent, ask.requestPhoto, attachments.items.length, choose, lastAssistantKey, skippedRequest]
  );

  const notice = dictation.notice ?? attachments.notice;
  const failedNote = attachments.failed ? 'A photo didn’t upload. Tap it to try again, or remove it.' : null;

  const footerExtra = (
    <>
      {notice || failedNote ? (
        <View style={styles.noticeRow} accessibilityLiveRegion="polite" testID="ask-media-notice">
          <Text style={styles.notice}>{failedNote ?? notice}</Text>
        </View>
      ) : null}
      <AskAttachmentStrip items={attachments.items} accent={accent} reducedMotion={reducedMotion} onRemove={attachments.remove} onRetry={attachments.retry} onPreview={setPreview} />
    </>
  );

  return {
    composerValue: text,
    onComposerChange: setText,
    onSend,
    canSendEmpty: attachments.readyIds.length > 0,
    sendBlocked,
    // The controls appear only where they can work: attach always (the system picker exists), voice only where speech recognition does.
    composerLeading: <AskPlusButton accent={accent} onPress={openSheet} disabled={!attachments.canAdd || dictation.recording} />,
    composerTrailing: dictation.available ? <AskMicButton accent={accent} onPress={dictation.start} /> : null,
    composerReplacement: dictation.recording ? <AskVoiceRecorder dictation={dictation} accent={accent} reducedMotion={reducedMotion} /> : null,
    footerExtra,
    renderExtra,
    headerRight: <AskSettingsButton onPress={() => { Keyboard.dismiss(); setSettingsOpen(true); }} />,
    overlay: (
      <>
        <AskSettingsSheet visible={settingsOpen} accent={accent} profile={profile} onClose={() => setSettingsOpen(false)} onCleared={ask.reload} />
        <AskAttachSheet visible={sheetOpen} accent={accent} reducedMotion={reducedMotion} onClose={closeSheet} onCamera={() => choose('camera')} onLibrary={() => choose('library')} />
        <AskPhotoPreview uri={preview} onClose={() => setPreview(null)} reducedMotion={reducedMotion} />
      </>
    ),
  };
}

const styles = StyleSheet.create({
  noticeRow: { marginHorizontal: spacing[5] },
  notice: { ...typography.bodySM, color: colors.text.secondary },
});
