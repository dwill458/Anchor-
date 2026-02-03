import React, { memo, useMemo, useRef } from 'react';
import { Image as ExpoImage, ImageProps } from 'expo-image';
import { Platform } from 'react-native';
import { PerformanceMonitoring, PerformanceTrace } from '@/services/PerformanceMonitoring';

const DEFAULT_FADE_MS = Platform.OS === 'ios' ? 150 : 0;
const DEFAULT_PRIORITY: NonNullable<ImageProps['priority']> = 'normal';

let imageTraceCounter = 0;

const nextImageTraceId = (): number => {
  imageTraceCounter += 1;
  return imageTraceCounter;
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const getSourceUri = (source: ImageProps['source']): string | null => {
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return null;
  if (Array.isArray(source)) return getSourceUri(source[0]);
  if (typeof source === 'object' && 'uri' in source) {
    return typeof source.uri === 'string' ? source.uri : null;
  }
  return null;
};

const getSourceType = (source: ImageProps['source'], uri: string | null): string => {
  if (typeof source === 'number') return 'asset';
  if (uri) {
    return uri.startsWith('http') ? 'remote' : 'local';
  }
  return 'unknown';
};

export interface OptimizedImageProps extends ImageProps {
  trackLoad?: boolean;
  perfLabel?: string;
}

export const OptimizedImage = memo(({
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  transition = DEFAULT_FADE_MS,
  priority = DEFAULT_PRIORITY,
  trackLoad = false,
  perfLabel,
  recyclingKey,
  source,
  onLoadStart,
  onLoad,
  onLoadEnd,
  onError,
  ...props
}: OptimizedImageProps) => {
  const resolvedUri = useMemo(() => getSourceUri(source), [source]);
  const resolvedRecyclingKey = useMemo(() => {
    if (recyclingKey) return recyclingKey;
    return resolvedUri ? `img-${hashString(resolvedUri)}` : undefined;
  }, [recyclingKey, resolvedUri]);
  const traceRef = useRef<PerformanceTrace | null>(null);

  const startTrace = () => {
    if (!trackLoad) return;
    traceRef.current?.stop({ aborted: true });
    const trace = PerformanceMonitoring.startTrace(`image_load_${nextImageTraceId()}`, {
      label: perfLabel || (resolvedUri ? resolvedUri.split('?')[0].split('/').pop() : 'image'),
      source_type: getSourceType(source, resolvedUri),
      uri_hash: resolvedUri ? hashString(resolvedUri) : 'none',
      cache_policy: cachePolicy || 'unset',
      priority: priority || DEFAULT_PRIORITY,
    });
    traceRef.current = trace;
  };

  const stopTrace = (metadata?: Record<string, any>) => {
    if (!trackLoad || !traceRef.current) return;
    traceRef.current.stop(metadata);
    traceRef.current = null;
  };

  return (
    <ExpoImage
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
      priority={priority}
      recyclingKey={resolvedRecyclingKey}
      source={source}
      onLoadStart={() => {
        startTrace();
        onLoadStart?.();
      }}
      onLoad={(event) => {
        if (trackLoad && traceRef.current) {
          traceRef.current.putAttribute('cache_type', event.cacheType);
          traceRef.current.putAttribute('width', event.source.width);
          traceRef.current.putAttribute('height', event.source.height);
          if (event.source.mediaType) {
            traceRef.current.putAttribute('media_type', event.source.mediaType);
          }
        }
        onLoad?.(event);
      }}
      onLoadEnd={() => {
        stopTrace({ status: 'success' });
        onLoadEnd?.();
      }}
      onError={(event) => {
        stopTrace({ status: 'error', error: event.error });
        onError?.(event);
      }}
      {...props}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';
