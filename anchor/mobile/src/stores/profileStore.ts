import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types';

export const PROFILE_STORAGE_KEY = 'anchor-profile-storage';

export const TIMEZONE_OPTIONS = [
  'UTC−12',
  'UTC−11',
  'UTC−10',
  'UTC−9',
  'UTC−8 (PST)',
  'UTC−7 (MST)',
  'UTC−6 (CST)',
  'UTC−5 (EST)',
  'UTC−4 (AST)',
  'UTC−3',
  'UTC−2',
  'UTC−1',
  'UTC+0 (GMT)',
  'UTC+1 (CET)',
  'UTC+2 (EET)',
  'UTC+3',
  'UTC+4',
  'UTC+5',
  'UTC+5:30 (IST)',
  'UTC+6',
  'UTC+7',
  'UTC+8 (CST)',
  'UTC+9 (JST)',
  'UTC+10 (AEST)',
  'UTC+11',
  'UTC+12',
] as const;

export type ProfileMono = 'initial' | `slot_${number}` | `avatar_${number}`;

export interface StoredProfile {
  ownerUserId: string | null;
  name: string;
  axiom: string;
  timezone: string;
  mono: ProfileMono;
  photo: string | null;
  memberSince: string | null;
}

interface ProfileState extends StoredProfile {
  syncFromUser: (user: User | null) => void;
  updateProfile: (updates: Partial<StoredProfile>) => void;
  resetProfile: () => void;
}

const EMPTY_PROFILE: StoredProfile = {
  ownerUserId: null,
  name: '',
  axiom: '',
  timezone: '',
  mono: 'initial',
  photo: null,
  memberSince: null,
};

function deriveDefaultName(user: User | null): string {
  const displayName = user?.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const emailPrefix = user?.email?.split('@')[0]?.trim();
  if (emailPrefix) {
    return emailPrefix;
  }

  return 'Practitioner';
}

export function detectTimezoneLabel(): string {
  try {
    const date = new Date();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMinutes = -date.getTimezoneOffset();
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    const sign = offsetMinutes >= 0 ? '+' : '−';
    const offset =
      minutes === 0
        ? `${sign}${hours}`
        : `${sign}${hours}:${String(minutes).padStart(2, '0')}`;

    return `UTC${offset}${zone ? ` · ${zone}` : ''}`;
  } catch {
    return 'UTC+0 (GMT)';
  }
}

function buildProfileFromUser(user: User | null): StoredProfile {
  return {
    ownerUserId: user?.id ?? null,
    name: deriveDefaultName(user),
    axiom: '',
    timezone: detectTimezoneLabel(),
    mono: 'initial',
    photo: null,
    memberSince: user?.createdAt ? new Date(user.createdAt).toISOString() : null,
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...EMPTY_PROFILE,

      syncFromUser: (user) =>
        set((state) => {
          if (!user) {
            return EMPTY_PROFILE;
          }

          const defaults = buildProfileFromUser(user);
          if (state.ownerUserId !== user.id) {
            return defaults;
          }

          return {
            ...state,
            ownerUserId: user.id,
            name: state.name || defaults.name,
            timezone: state.timezone || defaults.timezone,
            memberSince: state.memberSince || defaults.memberSince,
          };
        }),

      updateProfile: (updates) =>
        set((state) => ({
          ...state,
          ...updates,
        })),

      resetProfile: () => set(EMPTY_PROFILE),
    }),
    {
      name: PROFILE_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        name: state.name,
        axiom: state.axiom,
        timezone: state.timezone,
        mono: state.mono,
        photo: state.photo,
        memberSince: state.memberSince,
      }),
    }
  )
);
