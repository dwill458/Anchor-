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
});
