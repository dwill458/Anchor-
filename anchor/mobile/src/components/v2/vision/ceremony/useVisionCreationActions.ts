import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { pickVisionPhoto, uploadVisionPhoto, useV2VisionSceneGeneration, type PickedVisionPhoto } from '@/hooks/v2/vision';
import type { V2VisionCreationFlowProps, VisionFlowAsset } from '../V2VisionCreationFlow';
import type { VisionStartPhoto } from '../VisionMomentInput';
import type { VisionTwoUpSelection } from '../VisionTwoUpStage';
import { VISION_DESCRIPTION_MIN_CHARS, VISION_DESCRIPTION_MAX_CHARS, visionPhotoSceneDescription } from '../visionGuidance';
import { VISION_BOARD_MAX_IMAGES } from '../board/visionBoardLayouts';

export type VisionCeremonyActionsProps = Pick<V2VisionCreationFlowProps,
  'anchorId' | 'anchorIntention' | 'onPremiumRequired' | 'onSaveDescription' | 'onUploadAsset' | 'onAssemble'> & { mode: 'create' | 'add' };
export type CeremonyPhoto = PickedVisionPhoto & { key: string };

export function photoVisionDescription(written: string, intention: string) {
  if (written.length >= VISION_DESCRIPTION_MIN_CHARS) return written;
  const base = intention.trim();
  return base.length >= VISION_DESCRIPTION_MIN_CHARS ? base : `${base} — my Vision`.trim();
}

/** Upload local photos while they settle; persistence still belongs to Seal. */
export function useVisionCreationActions(props: VisionCeremonyActionsProps) {
  const generation = useV2VisionSceneGeneration(props.anchorId, props.onPremiumRequired);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  // Successful uploads survive a failed scene save, so retry never uploads them twice.
  const uploaded = useRef(new Map<string, VisionFlowAsset>());
  const uploading = useRef(new Map<string, Promise<VisionFlowAsset>>());
  const [uploadingCount, setUploadingCount] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const generate = async (description: string, appearanceReferenceId?: string | null, photo?: VisionStartPhoto | null) => {
    const trimmed = description.trim();
    const minChars = props.mode === 'add' ? 6 : VISION_DESCRIPTION_MIN_CHARS;
    const maxChars = props.mode === 'add' ? 400 : VISION_DESCRIPTION_MAX_CHARS;
    const valid = trimmed.length >= minChars && trimmed.length <= maxChars;
    if (photo ? trimmed.length > 0 && !valid : !valid) {
      setNotice(`Describe your Vision in ${minChars}–${maxChars} characters.`); return false;
    }
    if (startingRef.current) return false;
    startingRef.current = true; setStarting(true); setNotice(null);
    try {
      let startAssetId: string | null = null;
      // This is Describe's photo-to-generation input, not the direct own-photo path.
      if (photo) {
        const result = await uploadVisionPhoto(photo, props.onUploadAsset);
        if (!result.ok) { setNotice(result.message); return false; }
        startAssetId = result.assetId;
      }
      const visionDescription = photo ? photoVisionDescription(trimmed, props.anchorIntention) : trimmed;
      if (props.onSaveDescription && !await props.onSaveDescription(visionDescription)) {
        setNotice('Your description could not be saved. Please try again.'); return false;
      }
      return photo
        ? await generation.start(visionPhotoSceneDescription(trimmed, props.anchorIntention, maxChars, minChars), null, startAssetId)
        : await generation.start(trimmed, appearanceReferenceId);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Image creation is unavailable right now.'); return false;
    } finally { startingRef.current = false; setStarting(false); }
  };

  const pickImages = async (multiple: boolean, source: 'library' | 'camera'): Promise<CeremonyPhoto[] | null> => {
    setNotice(null);
    try {
      if (!multiple || source === 'camera') {
        const result = await pickVisionPhoto(source);
        if (result.status === 'cancelled') return null;
        if (result.status !== 'picked') {
          setNotice(result.message);
          if (result.status === 'error') throw new Error(result.message);
          if (result.status === 'denied' && !result.canAskAgain) Alert.alert('Permission needed', result.message, [
            { text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ]);
          return null;
        }
        return [{ ...result.photo, key: `${Date.now()}-0` }];
      }
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') { setNotice('Allow photo library access to add your images.'); return null; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, selectionLimit: VISION_BOARD_MAX_IMAGES, quality: 0.85 });
      if (result.canceled || !result.assets?.length) return null;
      const photos = result.assets.slice(0, VISION_BOARD_MAX_IMAGES).map((asset, i): CeremonyPhoto => ({
        key: `${Date.now()}-${i}`, uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', sourceType: 'USER_UPLOAD',
      }));
      const supported = photos.filter(item => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(item.mimeType));
      if (supported.length !== photos.length) setNotice('Choose JPEG, PNG, WebP, or GIF images.');
      return supported.length ? supported : null;
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Unable to open your photos.'); throw cause; }
  };

  const readAndUpload = async (photo: CeremonyPhoto): Promise<VisionFlowAsset> => {
    const prior = uploaded.current.get(photo.key);
    if (prior) return prior;
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) throw new Error('Photo is no longer available. Choose it again.');
    const base64 = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
    const result = await props.onUploadAsset({ base64Image: `data:${photo.mimeType};base64,${base64}`, mimeType: photo.mimeType });
    if (!result.ok) throw new Error(result.message);
    const asset: VisionFlowAsset = { assetId: result.asset.id, prompt: '', imageUrl: result.asset.resolvedUrl ?? photo.uri, sourceType: photo.sourceType };
    uploaded.current.set(photo.key, asset);
    return asset;
  };

  const uploadOne = (photo: CeremonyPhoto): Promise<VisionFlowAsset> => {
    const prior = uploaded.current.get(photo.key);
    if (prior) return Promise.resolve(prior);
    const pending = uploading.current.get(photo.key);
    if (pending) return pending;
    if (mounted.current) setUploadingCount(value => value + 1);
    const task = readAndUpload(photo).finally(() => {
      uploading.current.delete(photo.key);
      if (mounted.current) setUploadingCount(value => Math.max(0, value - 1));
    });
    uploading.current.set(photo.key, task);
    return task;
  };
  const prepareUploads = (photos: CeremonyPhoto[]) => {
    photos.forEach(photo => { void uploadOne(photo).catch(() => undefined); });
  };

  const saveUploads = async (photos: CeremonyPhoto[], description: string, caption: string, selection: VisionTwoUpSelection,
    photoCaptions?: Readonly<Record<string, string>>, arrivingPhotoKey?: string) => {
    const assets = await Promise.all(photos.map(uploadOne));
    return props.onAssemble({ description: photoVisionDescription(description.trim(), props.anchorIntention),
      arrivingAssetId: assets[photos.findIndex(photo => photo.key === arrivingPhotoKey)]?.assetId,
      selectedAssets: assets.map((asset, i) => ({ ...asset, caption: photoCaptions ? photoCaptions[photos[i].key] : i === 0 ? caption : undefined })), selection });
  };

  return { generation, starting, notice, setNotice, generate, pickImages, saveUploads, prepareUploads, uploadingCount };
}
