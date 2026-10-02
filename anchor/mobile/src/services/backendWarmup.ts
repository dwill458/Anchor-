import { API_URL } from '@/config';

/**
 * Wake the backend before the real request so cold-start latency does not block the styling call.
 * Free; fired when the Intention screen's Continue is tapped, a few seconds earlier than the
 * Refine screen used to fire it.
 */
export function warmUpBackend(): void {
  if (typeof fetch !== 'function') return;
  try {
    void fetch(`${API_URL}/health`).catch(() => {});
  } catch {
    // Best-effort only.
  }
}
