/** Temporary, dev-only probes for the Anchor mobile performance diagnosis. */
const startedAt = Date.now();
const renderCounts = new Map<string, number>();

function emit(event: string, data: Record<string, unknown> = {}): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.warn('[PERF]', JSON.stringify({ event, t: Date.now() - startedAt, ...data }));
}

export function perfLog(event: string, data: Record<string, unknown> = {}): void {
  emit(event, data);
}

export function countPerfRender(component: string): void {
  if (!__DEV__) return;
  renderCounts.set(component, (renderCounts.get(component) ?? 0) + 1);
}

export function startPerfRenderReporter(intervalMs = 5000): () => void {
  if (!__DEV__) return () => undefined;
  const timer = setInterval(() => {
    emit('render-counts', Object.fromEntries(renderCounts));
    renderCounts.clear();
  }, intervalMs);
  return () => clearInterval(timer);
}

export function startJsStallDetector(getRoute: () => string | undefined): () => void {
  if (!__DEV__) return () => undefined;
  let previous = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const gapMs = now - previous;
    previous = now;
    if (gapMs > 50) emit('js-stall', { gapMs, route: getRoute() ?? 'unknown' });
  }, 16);
  return () => clearInterval(timer);
}

export function classifyPerfUri(uri?: string | null): 'remote' | 'file' | 'data' | 'other' | 'none' {
  if (!uri) return 'none';
  if (/^https?:\/\//i.test(uri)) return 'remote';
  if (/^file:/i.test(uri)) return 'file';
  if (/^data:/i.test(uri)) return 'data';
  return 'other';
}

export function logAnchorBlob(context: string, anchors: Array<{ enhancedImageUrl?: string | null }>): void {
  if (!__DEV__) return;
  const started = Date.now();
  let payloadLength = 0;
  try {
    payloadLength = JSON.stringify(anchors).length;
  } catch {
    payloadLength = -1;
  }
  emit('anchor-blob', {
    context,
    anchors: anchors.length,
    enhancedImageUrlCount: anchors.filter((anchor) => Boolean(anchor.enhancedImageUrl)).length,
    jsonChars: payloadLength,
    stringifyMs: Date.now() - started,
  });
}
