import React, { useEffect, useState } from 'react';
import { V2ConfirmSheet, V2ActionSheet } from '../primitives';
import { V2DialogManager, type V2DialogState } from './V2DialogManager';

/**
 * Anchor 2.0 Global Dialog Host.
 *
 * Mounts at the root of the app to present 2.0 bottom sheet confirmations,
 * alerts, and action sheets in place of native OS dialogs.
 */
export function V2DialogHost() {
  const [dialog, setDialog] = useState<V2DialogState>(null);

  useEffect(() => {
    return V2DialogManager.subscribe((next) => {
      setDialog(next);
    });
  }, []);

  if (!dialog) return null;

  if (dialog.type === 'confirm' || dialog.type === 'alert') {
    return (
      <V2ConfirmSheet
        visible={true}
        onClose={() => {
          if (dialog.type === 'confirm' && dialog.onCancel) {
            dialog.onCancel();
          } else {
            V2DialogManager.hide();
          }
        }}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.type === 'confirm' ? dialog.cancelLabel : undefined}
        destructive={dialog.type === 'confirm' ? dialog.destructive : false}
        eyebrow={dialog.eyebrow}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.type === 'confirm' ? dialog.onCancel : undefined}
        testID={dialog.testID ?? 'v2-dialog-host'}
      />
    );
  }

  if (dialog.type === 'actionSheet') {
    return (
      <V2ActionSheet
        visible={true}
        onClose={() => V2DialogManager.hide()}
        title={dialog.title}
        subtitle={dialog.subtitle}
        actions={dialog.actions}
        onSelect={dialog.onSelect}
        cancelLabel={dialog.cancelLabel}
        testID={dialog.testID ?? 'v2-dialog-host-actions'}
      />
    );
  }

  return null;
}
