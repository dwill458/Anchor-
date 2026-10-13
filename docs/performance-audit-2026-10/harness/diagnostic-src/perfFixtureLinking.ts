import { Linking } from 'react-native';

/** Reads the cold-start URL for the diagnostic fixture allowlist only. */
export function getInitialPerfFixtureUrl(): Promise<string | null> {
  return Linking.getInitialURL();
}
