import { post } from '@/services/ApiClient';
import type { ApiResponse } from '@/types';

export interface MerchPreviewRequest {
  anchorId: string;
  sigilSvg?: string;
  productType: 'print' | 'phone-case' | 'desk-mat';
  size?: string;
  color?: string;
}

export interface MerchPreviewData {
  productType: 'print' | 'phone-case' | 'desk-mat';
  size?: string;
  color?: string;
  artworkUrl: string;
  previewUrl: string;
}

export async function requestMerchPreview(
  request: MerchPreviewRequest
): Promise<MerchPreviewData> {
  const response = await post<ApiResponse<MerchPreviewData>>('/api/merch/preview', request);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Unable to load product preview.');
  }

  return response.data;
}
