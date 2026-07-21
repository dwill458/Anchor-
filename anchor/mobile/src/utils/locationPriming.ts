import * as Location from 'expo-location';
import {
  legacyAudioModeToSessionAudioDefaults,
  normalizeSessionAudioDefaults,
  type LegacySessionAudioMode,
  type SessionAudioDefaults,
} from '@/types/sessionAudio';

export type LocationPrimingSessionType = 'focus' | 'prime';
export type LocationPrimingAudioMode = LegacySessionAudioMode;

export interface LocationPrimingPreset {
  sessionType: LocationPrimingSessionType;
  durationSeconds: number;
  audioConfiguration: SessionAudioDefaults;
  /** Read only by the idempotent v1 → v2 migration. */
  audioMode?: LocationPrimingAudioMode;
}

export interface LocationPrimingZone {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  preset: LocationPrimingPreset;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationPrimingDeviceLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
}

export interface LocationPrimingSuggestion {
  zone: LocationPrimingZone;
  distanceMeters: number;
}

export const LOCATION_PRIMING_MIN_RADIUS_METERS = 150;
export const LOCATION_PRIMING_MAX_RADIUS_METERS = 5000;
export const LOCATION_PRIMING_MAX_ACCURACY_METERS = 250;
export const LOCATION_PRIMING_LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const EARTH_RADIUS_METERS = 6371000;

export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function clampLocationPrimingRadius(value: number): number {
  if (!Number.isFinite(value)) {
    return LOCATION_PRIMING_MIN_RADIUS_METERS;
  }

  return Math.min(
    LOCATION_PRIMING_MAX_RADIUS_METERS,
    Math.max(LOCATION_PRIMING_MIN_RADIUS_METERS, Math.round(value))
  );
}

export function normalizeLocationPrimingPreset(
  preset: LocationPrimingPreset
): LocationPrimingPreset {
  const sessionType: LocationPrimingSessionType =
    preset.sessionType === 'prime' ? 'prime' : 'focus';
  const legacyAudioMode: LocationPrimingAudioMode =
    preset.audioMode === 'silent' ? 'silent' : 'ambient';
  const audioConfiguration = normalizeSessionAudioDefaults(
    preset.audioConfiguration,
    legacyAudioModeToSessionAudioDefaults(legacyAudioMode)
  );
  const rawDuration = Number.isFinite(preset.durationSeconds)
    ? Math.round(preset.durationSeconds)
    : sessionType === 'prime'
      ? 120
      : 30;

  return {
    sessionType,
    durationSeconds:
      sessionType === 'prime'
        ? Math.min(7200, Math.max(120, rawDuration))
        : Math.min(120, Math.max(10, rawDuration)),
    audioConfiguration,
  };
}

export function distanceMeters(
  from: Pick<LocationPrimingDeviceLocation, 'latitude' | 'longitude'>,
  to: Pick<LocationPrimingDeviceLocation, 'latitude' | 'longitude'>
): number {
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchLocationPrimingZone(
  location: LocationPrimingDeviceLocation | null,
  zones: LocationPrimingZone[]
): LocationPrimingSuggestion | null {
  if (
    !location ||
    (location.accuracyMeters != null &&
      location.accuracyMeters > LOCATION_PRIMING_MAX_ACCURACY_METERS)
  ) {
    return null;
  }

  const matches = zones
    .filter((zone) => zone.enabled)
    .map((zone) => ({
      zone,
      distanceMeters: distanceMeters(location, zone),
    }))
    .filter((match) => match.distanceMeters <= match.zone.radiusMeters)
    .sort((left, right) => {
      const distanceDelta = left.distanceMeters - right.distanceMeters;
      if (Math.abs(distanceDelta) > 0.001) {
        return distanceDelta;
      }

      return (
        new Date(right.zone.updatedAt).getTime() -
        new Date(left.zone.updatedAt).getTime()
      );
    });

  return matches[0] ?? null;
}

export async function getForegroundLocationForPriming(): Promise<LocationPrimingDeviceLocation | null> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return null;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return null;
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: LOCATION_PRIMING_LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy: LOCATION_PRIMING_MAX_ACCURACY_METERS,
  });
  const current =
    lastKnown ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }));
  const accuracy = current.coords.accuracy;

  if (accuracy != null && accuracy > LOCATION_PRIMING_MAX_ACCURACY_METERS) {
    return null;
  }

  return {
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
    accuracyMeters: accuracy,
  };
}

export async function requestCurrentLocationForPriming(): Promise<LocationPrimingDeviceLocation | null> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return null;
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return null;
  }

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const accuracy = current.coords.accuracy;

  if (accuracy != null && accuracy > LOCATION_PRIMING_MAX_ACCURACY_METERS) {
    return null;
  }

  return {
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
    accuracyMeters: accuracy,
  };
}
