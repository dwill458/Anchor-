/**
 * Anchor App - Biometric Service
 *
 * Provides biometric availability checks and authentication helpers.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { ServiceError } from './ServiceErrors';

export type SupportedBiometricType =
  | 'fingerprint'
  | 'facial_recognition'
  | 'iris'
  | 'unknown';

export interface BiometricMockConfig {
  enabled: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: SupportedBiometricType[];
  authenticateResult: boolean;
}

const DEFAULT_MOCK_CONFIG: BiometricMockConfig = {
  enabled: false,
  hasHardware: true,
  isEnrolled: true,
  supportedTypes: ['fingerprint'],
  authenticateResult: true,
};

const mapAuthenticationType = (type: number): SupportedBiometricType => {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return 'fingerprint';
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return 'facial_recognition';
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'iris';
    default:
      return 'unknown';
  }
};

/**
 * Biometric Service
 *
 * Usage:
 * ```typescript
 * import { BiometricService } from '@/services/BiometricService';
 *
 * const hasHardware = await BiometricService.hasHardware();
 * const authenticated = await BiometricService.authenticate('Unlock your vault');
 * ```
 */
export class BiometricService {
  private static mockConfig: BiometricMockConfig = { ...DEFAULT_MOCK_CONFIG };

  /**
   * Configure mock values for tests and previews.
   */
  static setMockConfig(config: Partial<BiometricMockConfig>): void {
    BiometricService.mockConfig = { ...BiometricService.mockConfig, ...config };
  }

  /**
   * Check if biometric hardware is available on the device.
   */
  static async hasHardware(): Promise<boolean> {
    if (BiometricService.mockConfig.enabled) {
      return BiometricService.mockConfig.hasHardware;
    }

    try {
      return await LocalAuthentication.hasHardwareAsync();
    } catch (error) {
      throw new ServiceError(
        'biometric/hardware-check-failed',
        'Failed to check biometric hardware availability.',
        error
      );
    }
  }

  /**
   * Check if the user has biometric credentials enrolled.
   */
  static async isEnrolled(): Promise<boolean> {
    if (BiometricService.mockConfig.enabled) {
      return BiometricService.mockConfig.isEnrolled;
    }

    try {
      return await LocalAuthentication.isEnrolledAsync();
    } catch (error) {
      throw new ServiceError(
        'biometric/enrollment-check-failed',
        'Failed to check biometric enrollment status.',
        error
      );
    }
  }

  /**
   * Get the supported biometric authentication types for the device.
   */
  static async getSupportedTypes(): Promise<SupportedBiometricType[]> {
    if (BiometricService.mockConfig.enabled) {
      return [...BiometricService.mockConfig.supportedTypes];
    }

    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.map(mapAuthenticationType);
    } catch (error) {
      throw new ServiceError(
        'biometric/supported-types-failed',
        'Failed to fetch supported biometric types.',
        error
      );
    }
  }

  /**
   * Prompt the user for biometric authentication.
   */
  static async authenticate(reason: string): Promise<boolean> {
    if (BiometricService.mockConfig.enabled) {
      return BiometricService.mockConfig.authenticateResult;
    }

    const hasHardware = await BiometricService.hasHardware();
    if (!hasHardware) {
      throw new ServiceError(
        'biometric/unavailable',
        'Biometric hardware is not available on this device.'
      );
    }

    const isEnrolled = await BiometricService.isEnrolled();
    if (!isEnrolled) {
      throw new ServiceError(
        'biometric/unavailable',
        'No biometric credentials are enrolled on this device.'
      );
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || 'Authenticate to continue',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch (error) {
      throw new ServiceError(
        'biometric/auth-failed',
        'Biometric authentication failed.',
        error
      );
    }
  }
}
