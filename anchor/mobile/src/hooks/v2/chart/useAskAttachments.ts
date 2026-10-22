import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { MAX_ASK_ATTACHMENTS } from './askChartPhoto';
import { askChartApi } from '@/services/v2/askChartApi';
import { classifyChartError } from '@/services/v2/chartV2Api';
import { pickVisionPhoto, type VisionPhotoSource } from '@/hooks/v2/vision/visionPhotoInput';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import { attachmentsReducer, prepareAskPhoto, summarizeAttachments, type AskAttachment } from './askChartPhoto';

type Api = Pick<typeof askChartApi, 'uploadPhoto'>;

let counter = 0;

function uploadFailureMessage(kind: string): string {
  if (kind === 'offline') return 'No connection. Your photo is still here; try again when you’re back.';
  if (kind === 'rate_limited') return 'Too many photos right now. Try again in a moment.';
  if (kind === 'invalid') return 'That photo can’t be used. Choose another one.';
  return 'The photo didn’t upload. Try again.';
}

/**
 * The photos attached to the message being written: pick (camera or library), resize, upload with progress, retry a
 * failure, remove. Nothing here is sent anywhere until the person sends the message, and the server deletes every
 * photo after a day. The upload bytes live only in the running task, never in state.
 */
export function useAskAttachments({ anchorId, api = askChartApi }: { anchorId: string; api?: Api }) {
  const [items, dispatch] = useReducer(attachmentsReducer, [] as AskAttachment[]);
  const [notice, setNotice] = useState<string | null>(null);
  const itemsRef = useRef<AskAttachment[]>([]);
  itemsRef.current = items;
  const controllers = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const running = controllers.current;
    return () => {
      mounted.current = false;
      running.forEach(controller => controller.abort());
      running.clear();
    };
  }, []);

  const process = useCallback(
    async (attachment: AskAttachment) => {
      const controller = new AbortController();
      controllers.current.set(attachment.id, controller);
      dispatch({ type: 'status', id: attachment.id, status: 'preparing', progress: 0 });
      try {
        const prepared = await prepareAskPhoto(attachment.uri);
        if (controller.signal.aborted || !mounted.current) return;
        dispatch({ type: 'status', id: attachment.id, status: 'uploading', progress: 0 });
        const result = await api.uploadPhoto(anchorId, { base64Image: prepared.base64Image, mimeType: prepared.mimeType }, {
          signal: controller.signal,
          onProgress: fraction => mounted.current && dispatch({ type: 'status', id: attachment.id, status: 'uploading', progress: fraction }),
        });
        if (controller.signal.aborted || !mounted.current) return;
        dispatch({ type: 'status', id: attachment.id, status: 'ready', assetId: result.assetId });
      } catch (caught) {
        if (controller.signal.aborted || !mounted.current) return;
        const kind = (caught as { kind?: string }).kind ?? classifyChartError(caught).kind;
        dispatch({ type: 'status', id: attachment.id, status: 'failed', error: uploadFailureMessage(kind) });
        trackChart('ask_chart_photo_failed', { kind });
      } finally {
        controllers.current.delete(attachment.id);
      }
    },
    [anchorId, api]
  );

  const add = useCallback(
    async (source: VisionPhotoSource) => {
      setNotice(null);
      if (itemsRef.current.length >= MAX_ASK_ATTACHMENTS) {
        setNotice(`You can add up to ${MAX_ASK_ATTACHMENTS} photos to one message.`);
        return;
      }
      const picked = await pickVisionPhoto(source, 0.9);
      if (!mounted.current) return;
      if (picked.status === 'cancelled') return;
      if (picked.status === 'denied') {
        setNotice(picked.message);
        if (!picked.canAskAgain) {
          Alert.alert(source === 'camera' ? 'Camera is off' : 'Photos are off', picked.message, [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ]);
        }
        return;
      }
      if (picked.status === 'error') {
        setNotice(picked.message);
        return;
      }
      const attachment: AskAttachment = { id: `photo-${Date.now().toString(36)}-${++counter}`, uri: picked.photo.uri, status: 'preparing', progress: 0 };
      dispatch({ type: 'add', attachment });
      trackChart('ask_chart_photo_added', { source });
      void process(attachment);
    },
    [process]
  );

  const retry = useCallback(
    (id: string) => {
      const attachment = items.find(item => item.id === id);
      if (attachment && attachment.status === 'failed') void process(attachment);
    },
    [items, process]
  );

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    dispatch({ type: 'remove', id });
  }, []);

  /** After a message is sent: the photos belong to that message now. */
  const clear = useCallback(() => {
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    dispatch({ type: 'clear' });
  }, []);

  const summary = useMemo(() => summarizeAttachments(items), [items]);
  return { items, ...summary, notice, clearNotice: () => setNotice(null), add, retry, remove, clear };
}
