import * as LocalAuthentication from 'expo-local-authentication';
import { BiometricService } from '../BiometricService';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

describe('BiometricService', () => {
  beforeEach(() => {
    BiometricService.setMockConfig({ enabled: false });
    jest.clearAllMocks();
  });

  it('checks hardware availability', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);

    await expect(BiometricService.hasHardware()).resolves.toBe(true);
  });

  it('returns supported authentication types', async () => {
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);

    const types = await BiometricService.getSupportedTypes();

    expect(types).toEqual(['fingerprint', 'facial_recognition']);
  });

  it('authenticates successfully when local auth succeeds', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    await expect(BiometricService.authenticate('Unlock')).resolves.toBe(true);
  });

  it('uses mock configuration when enabled', async () => {
    BiometricService.setMockConfig({
      enabled: true,
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: ['iris'],
      authenticateResult: false,
    });

    await expect(BiometricService.hasHardware()).resolves.toBe(false);
    await expect(BiometricService.isEnrolled()).resolves.toBe(false);
    await expect(BiometricService.getSupportedTypes()).resolves.toEqual(['iris']);
    await expect(BiometricService.authenticate('Test')).resolves.toBe(false);
  });
});
