import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  ActionButton,
  GroupLabel,
  SettingsGroup,
  SettingsNote,
  SettingsScreenFrame,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import { createBackup, restoreBackup } from '@/storage/backup/backupRuntime';
import { bytesToBase64, base64ToBytes } from '@/storage/backup/base64';
import { BackupError } from '@/storage/backup/archiveCrypto';
import { formatLastBackup, recordBackupSaved, useLastBackupAt } from '@/storage/backup/lastBackup';
import { logger } from '@/utils/logger';

const errorMessage = (error: unknown) => {
  if (!(error instanceof BackupError)) return 'Anchor could not safely complete this step. Your current data is unchanged.';
  switch (error.code) {
    case 'SECRET_INVALID': return 'That recovery key has an invalid format. Check the 14 groups and try again.';
    case 'AUTHENTICATION_FAILED': return 'That recovery key does not unlock this backup, or the archive has been changed.';
    case 'TRUNCATED': return 'This backup file appears incomplete.';
    case 'FORMAT': return 'This backup file is corrupted or is not a supported Anchor backup.';
    case 'UNSUPPORTED_VERSION': return 'This backup format is newer than this version of Anchor.';
    case 'AUTHENTICATION_REQUIRED': return 'Sign in to the account that owns this backup before restoring it.';
    case 'INTERRUPTED': return 'Restoration was interrupted before activation. Your active records are unchanged; try again when ready.';
    default: return 'Anchor could not safely complete this step. Your current data is unchanged.';
  }
};

type ClipboardModule = typeof import('expo-clipboard');

/** Clipboard is optional: older dev builds may not include the native module. */
const readClipboardText = async (): Promise<string | null> => {
  if (!requireOptionalNativeModule('ExpoClipboard')) return null;
  try {
    const clipboard = require('expo-clipboard') as ClipboardModule;
    return await clipboard.getStringAsync();
  } catch (error) {
    logger.warn('[BackupRecovery] Clipboard unavailable', error);
    return null;
  }
};

type CreatedBackup = Extract<Awaited<ReturnType<typeof createBackup>>, { ok: true }>;

