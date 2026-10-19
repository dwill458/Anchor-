import Constants from 'expo-constants';

/**
 * The standalone SQLCipher QA preview is deliberately isolated from the production account system:
 * it carries no production Firebase registration, backend address or billing keys. Anything that would
 * authenticate or write a real account is refused here with an explicit message, never a vague network error.
 */
export const isIsolatedSqlCipherPreview = (): boolean =>
  Constants.expoConfig?.extra?.sqlCipherPreview === true;

export const ISOLATED_PREVIEW_AUTH_MESSAGE =
  'This SQLCipher Preview is isolated from your production account, so sign-in is turned off. ' +
  'Continue without an account to test saving and restoring on this device.';
