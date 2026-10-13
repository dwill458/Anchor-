import { useEffect, useState } from 'react';

export const REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS = 10_000;

interface RequiredLocalHydrationState {
  anchorsHydrated: boolean;
  firstRunHydrated: boolean;
}

/** Keeps account screens closed if either required persisted store never hydrates. */
export function useRequiredLocalHydrationGuard({
  anchorsHydrated,
  firstRunHydrated,
}: RequiredLocalHydrationState): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (anchorsHydrated) return undefined;

    const timeout = setTimeout(() => setTimedOut(true), REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [anchorsHydrated]);

  useEffect(() => {
    if (firstRunHydrated) return undefined;

    const timeout = setTimeout(() => setTimedOut(true), REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [firstRunHydrated]);

  // A slow successful native read can finish after the recovery surface opens.
  // Keep unresolved storage closed, but do not permanently latch that timeout
  // after both stores have actually restored their data.
  return timedOut && !(anchorsHydrated && firstRunHydrated);
}
