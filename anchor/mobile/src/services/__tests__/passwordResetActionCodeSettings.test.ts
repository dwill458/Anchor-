describe('password reset action code settings', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/config');
  });

  it('normalizes reset emails before requesting Firebase email actions', () => {
    jest.isolateModules(() => {
      const { normalizePasswordResetEmail } = require('../passwordResetActionCodeSettings');

      expect(normalizePasswordResetEmail('  USER@Example.COM  ')).toBe('user@example.com');
    });
  });

  it('does not send action code settings when no continue URL is configured', () => {
    jest.doMock('@/config', () => ({
      ANDROID_PACKAGE_NAME: 'com.anchorintentions.app',
      IOS_BUNDLE_ID: 'com.anchorintentions.app',
      PASSWORD_RESET_CONTINUE_URL: '',
      PASSWORD_RESET_LINK_DOMAIN: '',
    }));

    jest.isolateModules(() => {
      const { buildPasswordResetActionCodeSettings } = require('../passwordResetActionCodeSettings');

      expect(buildPasswordResetActionCodeSettings()).toBeUndefined();
    });
  });

  it('builds Firebase mobile action settings when a continue URL is configured', () => {
    jest.doMock('@/config', () => ({
      ANDROID_PACKAGE_NAME: 'com.anchorintentions.app',
      IOS_BUNDLE_ID: 'com.anchorintentions.app',
      PASSWORD_RESET_CONTINUE_URL: 'https://anchor.example/reset-complete',
      PASSWORD_RESET_LINK_DOMAIN: 'auth.anchor.example',
    }));

    jest.isolateModules(() => {
      const { buildPasswordResetActionCodeSettings } = require('../passwordResetActionCodeSettings');

      expect(buildPasswordResetActionCodeSettings()).toEqual({
        url: 'https://anchor.example/reset-complete',
        handleCodeInApp: false,
        iOS: {
          bundleId: 'com.anchorintentions.app',
        },
        android: {
          packageName: 'com.anchorintentions.app',
          installApp: false,
        },
        linkDomain: 'auth.anchor.example',
      });
    });
  });
});
