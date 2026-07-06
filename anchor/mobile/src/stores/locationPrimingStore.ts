import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import {
  clampLocationPrimingRadius,
  getForegroundLocationForPriming,
  matchLocationPrimingZone,
  normalizeLocationPrimingPreset,
  requestCurrentLocationForPriming,
  roundCoordinate,
  type LocationPrimingPreset,
  type LocationPrimingSuggestion,
  type LocationPrimingZone,
} from '@/utils/locationPriming';

type ZoneUpdate = Partial<
  Pick<LocationPrimingZone, 'label' | 'radiusMeters' | 'preset' | 'enabled'>
>;

interface LocationPrimingState {
  enabled: boolean;
  zones: LocationPrimingZone[];
  setEnabled: (enabled: boolean) => void;
  addZoneFromCurrentLocation: (params: {
    label: string;
    radiusMeters?: number;
    preset: LocationPrimingPreset;
  }) => Promise<LocationPrimingZone | null>;
  updateZone: (zoneId: string, update: ZoneUpdate) => void;
  deleteZone: (zoneId: string) => void;
  resolveActiveSuggestion: () => Promise<LocationPrimingSuggestion | null>;
}

const DEFAULT_ZONE_LABEL = 'Current place';

function normalizeZone(zone: LocationPrimingZone): LocationPrimingZone {
  const now = new Date().toISOString();
  return {
    ...zone,
    label: zone.label.trim() || DEFAULT_ZONE_LABEL,
    latitude: roundCoordinate(zone.latitude),
    longitude: roundCoordinate(zone.longitude),
    radiusMeters: clampLocationPrimingRadius(zone.radiusMeters),
    preset: normalizeLocationPrimingPreset(zone.preset),
    enabled: zone.enabled !== false,
    createdAt: zone.createdAt || now,
    updatedAt: zone.updatedAt || now,
  };
}

export const useLocationPrimingStore = create<LocationPrimingState>()(
  persist(
    (set, get) => ({
      enabled: false,
      zones: [],

      setEnabled: (enabled) => set({ enabled }),

      addZoneFromCurrentLocation: async ({ label, radiusMeters, preset }) => {
        const location = await requestCurrentLocationForPriming();
        if (!location) {
          return null;
        }

        const now = new Date().toISOString();
        const zone = normalizeZone({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label,
          latitude: location.latitude,
          longitude: location.longitude,
          radiusMeters: radiusMeters ?? 200,
          preset,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });

        set((state) => ({
          enabled: true,
          zones: [zone, ...state.zones],
        }));

        return zone;
      },

      updateZone: (zoneId, update) => {
        set((state) => ({
          zones: state.zones.map((zone) => {
            if (zone.id !== zoneId) {
              return zone;
            }

            return normalizeZone({
              ...zone,
              ...update,
              preset: update.preset
                ? normalizeLocationPrimingPreset(update.preset)
                : zone.preset,
              updatedAt: new Date().toISOString(),
            });
          }),
        }));
      },

      deleteZone: (zoneId) => {
        set((state) => ({
          zones: state.zones.filter((zone) => zone.id !== zoneId),
        }));
      },

      resolveActiveSuggestion: async () => {
        const { enabled, zones } = get();
        if (!enabled || zones.length === 0) {
          return null;
        }

        const location = await getForegroundLocationForPriming();
        return matchLocationPrimingZone(location, zones);
      },
    }),
    {
      name: 'anchor-location-priming-storage',
      storage: createJSONStorage(() => encryptedPersistStorage),
      version: 1,
      migrate: (persistedState: unknown) => {
        const state = (persistedState as Partial<LocationPrimingState>) ?? {};
        return {
          enabled: state.enabled === true,
          zones: Array.isArray(state.zones) ? state.zones.map(normalizeZone) : [],
        } as LocationPrimingState;
      },
      partialize: (state) => ({
        enabled: state.enabled,
        zones: state.zones.map(normalizeZone),
      }),
    }
  )
);

export type { LocationPrimingPreset, LocationPrimingSuggestion, LocationPrimingZone };