export function BackupRecoverySubscreen({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<CreatedBackup | null>(null);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [key, setKey] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [status, setStatus] = useState('');
  const lastBackupAt = useLastBackupAt();

  const startBackup = async () => {
    setBusy(true);
    setStatus('Checking local storage and backup coverage…');
    try {
      const result = await createBackup();
      if (!result.ok) {
        const omissions = result.coverage.unresolved.map((item) => item.name).join(', ');
        setStatus(`A complete backup is not available yet. Unresolved local data: ${omissions || 'unknown namespace'}.`);
        return;
      }
      setBackup(result);
      setKeyConfirmed(false);
      setStatus('');
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    if (!backup || !keyConfirmed) return;
    setBusy(true);
    try {
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Save canceled. No backup was reported as saved.');
        return;
      }
      const filename = `Anchor-backup-${new Date().toISOString().slice(0, 10)}.anchorbackup`;
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, 'application/octet-stream');
      const encoded = bytesToBase64(backup.archive);
      await FileSystem.writeAsStringAsync(uri, encoded, { encoding: FileSystem.EncodingType.Base64 });
      const readBack = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (readBack !== encoded) throw new Error('External archive read-back did not match');
      await recordBackupSaved();
      setBackup(null);
      setStatus('Backup saved and verified outside Anchor. Keep your recovery key separate from this file.');
    } catch {
      setStatus('Anchor could not verify the external backup file. It has not reported success.');
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async () => {
    setStatus('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets[0]) return;
      setPickedFile({ uri: picked.assets[0].uri, name: picked.assets[0].name });
    } catch {
      setStatus('Anchor could not open that file. Your current data is unchanged.');
    }
  };

  const pasteKey = async () => {
    const text = await readClipboardText();
    if (text?.trim()) {
      setKey(text.trim());
    } else {
      setStatus('Nothing to paste. Copy your recovery key first, or type it in.');
    }
  };

  const restore = async () => {
    if (!pickedFile) return;
    setBusy(true);
    setStatus('');
    try {
      const archiveBase64 = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.Base64 });
      const result = await restoreBackup({ archive: base64ToBytes(archiveBase64), recoverySecret: key });
      setStatus(
        result.status === 'complete'
          ? `Recovery verified: ${result.records} records restored. Sign in to the same account to access account-owned content.`
          : 'Private records were verified, but some preferences could not be restored yet. Your encrypted archive remains safe; retry recovery to finish.'
      );
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreenFrame title="Backup & recovery" onBack={onBack} testID="backup-recovery-screen">
      <View style={styles.intro}>
        <Text style={styles.heading} accessibilityRole="header">Back up your Anchors</Text>
        <Text style={styles.body}>
          An encrypted backup protects your Anchors, practice progress, drafts and pending work.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusDot, lastBackupAt && styles.statusDotDone]} />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>Last backup</Text>
          <Text style={styles.statusBody}>{formatLastBackup(lastBackupAt)}</Text>
        </View>
      </View>

      {!backup ? (
        <View style={styles.buttonBlock}>
          <ActionButton label="Back up now" onPress={() => void startBackup()} disabled={busy} testID="backup-start" />
        </View>
      ) : (
        <SettingsGroup style={styles.keyCard}>
          <View style={styles.keyBody}>
            <Text style={styles.keyTitle}>Your recovery key</Text>
            <Text style={styles.cardBody}>
              Save this key somewhere private and separate from the backup file. Anchor does not keep a copy.
            </Text>
            <Text selectable style={styles.secret} testID="backup-recovery-key">{backup.recoverySecret}</Text>
            <Text style={styles.meta}>
              {`Generated ${new Date().toLocaleString()} · ${backup.summary.recordCount} records · ${backup.summary.recoveryCount} recovery records · ${backup.coverage.excluded.length} documented omissions`}
            </Text>
            {backup.coverage.excluded.length ? (
              <View style={styles.omissions}>
                <Text style={styles.omissionTitle}>Not included</Text>
                {backup.coverage.excluded.map((item) => (
                  <Text key={`${item.store}:${item.name}`} style={styles.omission}>{item.name} — {item.reason}</Text>
                ))}
              </View>
            ) : null}
            <ActionButton
              label={keyConfirmed ? 'Key saved — save encrypted backup' : 'I have saved my recovery key'}
              onPress={keyConfirmed ? () => void exportBackup() : () => setKeyConfirmed(true)}
              disabled={busy}
              testID="backup-confirm-key"
            />
          </View>
        </SettingsGroup>
      )}

      <View style={styles.keyNotice}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx={8} cy={15} r={4} stroke={cardTheme.gold} strokeWidth={1.8} />
          <Path d="M11 12l9-9M16 7l3 3M14 9l2 2" stroke={cardTheme.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.keyNoticeText}>
          {"You'll get a "}
          <Text style={styles.bold}>recovery key</Text>
          {" with each backup. Save it somewhere safe. It's the only way to unlock the file if you lose this device."}
        </Text>
      </View>

      <GroupLabel>Restore from backup</GroupLabel>
      <SettingsGroup>
        <View style={styles.restoreBody}>
          <View style={styles.step}>
            <Text style={styles.stepTitle}>1. Choose your backup file</Text>
            <ActionButton
              label={pickedFile ? pickedFile.name : 'Choose file'}
              variant="outline"
              compactHeight
              onPress={() => void chooseFile()}
              disabled={busy}
              testID="backup-choose-file"
            />
          </View>
          <View style={styles.step}>
            <Text style={styles.stepTitle}>2. Enter your recovery key</Text>
            <View style={styles.keyRow}>
              <TextInput
                accessibilityLabel="Recovery key"
                value={key}
                onChangeText={setKey}
                autoCapitalize="characters"
                autoCorrect={false}
                secureTextEntry
                placeholder="Recovery key"
                placeholderTextColor={T.ink3}
                style={styles.input}
                testID="backup-key-input"
              />
              <View style={styles.pasteButton}>
                <ActionButton label="Paste" variant="outline" compactHeight onPress={() => void pasteKey()} testID="backup-paste" />
              </View>
            </View>
          </View>
          <ActionButton
            label="Restore"
            onPress={() => void restore()}
            disabled={busy || !pickedFile || !key.trim()}
            testID="backup-restore"
          />
        </View>
      </SettingsGroup>
      <SettingsNote>Account-owned content stays unavailable until you sign in to the matching account.</SettingsNote>

      {busy ? <ActivityIndicator color={T.ink2} style={styles.spinner} /> : null}
      {status ? <Text accessibilityRole="alert" style={styles.status}>{status}</Text> : null}
    </SettingsScreenFrame>
  );
}

