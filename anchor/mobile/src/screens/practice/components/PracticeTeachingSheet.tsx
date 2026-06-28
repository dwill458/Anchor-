/**
 * PracticeTeachingSheet — thin wrapper over the registry-driven
 * MicroTeachBottomSheet. Copy lives in the teaching registry (the three
 * practice modes) so it stays consistent and terminology-correct.
 */
import React from 'react';
import { MicroTeachBottomSheet } from '@/components/teaching';

interface PracticeTeachingSheetProps {
  visible: boolean;
  onClose: () => void;
}

const MODE_IDS = ['mode_prime_v1', 'mode_stabilize_v1', 'mode_release_v1'];

export const PracticeTeachingSheet: React.FC<PracticeTeachingSheetProps> = ({ visible, onClose }) => (
  <MicroTeachBottomSheet
    visible={visible}
    onClose={onClose}
    teachingIds={MODE_IDS}
    title="How the three modes work"
  />
);
