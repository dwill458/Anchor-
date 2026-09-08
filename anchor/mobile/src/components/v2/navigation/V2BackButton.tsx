import React from 'react';
import { ArrowLeft } from 'lucide-react-native';
import { colors } from '@/theme/v2';
import { V2IconButton } from '../primitives/V2IconButton';
export function V2BackButton({ onPress, label = 'Go back' }: { onPress?: () => void; label?: string }) { return <V2IconButton icon={<ArrowLeft size={22} color={colors.text.primary} />} accessibilityLabel={label} onPress={onPress} />; }
