const APP_STARTED_AT = Date.now();
const MAX_LINES = 500;
const lines: string[] = [];

export function isSfxLogEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_SFX_DEBUG === '0') return false;
  return process.env.EXPO_PUBLIC_SFX_DEBUG === '1' || process.env.NODE_ENV === 'test';
}

export function sfxLog(message: string): void {
  if (!isSfxLogEnabled()) return;
  lines.push(`[SFX] +${Date.now() - APP_STARTED_AT}ms ${message}`);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

export function getSfxLog(): string[] {
  return isSfxLogEnabled() ? lines.slice() : [];
}

export function clearSfxLog(): void {
  if (isSfxLogEnabled()) lines.length = 0;
}
