/**
 * Provider-agnostic Image Generation Types
 *
 * Defines the unified interfaces for multi-provider image generation across
 * Anchor artwork and Vision imagery.
 */

export type ImageGenerationPurpose = 'anchor' | 'vision';

export type QualityTier = 'draft' | 'premium' | 'pro_upgrade';

export interface ImageReference {
  buffer: Buffer;
  mimeType: string;
  role?: 'structure' | 'appearance' | 'style';
}

export interface GenerateImageRequest {
  /** The purpose of generation: 'anchor' artwork or 'vision' imagery */
  type: ImageGenerationPurpose;
  /** Primary generation prompt */
  prompt: string;
  /** Optional negative prompt (used where supported) */
  negativePrompt?: string;
  /** Optional reference images (e.g. Anchor structure SVG/PNG or Vision appearance reference) */
  referenceImages?: ImageReference[];
  /** Quality tier requested */
  quality?: QualityTier;
  /** Aspect ratio: '1:1' for Anchor artwork, '9:16' for Vision */
  aspectRatio?: '1:1' | '9:16' | string;
  /** Number of variations requested (default: 1) */
  numberOfVariations?: number;
  /** Explicit dimensions in pixels if known */
  width?: number;
  height?: number;
  /** Unique generation request identifier for distributed tracing and deduplication */
  generationRequestId?: string;
  /** User ID for logging and deterministic A/B testing */
  userId?: string;
  /** Generation attempt number (1 for initial, 2+ for regeneration) */
  generationAttempt?: number;
  /** Category context (e.g. 'career', 'health', 'wealth') */
  category?: string;
  /** Arbitrary domain metadata to attach to telemetry */
  metadata?: Record<string, unknown>;
}

export interface GeneratedImageVariation {
  buffer: Buffer;
  base64?: string;
  mimeType: string;
  seed?: number;
  variationIndex: number;
}

export interface ProviderAttemptRecord {
  attemptNumber: number;
  provider: string;
  model: string;
  startedAt: Date;
  completedAt: Date;
  latencyMs: number;
  success: boolean;
  error?: string;
  failureReason?: string;
}

export interface ImageGenerationResult {
  images: GeneratedImageVariation[];
  provider: string;
  model: string;
  totalTimeSeconds: number;
  costUSD: number;
  attempts: ProviderAttemptRecord[];
  fallbackUsed: boolean;
  sourceProvider?: string;
  generationRequestId: string;
  metadata?: Record<string, unknown>;
}

export enum ImageProviderErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  SAFETY_FILTER = 'SAFETY_FILTER',
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  UNKNOWN = 'UNKNOWN',
}

export class ImageProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly type: ImageProviderErrorType,
    message: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly retryAfterMs?: number
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ImageProviderError';
  }
}

export interface ImageProviderAdapter {
  readonly name: string;
  isAvailable(): boolean;
  generate(
    request: GenerateImageRequest,
    attemptNumber: number
  ): Promise<{
    images: GeneratedImageVariation[];
    model: string;
    estimatedCost: number;
  }>;
}
