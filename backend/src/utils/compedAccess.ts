function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readCompedEmailSet(): Set<string> {
  const raw = process.env.COMPED_ACCESS_EMAILS;
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeEmail)
  );
}

export function hasCompedAccess(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return readCompedEmailSet().has(normalizeEmail(email));
}
