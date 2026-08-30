/**
 * InfoSheet — thin wrapper over the registry-driven MicroTeachBottomSheet.
 * Retained for rollback compatibility; copy now lives in the teaching
 * registry (the three practice modes) instead of being hardcoded here.
 */
import React from 'react';
import { MicroTeachBottomSheet } from '@/components/teaching';

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

const MODE_IDS = ['mode_prime_v1', 'mode_stabilize_v1', 'mode_release_v1'];

export const InfoSheet: React.FC<InfoSheetProps> = ({ visible, onClose }) => (
  <MicroTeachBottomSheet
    visible={visible}
    onClose={onClose}
    teachingIds={MODE_IDS}
    title="How the three modes work"
  />
);
