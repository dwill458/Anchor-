import * as Location from 'expo-location';
import { useLocationPrimingStore } from '../locationPrimingStore';

const resetStore = () => {
  useLocationPrimingStore.setState({
    enabled: false,
    zones: [],
  });
};

describe('locationPrimingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('adds a zone from current foreground location and rounds coordinates', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as any);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: {
        latitude: 41.881912,
        longitude: -87.623177,
        accuracy: 20,
      },
    } as any);

    const zone = await useLocationPrimingStore.getState().addZoneFromCurrentLocation({
      label: 'Studio',
      radiusMeters: 50,
      preset: {
        sessionType: 'focus',
        durationSeconds: 60,
        audioConfiguration: { guidanceVoice: 'none', backgroundAudio: 'off' },
      },
    });

    expect(zone).toMatchObject({
      label: 'Studio',
      latitude: 41.882,
      longitude: -87.623,
      radiusMeters: 150,
      enabled: true,
      preset: {
        sessionType: 'focus',
        durationSeconds: 60,
        audioConfiguration: { guidanceVoice: 'none', backgroundAudio: 'off' },
      },
    });
    expect(useLocationPrimingStore.getState().enabled).toBe(true);
    expect(useLocationPrimingStore.getState().zones).toHaveLength(1);
  });

  it('returns null when adding without permission', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as any);

    await expect(
      useLocationPrimingStore.getState().addZoneFromCurrentLocation({
        label: 'Studio',
        preset: {
          sessionType: 'prime',
          durationSeconds: 300,
          audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
        },
      })
    ).resolves.toBeNull();
    expect(useLocationPrimingStore.getState().zones).toHaveLength(0);
  });

  it('edits and deletes zones', () => {
    const now = new Date().toISOString();
    useLocationPrimingStore.setState({
      enabled: true,
      zones: [
        {
          id: 'zone-1',
          label: 'Studio',
          latitude: 41.882,
          longitude: -87.623,
          radiusMeters: 200,
          preset: {
            sessionType: 'focus',
            durationSeconds: 30,
            audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
          },
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    useLocationPrimingStore.getState().updateZone('zone-1', {
      label: 'Gym',
      preset: {
        sessionType: 'prime',
        durationSeconds: 300,
        audioConfiguration: { guidanceVoice: 'none', backgroundAudio: 'off' },
      },
    });

    expect(useLocationPrimingStore.getState().zones[0]).toMatchObject({
      label: 'Gym',
      preset: {
        sessionType: 'prime',
        durationSeconds: 300,
        audioConfiguration: { guidanceVoice: 'none', backgroundAudio: 'off' },
      },
    });

    useLocationPrimingStore.getState().deleteZone('zone-1');
    expect(useLocationPrimingStore.getState().zones).toHaveLength(0);
  });
});
