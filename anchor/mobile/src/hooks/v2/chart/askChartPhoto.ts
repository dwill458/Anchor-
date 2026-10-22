import * as ImageManipulator from 'expo-image-manipulator';
import { readPhotoSize } from '@/hooks/v2/vision/visionPhotoFitProcessing';

/** Longest edge sent to Ask Chart. Big enough to read a rusted panel, small enough to upload quickly on mobile data. */
export const ASK_PHOTO_EDGE = 1600;
export const ASK_PHOTO_QUALITY = 0.82;
export const MAX_ASK_ATTACHMENTS = 3;

export type PreparedAskPhoto = { base64Image: string; mimeType: 'image/jpeg'; uri: string };

/**
 * Resizes and compresses a picked photo before it leaves the device, and returns it as base64 for the upload. The
 * original file is never modified (the result is a new cache file) and the bytes are not kept in React state.
 */
export async function prepareAskPhoto(uri: string): Promise<PreparedAskPhoto> {
  const size = await readPhotoSize(uri);
  const longEdge = size ? Math.max(size.width, size.height) : 0;
  const actions: ImageManipulator.Action[] =
    size && longEdge > ASK_PHOTO_EDGE ? [{ resize: size.width >= size.height ? { width: ASK_PHOTO_EDGE } : { height: ASK_PHOTO_EDGE } }] : [];
  const result = await ImageManipulator.manipulateAsync(uri, actions, { compress: ASK_PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('The photo could not be prepared. Please try again.');
  return { base64Image: `data:image/jpeg;base64,${result.base64}`, mimeType: 'image/jpeg', uri: result.uri };
}

export type AskAttachmentStatus = 'preparing' | 'uploading' | 'ready' | 'failed';

export type AskAttachment = {
  id: string;
  /** The picked file, for the preview (never the upload bytes). */
  uri: string;
  status: AskAttachmentStatus;
  /** 0 to 1 while uploading. */
  progress: number;
  assetId?: string;
  error?: string;
};

export type AskAttachmentAction =
  | { type: 'add'; attachment: AskAttachment }
  | { type: 'status'; id: string; status: AskAttachmentStatus; progress?: number; assetId?: string; error?: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

/** Pure state for the photos attached to the message being written. */
export function attachmentsReducer(state: AskAttachment[], action: AskAttachmentAction): AskAttachment[] {
  switch (action.type) {
    case 'add':
      return state.length >= MAX_ASK_ATTACHMENTS ? state : [...state, action.attachment];
    case 'status':
      return state.map(item => item.id !== action.id ? item : {
        ...item,
        status: action.status,
        progress: action.progress ?? (action.status === 'ready' ? 1 : action.status === 'failed' ? 0 : item.progress),
        assetId: action.assetId ?? item.assetId,
        error: action.status === 'failed' ? action.error : undefined,
      });
    case 'remove':
      return state.filter(item => item.id !== action.id);
    case 'clear':
      return [];
  }
}

export type AttachmentSummary = {
  /** Something is still being prepared or uploaded: the message cannot be sent yet. */
  pending: boolean;
  failed: boolean;
  readyIds: string[];
  canAdd: boolean;
};

export function summarizeAttachments(items: AskAttachment[]): AttachmentSummary {
  return {
    pending: items.some(item => item.status === 'preparing' || item.status === 'uploading'),
    failed: items.some(item => item.status === 'failed'),
    readyIds: items.filter(item => item.status === 'ready' && item.assetId).map(item => item.assetId as string),
    canAdd: items.length < MAX_ASK_ATTACHMENTS,
  };
}
