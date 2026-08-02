import { resolveGoogleApiKey } from '../env';

/**
 * Production was provisioned with GEMINI_API_KEY while the Visualize scene
 * service read GOOGLE_API_KEY, so the provider was never configured. These
 * cases pin the alias contract.
 */
describe('resolveGoogleApiKey', () => {
  it('uses GOOGLE_API_KEY when present', () => {
    expect(
      resolveGoogleApiKey({ GOOGLE_API_KEY: 'canonical' } as NodeJS.ProcessEnv)
    ).toBe('canonical');
  });

  it('accepts GEMINI_API_KEY when GOOGLE_API_KEY is absent', () => {
    expect(
      resolveGoogleApiKey({ GEMINI_API_KEY: 'alias' } as NodeJS.ProcessEnv)
    ).toBe('alias');
  });

  it('prefers GOOGLE_API_KEY when both are present', () => {
    expect(
      resolveGoogleApiKey({
        GOOGLE_API_KEY: 'canonical',
        GEMINI_API_KEY: 'alias',
      } as NodeJS.ProcessEnv)
    ).toBe('canonical');
  });

  it('returns undefined when neither is set', () => {
    expect(resolveGoogleApiKey({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it('treats a blank or whitespace-only value as unset', () => {
    expect(resolveGoogleApiKey({ GOOGLE_API_KEY: '   ' } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(
      resolveGoogleApiKey({
        GOOGLE_API_KEY: '  ',
        GEMINI_API_KEY: 'alias',
      } as NodeJS.ProcessEnv)
    ).toBe('alias');
  });

  it('trims surrounding whitespace', () => {
    expect(
      resolveGoogleApiKey({ GEMINI_API_KEY: '  alias  ' } as NodeJS.ProcessEnv)
    ).toBe('alias');
  });
});
