import { Platform, Share } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { ServiceError } from './ServiceErrors';

export type AnchorArtworkExportMode = 'wallpaper' | 'download';

export interface AnchorArtworkExportDescriptor {
  anchorName: string;
  intentionText: string;
}

export interface AnchorArtworkExportParams {
  anchor: AnchorArtworkExportDescriptor;
  mode: AnchorArtworkExportMode;
  captureArtwork: () => Promise<string>;
}

export interface AnchorArtworkExportResult {
  localUri: string;
  filename: string;
  mode: AnchorArtworkExportMode;
}

const sanitizeSegment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'anchor';

const buildFilename = (anchorName: string): string =>
  `${sanitizeSegment(anchorName)}-wallpaper.png`;

const createWallpaperMessage = (intentionText: string): string =>
  `Save this PNG, then set it as your wallpaper from your device settings.\n\n"${intentionText}"`;

export async function exportAnchorArtwork({
  anchor,
  mode,
  captureArtwork,
}: AnchorArtworkExportParams): Promise<AnchorArtworkExportResult> {
  let localUri: string;

  try {
    localUri = await captureArtwork();
  } catch (error) {
    throw new ServiceError(
      'artwork/export-failed',
      'Unable to generate your anchor artwork right now.',
      error
    );
  }

  const filename = buildFilename(anchor.anchorName);

  if (mode === 'download') {
    const requiresPermission = Platform.OS !== 'android' || Number(Platform.Version) < 29;

    if (requiresPermission) {
      let permission;
      try {
        permission = await MediaLibrary.requestPermissionsAsync(true);
      } catch (error) {
        throw new ServiceError(
          'artwork/permission-failed',
          'Unable to request photo library access right now.',
          error
        );
      }

      if (!permission.granted) {
        throw new ServiceError(
          'artwork/permission-denied',
          'Photo library permission is required to save this PNG.'
        );
      }
    }

    try {
      await MediaLibrary.saveToLibraryAsync(localUri);
    } catch (error) {
      throw new ServiceError(
        'artwork/save-failed',
        'Unable to save this PNG to your photo library.',
        error
      );
    }

    return {
      localUri,
      filename,
      mode,
    };
  }

  try {
    await Share.share({
      title: `${anchor.anchorName} wallpaper`,
      message: createWallpaperMessage(anchor.intentionText),
      url: localUri,
    });
  } catch (error) {
    throw new ServiceError(
      'artwork/share-failed',
      'Unable to open the share sheet for this wallpaper right now.',
      error
    );
  }

  return {
    localUri,
    filename,
    mode,
  };
}