const styles = StyleSheet.create({
  intro: { marginHorizontal: 20, marginTop: 16 },
  heading: { fontFamily: settingsTypography.bodyBold, fontSize: 28, lineHeight: 32, color: cardTheme.ink },
  body: { marginTop: 10, fontFamily: settingsTypography.body, fontSize: 16, lineHeight: 22, color: cardTheme.muted },
  cardBody: { marginTop: 4, fontFamily: settingsTypography.body, fontSize: 15, lineHeight: 22, color: cardTheme.muted },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: cardTheme.card,
    borderWidth: 1,
    borderColor: cardTheme.cardBorder,
    borderRadius: 18,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: cardTheme.goldEdge },
  statusDotDone: { backgroundColor: '#287D57' },
  statusText: { flex: 1, gap: 2 },
  statusTitle: { fontFamily: settingsTypography.bodySemiBold, fontSize: 16, color: cardTheme.ink },
  statusBody: { fontFamily: settingsTypography.body, fontSize: 14, color: cardTheme.muted },
  buttonBlock: { marginHorizontal: 16, marginTop: 12 },
  keyCard: { marginTop: 12 },
  keyBody: { padding: 16 },
  keyTitle: { fontFamily: settingsTypography.bodySemiBold, fontSize: 17, color: cardTheme.ink },
  secret: {
    marginTop: 12,
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 16,
    letterSpacing: 0.6,
    lineHeight: 25,
    color: cardTheme.ink,
    backgroundColor: T.surface2,
    borderRadius: 8,
  },
  meta: { marginTop: 10, marginBottom: 14, fontFamily: settingsTypography.body, fontSize: 12, lineHeight: 18, color: T.ink3 },
  omissions: { borderTopWidth: 1, borderColor: cardTheme.cardBorder, paddingTop: 12, marginBottom: 14 },
  omissionTitle: { marginBottom: 6, fontFamily: settingsTypography.bodySemiBold, fontSize: 13, color: cardTheme.muted },
  omission: { marginTop: 4, fontFamily: settingsTypography.body, fontSize: 12, lineHeight: 17, color: T.ink3 },
  keyNotice: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: cardTheme.goldTint,
    borderRadius: 16,
  },
  keyNoticeText: { flex: 1, fontFamily: settingsTypography.body, fontSize: 14, lineHeight: 20, color: cardTheme.ink },
  bold: { fontFamily: settingsTypography.bodyBold },
  restoreBody: { padding: 16, gap: 16 },
  step: { gap: 8 },
  stepTitle: { fontFamily: settingsTypography.bodySemiBold, fontSize: 15, color: cardTheme.ink },
  keyRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: cardTheme.field,
    backgroundColor: cardTheme.card,
    paddingHorizontal: 14,
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 16,
    color: cardTheme.ink,
  },
  pasteButton: { width: 84 },
  spinner: { marginTop: 18 },
  status: {
    marginHorizontal: 20,
    marginTop: 16,
    fontFamily: settingsTypography.body,
    fontSize: 14,
    lineHeight: 21,
    color: cardTheme.muted,
  },
});
