import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { UploadAssetResult } from './useV2Vision';

export type VisionPhotoSource = 'library' | 'camera';

export type PickedVisionPhoto = {
  uri: string;
  mimeType: string;
  /** Recorded on the board image so a photo taken now is told apart from one chosen. */
  sourceType: 'USER_UPLOAD' | 'USER_CAMERA';
};

export type VisionPhotoPick =
  | { status: 'picked'; photo: PickedVisionPhoto }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string; canAskAgain: boolean }
  | { status: 'error'; message: string };

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function mimeTypeOf(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * Chooses or takes ONE photo and hands it back for a preview. Nothing is
 * uploaded here: the person confirms first.
 */
export async function pickVisionPhoto(source: VisionPhotoSource, quality = 0.85): Promise<VisionPhotoPick> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        return { status: 'denied', canAskAgain: permission.canAskAgain !== false, message: 'Allow camera access to take a photo for your Vision.' };
      }
    } else if (Platform.OS === 'ios') {
      // Android's system picker needs no library permission.
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        return { status: 'denied', canAskAgain: permission.canAskAgain !== false, message: 'Allow photo library access to add an image.' };
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality, allowsEditing: false, legacy: true };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return { status: 'cancelled' };
    const mimeType = mimeTypeOf(asset);
    if (!SUPPORTED.includes(mimeType)) return { status: 'error', message: 'Choose a JPEG, PNG, WebP, or GIF image.' };
    return { status: 'picked', photo: { uri: asset.uri, mimeType, sourceType: source === 'camera' ? 'USER_CAMERA' : 'USER_UPLOAD' } };
  } catch (cause) {
    return {
      status: 'error',
      message: source === 'camera' ? 'The camera is not available right now.' : cause instanceof Error ? cause.message : 'Unable to open your photos.',
    };
  }
}

/** Uploads a confirmed photo as a Vision asset. The bytes are read once and never held in React state. */
export async function uploadVisionPhoto(
  photo: Pick<PickedVisionPhoto, 'uri' | 'mimeType'>,
  uploadAsset: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>,
): Promise<{ ok: true; assetId: string } | { ok: false; message: string }> {
  try {
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) return { ok: false, message: 'That photo is no longer available. Choose it again.' };
    const base64 = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
    const uploaded = await uploadAsset({ base64Image: `data:${photo.mimeType};base64,${base64}`, mimeType: photo.mimeType });
    return uploaded.ok ? { ok: true, assetId: uploaded.asset.id } : { ok: false, message: uploaded.message };
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : 'Upload failed. Please try again.' };
  }
}
