import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'lucide-react-native';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { ProfileMono } from '@/stores/profileStore';

export const PROFILE_MARK_SLOTS: ProfileMono[] = [
  'slot_0',
  'slot_1',
  'slot_2',
  'slot_3',
  'slot_4',
  'slot_5',
  'slot_6',
  'slot_7',
];

interface AvatarMarkGlyphProps {
  mono: ProfileMono;
  size: number;
  dimmed?: boolean;
}

function AvatarMarkGlyph({ mono, size, dimmed = false }: AvatarMarkGlyphProps) {
  const slotIndex = Math.max(
    0,
    mono === 'initial' ? 0 : Number.parseInt(mono.replace('slot_', ''), 10) || 0
  );
  const stroke = dimmed ? withAlpha(colors.silver, 0.28) : colors.gold;
  const fill = dimmed ? withAlpha(colors.silver, 0.08) : withAlpha(colors.gold, 0.08);
  const opacity = dimmed ? 0.58 : 0.92;

  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="30" cy="30" r="18" stroke={stroke} strokeWidth="1.2" opacity={opacity * 0.55} />
      {slotIndex % 4 === 0 ? (
        <>
          <Line x1="30" y1="8" x2="30" y2="52" stroke={stroke} strokeWidth="1.3" opacity={opacity} />
          <Line x1="8" y1="30" x2="52" y2="30" stroke={stroke} strokeWidth="1.3" opacity={opacity} />
          <Circle cx="30" cy="30" r="3.6" fill={stroke} opacity={opacity} />
        </>
      ) : null}
      {slotIndex % 4 === 1 ? (
        <>
          <Polygon points="30,9 50,30 30,51 10,30" stroke={stroke} strokeWidth="1.2" fill={fill} opacity={opacity} />
          <Circle cx="30" cy="30" r="4" fill={stroke} opacity={opacity} />
        </>
      ) : null}
      {slotIndex % 4 === 2 ? (
        <>
          <Polygon points="30,11 48,43 12,43" stroke={stroke} strokeWidth="1.2" fill="none" opacity={opacity} />
          <Line x1="30" y1="11" x2="30" y2="43" stroke={stroke} strokeWidth="1.1" opacity={opacity * 0.9} />
          <Circle cx="30" cy="30" r="3" fill={stroke} opacity={opacity} />
        </>
      ) : null}
      {slotIndex % 4 === 3 ? (
        <>
          <Rect
            x="16"
            y="16"
            width="28"
            height="28"
            rx="3"
            stroke={stroke}
            strokeWidth="1.1"
            fill="none"
            opacity={opacity}
            transform="rotate(15 30 30)"
          />
          <Line x1="12" y1="30" x2="48" y2="30" stroke={stroke} strokeWidth="1.1" opacity={opacity * 0.9} />
          <Line x1="30" y1="12" x2="30" y2="48" stroke={stroke} strokeWidth="1.1" opacity={opacity * 0.9} />
          <Path d="M30 22 L34 30 L30 38 L26 30 Z" fill={stroke} opacity={opacity} />
        </>
      ) : null}
    </Svg>
  );
}

interface ProfileAvatarProps {
  size?: number;
  name: string;
  mono: ProfileMono;
  photoUri?: string | null;
  showCameraBadge?: boolean;
  badgeSize?: number;
  onPress?: () => void;
  onBadgePress?: () => void;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  size = 56,
  name,
  mono,
  photoUri,
  showCameraBadge = true,
  badgeSize = 18,
  onPress,
  onBadgePress,
}) => {
  const Wrapper = onPress ? Pressable : View;
  const avatarInnerSize = size * 0.58;
  const initial = name.trim().charAt(0).toUpperCase() || 'P';

  return (
    <Wrapper
      onPress={onPress}
      style={[styles.avatarFrame, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <LinearGradient
        colors={[withAlpha(colors.purple, 0.95), withAlpha(colors.black, 0.98)]}
        start={{ x: 0.25, y: 0.18 }}
        end={{ x: 0.78, y: 1 }}
        style={[
          styles.avatarGradient,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: colors.ritual.border,
            shadowRadius: size * 0.16,
          },
        ]}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        ) : mono === 'initial' ? (
          <Text style={[styles.avatarInitial, { fontSize: size * 0.36 }]}>{initial}</Text>
        ) : (
          <AvatarMarkGlyph mono={mono} size={avatarInnerSize} />
        )}
      </LinearGradient>

      {showCameraBadge ? (
        <Pressable
          onPress={onBadgePress ?? onPress}
          hitSlop={8}
          style={[
            styles.cameraBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              right: size * 0.02,
              bottom: size * 0.02,
            },
          ]}
        >
          <Camera color={colors.gold} size={badgeSize * 0.48} strokeWidth={1.7} />
        </Pressable>
      ) : null}
    </Wrapper>
  );
};

export const ProfileAvatarMarkCell: React.FC<{
  mono: ProfileMono;
  selected: boolean;
  initial: string;
  onPress: () => void;
}> = ({ mono, selected, initial, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.markCell,
      selected ? styles.markCellSelected : styles.markCellIdle,
    ]}
  >
    {mono === 'initial' ? (
      <Text style={styles.markCellInitial}>{initial}</Text>
    ) : (
      <AvatarMarkGlyph mono={mono} size={22} dimmed={!selected} />
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  avatarFrame: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    elevation: 5,
  },
  avatarInitial: {
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.6,
  },
  cameraBadge: {
    position: 'absolute',
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCell: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCellIdle: {
    backgroundColor: withAlpha(colors.white, 0.03),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(colors.gold, 0.15),
  },
  markCellSelected: {
    backgroundColor: withAlpha(colors.gold, 0.11),
    borderWidth: 1,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  markCellInitial: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    color: colors.gold,
  },
});
