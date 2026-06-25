import {
  ANDROID_PACKAGE_NAME,
  IOS_BUNDLE_ID,
  PASSWORD_RESET_CONTINUE_URL,
  PASSWORD_RESET_LINK_DOMAIN,
} from '@/config';

export type PasswordResetActionCodeSettings = {
  android: {
    packageName: string;
    installApp: boolean;
  };
  handleCodeInApp: boolean;
  iOS: {
    bundleId: string;
  };
  url: string;
  linkDomain?: string;
};

export function normalizePasswordResetEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildPasswordResetActionCodeSettings():
  | PasswordResetActionCodeSettings
  | undefined {
  if (!PASSWORD_RESET_CONTINUE_URL) {
    return undefined;
  }

  return {
    url: PASSWORD_RESET_CONTINUE_URL,
    handleCodeInApp: false,
    iOS: {
      bundleId: IOS_BUNDLE_ID,
    },
    android: {
      packageName: ANDROID_PACKAGE_NAME,
      installApp: false,
    },
    ...(PASSWORD_RESET_LINK_DOMAIN ? { linkDomain: PASSWORD_RESET_LINK_DOMAIN } : {}),
  };
}
