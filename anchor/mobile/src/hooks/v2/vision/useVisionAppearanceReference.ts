import { useCallback, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient } from '@/services/ApiClient';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { visionApiData } from './visionApi';

export type VisionAppearanceReference = {
  id: string;
  source: 'PROFILE' | 'CUSTOM';
  previewUrl: string | null;
  expiresAt: string | null;
};

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `profile-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Explicit, private appearance-reference state for the Vision creation flow. */
export function useVisionAppearanceReference() {
  const profilePhoto = useProfileStore(state => state.photo);
  const storedPreference = useAuthStore(state => Boolean(state.profileData?.user.settings?.useProfilePhotoForVision));
  const [reference, setReference] = useState<VisionAppearanceReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabledByPreference, setEnabledByPreference] = useState(storedPreference);

  useEffect(() => { setEnabledByPreference(storedPreference); }, [storedPreference]);

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.get<VisionAppearanceReference | null>('/api/v2/vision/appearance-reference');
      setReference(visionApiData<VisionAppearanceReference | null>(response));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = useCallback(async (uri: string, source: 'PROFILE' | 'CUSTOM'): Promise<VisionAppearanceReference | null> => {
    setSaving(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : uri.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      const response = await apiClient.post<VisionAppearanceReference>('/api/v2/vision/appearance-reference', {
        base64Image: `data:${mimeType};base64,${base64}`, mimeType, source,
        ...(source === 'PROFILE' ? { profileFingerprint: fingerprint(uri) } : {}),
      });
      const next = visionApiData<VisionAppearanceReference>(response);
      setReference(next);
      return next;
    } catch { return null; } finally { setSaving(false); }
  }, []);

  const remove = useCallback(async () => {
    if (!reference) return true;
    try {
      await apiClient.delete(`/api/v2/vision/appearance-reference/${encodeURIComponent(reference.id)}`);
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

  return useMemo(() => ({ profilePhoto, enabledByPreference, reference, loading, saving, upload, remove, setProfilePreference }),
    [enabledByPreference, loading, profilePhoto, reference, remove, saving, setProfilePreference, upload]);
}
