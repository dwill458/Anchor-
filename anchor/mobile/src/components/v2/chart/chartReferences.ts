import { apiClient } from '@/services/ApiClient';
import { visionApiData } from '@/hooks/v2/vision/visionApi';
import { uploadVisionPhoto } from '@/hooks/v2/vision/visionPhotoInput';
import type { ChartReferenceWire } from '@/services/v2/chartV2Api';

/**
 * References a person attaches while telling Chart where they are starting.
 * Photos reuse the Vision upload path (POST /api/v2/assets/upload) and travel to the planner by asset id.
 * Places and documents are text only. Documents are used for one request and are never stored by Chart.
 */
export type ChartPhotoReference = {
  kind: 'photo';
  id: string;
  uri: string;
  mimeType: string;
  /** 'start' = the photo of where they are now (the context step). */
  role: 'start' | 'extra';
  /** Set after the first successful upload, so a retried plan never uploads twice. */
  assetId?: string;
};
export type ChartPlaceReference = { kind: 'place'; id: string; label: string; latitude?: number; longitude?: number };
export type ChartDocumentReference = { kind: 'document'; id: string; name: string; text: string };
export type ChartReference = ChartPhotoReference | ChartPlaceReference | ChartDocumentReference;

export const MAX_CHART_REFERENCES = 4;
export const MAX_DOCUMENT_CHARS = 6000;

let counter = 0;
export function referenceId(): string {
  counter += 1;
  return `ref-${Date.now().toString(36)}-${counter}`;
}

type UploadResponse = { id: string };

async function uploadAsset(input: { base64Image: string; mimeType: string }) {
  try {
    const response = await apiClient.post<UploadResponse>('/api/v2/assets/upload', input);
    const asset = visionApiData<UploadResponse | null>(response);
    if (!asset?.id) return { ok: false as const, message: 'Image upload failed' };
    return {
      ok: true as const,
      asset: { id: asset.id, resolvedUrl: null, mimeType: input.mimeType, fileSizeBytes: null, createdAt: '' },
    };
  } catch (cause) {
    return { ok: false as const, message: cause instanceof Error ? cause.message : 'Image upload failed' };
  }
}

export type PreparedReferences =
  | { ok: true; wire: ChartReferenceWire[]; uploaded: Record<string, string> }
  | { ok: false; message: string };

/**
 * Uploads any photo that is not yet an asset and returns the wire form. `uploaded` maps reference id -> asset id
 * so the caller can remember it. Stops at the first failed upload: a photo the person chose should not silently vanish.
 */
export async function prepareReferences(references: ChartReference[]): Promise<PreparedReferences> {
  const wire: ChartReferenceWire[] = [];
  const uploaded: Record<string, string> = {};
  for (const reference of references) {
    if (reference.kind === 'photo') {
      let assetId = reference.assetId;
      if (!assetId) {
        const result = await uploadVisionPhoto({ uri: reference.uri, mimeType: reference.mimeType }, uploadAsset);
        if (!result.ok) return { ok: false, message: result.message };
        assetId = result.assetId;
        uploaded[reference.id] = assetId;
      }
      wire.push({ kind: 'photo', assetId, role: reference.role });
    } else if (reference.kind === 'place') {
      wire.push({
        kind: 'place',
        label: reference.label,
        ...(reference.latitude !== undefined && reference.longitude !== undefined
          ? { latitude: reference.latitude, longitude: reference.longitude }
          : {}),
      });
    } else {
      wire.push({ kind: 'document', name: reference.name, text: reference.text.slice(0, MAX_DOCUMENT_CHARS) });
    }
  }
  return { ok: true, wire, uploaded };
}

/** Applies upload results to state without mutating it. */
export function withUploaded(references: ChartReference[], uploaded: Record<string, string>): ChartReference[] {
  if (!Object.keys(uploaded).length) return references;
  return references.map((reference) =>
    reference.kind === 'photo' && uploaded[reference.id] ? { ...reference, assetId: uploaded[reference.id] } : reference
  );
}
