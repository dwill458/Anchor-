import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import { SettingsHeader } from '@/components/settings/SettingsPrimitives';
import { createBackup, restoreBackup } from '@/storage/backup/backupRuntime';
import { bytesToBase64, base64ToBytes } from '@/storage/backup/base64';
import { BackupError } from '@/storage/backup/archiveCrypto';

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

export function BackupRecoverySubscreen({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<Extract<Awaited<ReturnType<typeof createBackup>>, { ok: true }> | null>(null);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [key, setKey] = useState('');
  const [status, setStatus] = useState('');

  const startBackup = async () => {
    setBusy(true); setStatus('Checking local storage and backup coverage…');
    try {
      const result = await createBackup();
      if (!result.ok) {
        const omissions = result.coverage.unresolved.map((item) => item.name).join(', ');
        setStatus(`A complete backup is not available yet. Unresolved local data: ${omissions || 'unknown namespace'}.`);
        return;
      }
      setBackup(result); setKeyConfirmed(false); setStatus('');
    } catch (error) { setStatus(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const exportBackup = async () => {
    if (!backup || !keyConfirmed) return;
    setBusy(true);
    try {
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) { setStatus('Save canceled. No backup was reported as saved.'); return; }
      const filename = `Anchor-backup-${new Date().toISOString().slice(0, 10)}.anchorbackup`;
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, 'application/octet-stream');
      const encoded = bytesToBase64(backup.archive);
      await FileSystem.writeAsStringAsync(uri, encoded, { encoding: FileSystem.EncodingType.Base64 });
      const readBack = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (readBack !== encoded) throw new Error('External archive read-back did not match');
      setStatus('Backup saved and verified outside Anchor. Keep your recovery key separate from this file.');
    } catch { setStatus('Anchor could not verify the external backup file. It has not reported success.'); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    setBusy(true); setStatus('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (picked.canceled) { setStatus('Restore canceled. Your current data is unchanged.'); return; }
      const archiveBase64 = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const result = await restoreBackup({ archive: base64ToBytes(archiveBase64), recoverySecret: key });
      setStatus(result.status === 'complete'
        ? `Recovery verified: ${result.records} records restored. Sign in to the same account to access account-owned content.`
        : 'Private records were verified, but some preferences could not be restored yet. Your encrypted archive remains safe; retry recovery to finish.');
    } catch (error) { setStatus(errorMessage(error)); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SettingsHeader title="Backup & recovery" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Keep a copy of your Anchor life.</Text>
        <Text style={styles.body}>An encrypted backup protects locally stored Anchors, practice progress, drafts, and pending work. Your recovery key is the only way to unlock this file if you lose this device.</Text>

        {!backup ? <Action label="Back up my data" onPress={startBackup} disabled={busy} /> : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your recovery key</Text>
            <Text style={styles.body}>Save this key somewhere private and separate from the backup file. Anchor does not keep a copy.</Text>
            <Text selectable style={styles.secret} testID="backup-recovery-key">{backup.recoverySecret}</Text>
            <Text style={styles.meta}>Generated {new Date().toLocaleString()} · {backup.summary.recordCount} records · {backup.summary.recoveryCount} recovery records · {backup.coverage.excluded.length} documented omissions</Text>
            {backup.coverage.excluded.length ? <View style={styles.omissions}>
              <Text style={styles.omissionTitle}>Not included</Text>
              {backup.coverage.excluded.map((item) => <Text key={`${item.store}:${item.name}`} style={styles.omission}>{item.name} — {item.reason}</Text>)}
            </View> : null}
            <Action label={keyConfirmed ? 'Key saved — save encrypted backup' : 'I have saved my recovery key'} onPress={keyConfirmed ? exportBackup : () => setKeyConfirmed(true)} disabled={busy} />
          </View>
        )}

        <Text style={styles.section}>Restore from backup</Text>
        <Text style={styles.body}>Choose an Anchor backup file and enter its recovery key. Account-owned content remains unavailable until you sign in to the matching account.</Text>
        <TextInput value={key} onChangeText={setKey} autoCapitalize="characters" autoCorrect={false} secureTextEntry accessibilityLabel="Recovery key" placeholder="Enter recovery key" placeholderTextColor={T.ink3} style={styles.input} />
        <Action label="Restore from backup" onPress={restore} disabled={busy || !key.trim()} secondary />
        {busy ? <ActivityIndicator color={T.ink2} style={styles.spinner} /> : null}
        {status ? <Text accessibilityRole="alert" style={styles.status}>{status}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.action, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg }, content: { paddingHorizontal: 24, paddingBottom: 36 },
  title: { color: T.ink, fontFamily: settingsTypography.display, fontSize: 27, lineHeight: 34, marginTop: 30 },
  body: { color: T.ink2, fontFamily: settingsTypography.body, fontSize: 15, lineHeight: 22, marginTop: 12 },
  action: { minHeight: 52, borderRadius: 8, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 20 },
  secondary: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }, actionText: { color: T.surface, fontFamily: settingsTypography.bodySemiBold, fontSize: 15 }, secondaryText: { color: T.ink },
  disabled: { opacity: 0.5 }, card: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 18, marginTop: 20 },
  cardTitle: { color: T.ink, fontFamily: settingsTypography.bodySemiBold, fontSize: 17 }, secret: { color: T.ink, fontFamily: 'monospace', fontSize: 16, letterSpacing: 0.6, lineHeight: 25, marginTop: 16, padding: 12, backgroundColor: T.surface2, borderRadius: 6 },
  meta: { color: T.ink3, fontFamily: settingsTypography.body, fontSize: 12, lineHeight: 18, marginTop: 12 }, section: { color: T.ink, fontFamily: settingsTypography.bodySemiBold, fontSize: 18, marginTop: 32 },
  omissions: { borderTopWidth: 1, borderColor: T.line, paddingTop: 12, marginTop: 12 }, omissionTitle: { color: T.ink2, fontFamily: settingsTypography.bodySemiBold, fontSize: 13, marginBottom: 6 }, omission: { color: T.ink3, fontFamily: settingsTypography.body, fontSize: 12, lineHeight: 17, marginTop: 4 },
  input: { minHeight: 50, borderColor: T.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, color: T.ink, marginTop: 18, backgroundColor: T.surface },
  spinner: { marginTop: 18 }, status: { color: T.ink2, fontFamily: settingsTypography.body, fontSize: 14, lineHeight: 21, marginTop: 16 },
});
