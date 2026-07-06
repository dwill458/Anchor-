import * as Location from 'expo-location';
import {
  matchLocationPrimingZone,
  getForegroundLocationForPriming,
  type LocationPrimingZone,
} from '../locationPriming';

const makeZone = (overrides: Partial<LocationPrimingZone> = {}): LocationPrimingZone => ({
  id: overrides.id ?? 'zone-1',
  label: overrides.label ?? 'Studio',
  latitude: overrides.latitude ?? 41.881,
  longitude: overrides.longitude ?? -87.623,
  radiusMeters: overrides.radiusMeters ?? 200,
  preset: overrides.preset ?? {
    sessionType: 'focus',
    durationSeconds: 30,
    audioMode: 'ambient',
  },
  enabled: overrides.enabled ?? true,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
});

describe('location priming resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the closest enabled zone inside radius', () => {
    const suggestion = matchLocationPrimingZone(
      { latitude: 41.881, longitude: -87.623, accuracyMeters: 20 },
      [
        makeZone({ id: 'far', latitude: 41.882, longitude: -87.623, radiusMeters: 300 }),
        makeZone({ id: 'near', latitude: 41.881, longitude: -87.623, radiusMeters: 300 }),
      ]
    );

    expect(suggestion?.zone.id).toBe('near');
  });

  it('returns null outside radius and ignores disabled zones', () => {
    expect(
      matchLocationPrimingZone(
        { latitude: 41.881, longitude: -87.623, accuracyMeters: 20 },
        [
          makeZone({ id: 'disabled', enabled: false, radiusMeters: 1000 }),
          makeZone({ id: 'outside', latitude: 42.1, longitude: -87.623, radiusMeters: 150 }),
        ]
      )
    ).toBeNull();
  });

  it('uses most recently updated zone as a tie-breaker', () => {
    const suggestion = matchLocationPrimingZone(
      { latitude: 41.881, longitude: -87.623, accuracyMeters: 20 },
      [
        makeZone({ id: 'older', updatedAt: '2026-01-01T00:00:00.000Z' }),
        makeZone({ id: 'newer', updatedAt: '2026-02-01T00:00:00.000Z' }),
      ]
    );

    expect(suggestion?.zone.id).toBe('newer');
  });

  it('returns null for poor accuracy', () => {
    expect(
      matchLocationPrimingZone(
        { latitude: 41.881, longitude: -87.623, accuracyMeters: 400 },
        [makeZone()]
      )
    ).toBeNull();
  });

  it('returns null when foreground permission is denied', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as any);

    await expect(getForegroundLocationForPriming()).resolves.toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('returns null when location services are unavailable', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);

    await expect(getForegroundLocationForPriming()).resolves.toBeNull();
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
