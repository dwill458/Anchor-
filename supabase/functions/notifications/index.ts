import { handleSyncState } from './sync-state.ts';
import { handleTriggerAll } from './trigger-all.ts';

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/notifications' || normalized === '/') {
    return '/';
  }

  if (normalized.startsWith('/notifications/')) {
    return normalized.slice('/notifications'.length);
  }

  return normalized;
}

Deno.serve((req) => {
  const url = new URL(req.url);
  const pathname = normalizePathname(url.pathname);

  if (pathname === '/sync-state') {
    return handleSyncState(req);
  }

  if (pathname === '/trigger-all') {
    return handleTriggerAll(req);
  }

  return new Response('Not Found', { status: 404 });
});

