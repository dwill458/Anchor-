import { useCallback, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { visionApiData } from './visionApi';

export type VisionAppearanceReference = {
  id: string;
  source: 'PROFILE' | 'CUSTOM';
  previewUrl: string | null;
  expiresAt: string | null;
};

/** Counts and outcomes only: never the image, a URI, or a signed URL. */
const traceReference = (event: string, detail?: unknown) => {
  if (__DEV__ && !process.env.JEST_WORKER_ID) console.log(`[VisionReference] ${event}`, detail ?? '');
};

/** The type the bytes really are, preferring what the picker reported over the file extension. */
export function referenceMimeType(uri: string, picked?: string | null): 'image/png' | 'image/webp' | 'image/jpeg' {
  const declared = picked?.toLowerCase();
  if (declared === 'image/png' || declared === 'image/webp' || declared === 'image/jpeg') return declared;
  const path = uri.split('?')[0].toLowerCase();
  return path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
}

/** Says what actually went wrong; "choose a clear photo of one person" is only true for one of the causes. */
export function referenceFailureMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    if (cause.code === 'UNSUITABLE_VISION_REFERENCE') return cause.message || 'Choose a clear, close photo of one person.';
    if (cause.status === 413) return 'That photo is too large to use. Try a smaller one.';
    if (cause.code === 'INVALID_VISION_REFERENCE' || cause.status === 400) return 'That photo format could not be used. Choose a JPEG, PNG or WebP photo.';
    if (cause.status === 429) return 'Too many photos in a short time. Try again in a moment.';
    if (cause.status === 401 || cause.status === 403) return 'Sign in again to add a reference photo.';
  }
  return 'The photo could not be uploaded. Check your connection and try again.';
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `profile-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

let cachedReference: VisionAppearanceReference | null = null;
let lastFetchTime = 0;

/** Explicit, private appearance-reference state for the Vision creation flow. */
export function useVisionAppearanceReference() {
  const profilePhoto = useProfileStore(state => state.photo);
  const storedPreference = useAuthStore(state => Boolean(state.profileData?.user.settings?.useProfilePhotoForVision));
  const [reference, setReference] = useState<VisionAppearanceReference | null>(cachedReference);
  const [loading, setLoading] = useState(cachedReference === null);
  const [saving, setSaving] = useState(false);
  const [enabledByPreference, setEnabledByPreference] = useState(storedPreference);

  useEffect(() => { setEnabledByPreference(storedPreference); }, [storedPreference]);

  const refresh = useCallback(async () => {
    if (Date.now() - lastFetchTime < 60000 && cachedReference) {
      setReference(cachedReference);
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get<VisionAppearanceReference | null>('/api/v2/vision/appearance-reference');
      const data = visionApiData<VisionAppearanceReference | null>(response);
      cachedReference = data;
      lastFetchTime = Date.now();
      setReference(data);
    } catch {
      setReference(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const [lastError, setLastError] = useState<string | null>(null);

  const upload = useCallback(async (uri: string, source: 'PROFILE' | 'CUSTOM', pickedMimeType?: string | null, onError?: (message: string) => void): Promise<VisionAppearanceReference | null> => {
    setSaving(true);
    setLastError(null);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = referenceMimeType(uri, pickedMimeType);
      traceReference('selected', { source, approxKb: Math.round(base64.length * 0.75 / 1024), mimeType });
      const response = await apiClient.post<VisionAppearanceReference>('/api/v2/vision/appearance-reference', {
        base64Image: `data:${mimeType};base64,${base64}`, mimeType, source,
        ...(source === 'PROFILE' ? { profileFingerprint: fingerprint(uri) } : {}),
      });
      const next = visionApiData<VisionAppearanceReference>(response);
      traceReference('uploaded', { referenceId: next.id });
      cachedReference = next;
      lastFetchTime = Date.now();
      setReference(next);
      return next;
    } catch (cause) {
      const message = referenceFailureMessage(cause);
      traceReference('failed', { message, status: cause instanceof ApiClientError ? cause.status : undefined, code: cause instanceof ApiClientError ? cause.code : undefined });
      setLastError(message);
      onError?.(message);
      return null;
    } finally { setSaving(false); }
  }, []);

  const remove = useCallback(async () => {
    if (!reference) return true;
    try {
      await apiClient.delete(`/api/v2/vision/appearance-reference/${encodeURIComponent(reference.id)}`);
      cachedReference = null;
      setReference(null);
      return true;
    } catch { return false; }
  }, [reference]);

  const setProfilePreference = useCallback(async (value: boolean) => {
    if (!profilePhoto && value) return false;
    try {
      await apiClient.put('/api/auth/settings', { useProfilePhotoForVision: value });
      // Every opt-in sends the current profile file through the private
      // reference path. This makes a profile-photo change require renewed
      // consent instead of silently retaining a likeness from an old photo.
      if (value && profilePhoto) {
        const saved = Boolean(await upload(profilePhoto, 'PROFILE'));
        setEnabledByPreference(saved);
        return saved;
      }
      setEnabledByPreference(value);
      return true;
    } catch { return false; }
  }, [profilePhoto, upload]);

  return useMemo(() => ({ profilePhoto, enabledByPreference, reference, loading, saving, lastError, upload, remove, setProfilePreference }),
    [enabledByPreference, lastError, loading, profilePhoto, reference, remove, saving, setProfilePreference, upload]);
}
