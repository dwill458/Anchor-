import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackupRecoverySubscreen } from '../BackupRecoverySubscreen';
import * as backupRuntime from '@/storage/backup/backupRuntime';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

jest.mock('@/storage/backup/backupRuntime', () => ({
  createBackup: jest.fn(),
  restoreBackup: jest.fn(),
}));

jest.mock('@/storage/backup/lastBackup', () => ({
  formatLastBackup: (at: string | null) => at ? 'Oct 27, 2026, 6:00 PM' : 'Never. Back up now to protect your data.',
  recordBackupSaved: jest.fn(() => Promise.resolve()),
  useLastBackupAt: jest.fn(() => null),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

describe('BackupRecoverySubscreen', () => {
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial state with Back up now and Restore options', () => {
    render(<BackupRecoverySubscreen onBack={onBack} />);

    expect(screen.getByText('Back up your Anchors')).toBeTruthy();
    expect(screen.getByText('Never. Back up now to protect your data.')).toBeTruthy();
    expect(screen.getByTestId('backup-start')).toBeTruthy();
    expect(screen.getByTestId('backup-choose-file')).toBeTruthy();
    expect(screen.getByTestId('backup-key-input')).toBeTruthy();
    expect(screen.getByTestId('backup-paste')).toBeTruthy();
    expect(screen.getByTestId('backup-restore')).toBeTruthy();
  });

  it('shows recovery key when backup completes successfully', async () => {
    const mockBackup = {
      ok: true as const,
      archive: new Uint8Array([1, 2, 3]),
      recoverySecret: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ01-2345-6789-ABCD-EFGH-IJKL-MNOP-QRST',
      status: 'complete' as const,
      summary: { documentCount: 5, recordCount: 12, recoveryCount: 0, digest: 'dig1' },
      coverage: { registryVersion: 1, included: [], excluded: [], unresolved: [] },
    };
    (backupRuntime.createBackup as jest.Mock).mockResolvedValueOnce(mockBackup);

    render(<BackupRecoverySubscreen onBack={onBack} />);
    fireEvent.press(screen.getByTestId('backup-start'));

    await waitFor(() => {
      expect(screen.getByTestId('backup-recovery-key')).toBeTruthy();
    });

    expect(screen.getByText(mockBackup.recoverySecret)).toBeTruthy();
    expect(screen.getByTestId('backup-confirm-key')).toBeTruthy();
    expect(screen.getByText('I have saved my recovery key')).toBeTruthy();
  });

  it('displays unresolved items and allows backing up anyway', async () => {
    const unresolvedResult = {
      ok: false as const,
      code: 'UNRESOLVED_NAMESPACES' as const,
      coverage: {
        registryVersion: 1,
        included: [],
        excluded: [],
        unresolved: [{ name: 'custom-unresolved-key', store: 'plain' as const, reason: 'unknown namespace' }],
      },
    };
    const successResult = {
      ok: true as const,
      archive: new Uint8Array([1, 2, 3]),
      recoverySecret: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ01-2345-6789-ABCD-EFGH-IJKL-MNOP-QRST',
      status: 'incomplete-acknowledged' as const,
      summary: { documentCount: 4, recordCount: 10, recoveryCount: 0, digest: 'dig2' },
      coverage: unresolvedResult.coverage,
    };

    (backupRuntime.createBackup as jest.Mock)
      .mockResolvedValueOnce(unresolvedResult)
      .mockResolvedValueOnce(successResult);

    render(<BackupRecoverySubscreen onBack={onBack} />);
    fireEvent.press(screen.getByTestId('backup-start'));

    await waitFor(() => {
      expect(screen.getByTestId('backup-status')).toBeTruthy();
      expect(screen.getByTestId('backup-start-acknowledged')).toBeTruthy();
    });

    expect(screen.getAllByText(/custom-unresolved-key/).length).toBeGreaterThanOrEqual(1);

    // Now user clicks "Back up anyway"
    fireEvent.press(screen.getByTestId('backup-start-acknowledged'));

    await waitFor(() => {
      expect(screen.getByTestId('backup-recovery-key')).toBeTruthy();
    });

    expect(backupRuntime.createBackup).toHaveBeenCalledWith({ acknowledgeUnresolved: true });
  });

  it('exports backup via system share sheet when key is confirmed', async () => {
    const mockBackup = {
      ok: true as const,
      archive: new Uint8Array([65, 66, 67]),
      recoverySecret: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ01-2345-6789-ABCD-EFGH-IJKL-MNOP-QRST',
      status: 'complete' as const,
      summary: { documentCount: 5, recordCount: 12, recoveryCount: 0, digest: 'dig1' },
      coverage: { registryVersion: 1, included: [], excluded: [], unresolved: [] },
    };
    (backupRuntime.createBackup as jest.Mock).mockResolvedValueOnce(mockBackup);
    (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('QUJD'); // base64 of [65, 66, 67]

    render(<BackupRecoverySubscreen onBack={onBack} />);
    fireEvent.press(screen.getByTestId('backup-start'));

    await waitFor(() => {
      expect(screen.getByTestId('backup-confirm-key')).toBeTruthy();
    });

    // Confirm key
    fireEvent.press(screen.getByTestId('backup-confirm-key'));
    await waitFor(() => {
      expect(screen.getByText('Key saved — save encrypted backup')).toBeTruthy();
    });

    // Export backup
    fireEvent.press(screen.getByTestId('backup-confirm-key'));

    await waitFor(() => {
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });
  });

  it('handles restore flow with file picking and recovery key', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///backup.anchorbackup', name: 'Anchor-backup.anchorbackup' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('QUJD');
    (backupRuntime.restoreBackup as jest.Mock).mockResolvedValueOnce({
      status: 'complete',
      records: 15,
      documents: 5,
    });

    render(<BackupRecoverySubscreen onBack={onBack} />);

    // Pick file
    fireEvent.press(screen.getByTestId('backup-choose-file'));
    await waitFor(() => {
      expect(screen.getByText('Anchor-backup.anchorbackup')).toBeTruthy();
    });

    // Enter key
    fireEvent.changeText(screen.getByTestId('backup-key-input'), 'ABCD-EFGH');

    // Press restore
    fireEvent.press(screen.getByTestId('backup-restore'));

    await waitFor(() => {
      expect(screen.getByTestId('restore-status')).toBeTruthy();
    });

    expect(screen.getByText(/15 records restored/)).toBeTruthy();
  });
});
