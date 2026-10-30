import { RequestHandler } from 'express';

const MAX_COLLECTION_ENTRIES = 1024;
const MAX_BODY_NODES = 8192;
const MAX_BODY_DEPTH = 32;

/** Bound work before schema validators can allocate an issue for every bad value. */
export const bodyComplexityGuard: RequestHandler = (req, res, next): void => {
  if (!req.body || typeof req.body !== 'object' || Buffer.isBuffer(req.body)) {
    next();
    return;
  }

  const pending: Array<{ value: unknown; depth: number }> = [{ value: req.body, depth: 0 }];
  let visited = 0;
  const reject = (): void => {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_COMPLEX',
        message: 'Request contains too many nested values.',
      },
    });
  };

  while (pending.length) {
    const { value, depth } = pending.pop()!;
    visited += 1;
    if (visited > MAX_BODY_NODES || depth > MAX_BODY_DEPTH) {
      reject();
      return;
    }
    if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_COLLECTION_ENTRIES) {
        reject();
        return;
      }
      for (const child of value) pending.push({ value: child, depth: depth + 1 });
    } else {
      let entries = 0;
      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        entries += 1;
        if (entries > MAX_COLLECTION_ENTRIES) {
          reject();
          return;
        }
        pending.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 });
      }
    }
    if (visited + pending.length > MAX_BODY_NODES) {
      reject();
      return;
    }
  }
  next();
};
