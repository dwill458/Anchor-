import * as FileSystem from 'expo-file-system/legacy';

import { logger } from '@/utils/logger';

const PROFILE_MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}profile-media/`;

function stripQuery(uri: string): string {
  return uri.split('?')[0] ?? uri;
}

function getExtension(uri: string): string {
  const cleaned = stripQuery(uri);
  const dotIndex = cleaned.lastIndexOf('.');
  if (dotIndex < 0) {
    return '.jpg';
  }

  const extension = cleaned.slice(dotIndex).toLowerCase();
  return extension.length <= 6 ? extension : '.jpg';
}

function isManagedProfilePhoto(uri: string | null | undefined): boolean {
  return Boolean(uri && PROFILE_MEDIA_DIR && uri.startsWith(PROFILE_MEDIA_DIR));
}

async function ensureProfileMediaDirectory(): Promise<void> {
  if (!PROFILE_MEDIA_DIR) {
    return;
  }

  const existing = await FileSystem.getInfoAsync(PROFILE_MEDIA_DIR);
  if (!existing.exists) {
    await FileSystem.makeDirectoryAsync(PROFILE_MEDIA_DIR, { intermediates: true });
  }
}

export async function persistProfilePhoto(params: {
  userId: string;
  photoUri: string | null;
  previousPhotoUri?: string | null;
}): Promise<string | null> {
  const { userId, photoUri, previousPhotoUri } = params;

  try {
    await ensureProfileMediaDirectory();

    if (previousPhotoUri && previousPhotoUri !== photoUri && isManagedProfilePhoto(previousPhotoUri)) {
      await FileSystem.deleteAsync(previousPhotoUri, { idempotent: true });
    }

    if (!photoUri) {
      return null;
    }

    if (isManagedProfilePhoto(photoUri)) {
      return photoUri;
    }

    const nextUri = `${PROFILE_MEDIA_DIR}${userId}-${Date.now()}${getExtension(photoUri)}`;
    await FileSystem.copyAsync({
      from: photoUri,
      to: nextUri,
    });

    return nextUri;
  } catch (error) {
    logger.warn('[ProfileMediaService] Failed to persist profile photo locally', error);
    return photoUri;
  }
}
