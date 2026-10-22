describe('config google auth defaults', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to bundled google client ids when env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

    jest.isolateModules(() => {
      const config = require('../index');

      expect(config.GOOGLE_WEB_CLIENT_ID).toBe(
        '930118716037-lvbff0r43v9rqo61drvpcr8ih499fu6l.apps.googleusercontent.com'
      );
      expect(config.GOOGLE_IOS_CLIENT_ID).toBe(
        '930118716037-g86c5d1kj9a0kio795oai3mnmnf1ejek.apps.googleusercontent.com'
      );
    });
  });

  it('prefers explicit google client id env overrides', () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';

    jest.isolateModules(() => {
      const config = require('../index');

      expect(config.GOOGLE_WEB_CLIENT_ID).toBe('web-client-id');
      expect(config.GOOGLE_IOS_CLIENT_ID).toBe('ios-client-id');
    });
  });

  it('resolves API_URL prioritizing EXPO_PUBLIC_API_URL even in __DEV__', () => {
    (global as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_DEV_API_URL = 'http://127.0.0.1:8000';
    process.env.EXPO_PUBLIC_API_URL = 'https://anchor-production-26bf.up.railway.app';

    jest.isolateModules(() => {
      const config = require('../index');
      expect(config.API_URL).toBe('https://anchor-production-26bf.up.railway.app');
    });
  });

  it('falls back to EXPO_PUBLIC_DEV_API_URL in __DEV__ when EXPO_PUBLIC_API_URL is unset', () => {
    (global as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_DEV_API_URL = 'http://127.0.0.1:8000';
    delete process.env.EXPO_PUBLIC_API_URL;

    jest.isolateModules(() => {
      const config = require('../index');
      expect(config.API_URL).toBe('http://127.0.0.1:8000');
    });
  });

  it('resolves API_URL in production from EXPO_PUBLIC_API_URL', () => {
    (global as any).__DEV__ = false;
    process.env.EXPO_PUBLIC_DEV_API_URL = 'http://127.0.0.1:8000';
    process.env.EXPO_PUBLIC_API_URL = 'https://anchor-production-26bf.up.railway.app';

    jest.isolateModules(() => {
      const config = require('../index');
      expect(config.API_URL).toBe('https://anchor-production-26bf.up.railway.app');
    });
  });
});

