/**
 * Sentry privacy boundary.
 *
 * Sentry receives diagnostics, never user-authored Chart/Reflection content,
 * provider prompts/results, or request bodies. This module is intentionally
 * dependency-free so the boundary can be tested without starting Express.
 */

const SENSITIVE_SENTRY_KEYS = new Set([
  'description',
  'title',
  'intention',
  'intentiontext',
  'anchorintention',
  'body',
  'structuredcontent',
  'reflection',
  'reflectionbody',
  'whathelped',
  'whatlearned',
  'extractedthemes',
  'themes',
  'theme',
  'skipreason',
  'waypointtitle',
  'waypointdescription',
  'destinationtext',
  'plannerinput',
  'planneroutput',
  'providerprompt',
  'providerresponse',
  'rawresponse',
  'rawrequestbody',
  'requestbody',
  'scene',
  'visualizationscene',
  'navigationcontext',
  'payload',
  'resulttext',
]);

const PRIVATE_TRANSPORT_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'apikey',
  'api-key',
  'password',
  'secret',
  'token',
  'subscriptionid',
  'billingproviderid',
  'rolloutbucket',
  'rollouthash',
  'modelversion',
  'providermodel',
  'providerkeystate',
]);

/** Redact known private keys in objects, nested objects, arrays, and cycles. */
export function scrubSensitiveSentryData<T extends Record<string, unknown> | undefined>(
  value: T
): T {
  if (!value) return value;

  const seen = new WeakSet<object>();
  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    const record = current as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const normalizedKey = key.toLowerCase();
      if (SENSITIVE_SENTRY_KEYS.has(normalizedKey)) {
        try {
          record[key] = '[REDACTED]';
        } catch {
          try {
            Object.defineProperty(record, key, {
              configurable: true,
              enumerable: true,
              value: '[REDACTED]',
              writable: true,
            });
          } catch {
            // A throwing/non-configurable getter has no readable value to send.
          }
        }
        continue;
      }
      if (PRIVATE_TRANSPORT_KEYS.has(normalizedKey)) {
        try {
          delete record[key];
        } catch {
          // A non-configurable credential field is not read or serialized here.
        }
        continue;
      }

      try {
        visit(record[key]);
      } catch {
        // A diagnostic getter must never make the privacy hook fail open.
        try {
          record[key] = '[REDACTED]';
        } catch {
          // If the property cannot be replaced, its throwing getter is unreadable.
        }
      }
    }
  };

  visit(value);
  return value;
}

export function scrubSensitiveString(value: string | undefined): string | undefined {
  if (!value) return value;

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
    .replace(/(token|secret|password|authorization)=[^&\s]+/gi, '$1=[redacted]');
}

/** Apply the complete event-level policy used by the Sentry beforeSend hook. */
export function scrubSentryEvent<T extends object>(event: T): T {
  const candidate = event as Record<string, unknown>;
  const request = candidate.request as Record<string, unknown> | undefined;
  const exception = candidate.exception as Record<string, unknown> | undefined;

  if (candidate.user && typeof candidate.user === 'object') {
    const user = candidate.user as Record<string, unknown>;
    candidate.user = user.id ? { id: user.id } : undefined;
  }

  if (request?.headers && typeof request.headers === 'object') {
    scrubSensitiveSentryData(request.headers as Record<string, unknown>);
  }

  // Request bodies may contain private text under unknown client-defined keys.
  if (request?.data) delete request.data;

  if (typeof request?.query_string === 'string') {
    request.query_string = scrubSensitiveString(request.query_string);
  }

  if (candidate.extra && typeof candidate.extra === 'object') {
    scrubSensitiveSentryData(candidate.extra as Record<string, unknown>);
  }
  // Error messages can contain Zod values, provider output, or user text.
  // Preserve the event/category fields while dropping the freeform string.
  if (candidate.message) candidate.message = '[REDACTED]';

  if (exception?.values && Array.isArray(exception.values)) {
    exception.values = exception.values.map(value => {
      const exceptionValue = value as Record<string, unknown>;
      return { ...exceptionValue, value: '[REDACTED]' };
    });
  }

  return event;
}
