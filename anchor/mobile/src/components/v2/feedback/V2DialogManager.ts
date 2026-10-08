import { Alert, type AlertButton, type AlertOptions } from 'react-native';
import type { V2ActionSheetItem } from '../primitives/V2ActionSheet';

export type V2DialogState =
  | {
      type: 'confirm';
      title: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
      eyebrow?: string;
      onConfirm: () => void;
      onCancel?: () => void;
      testID?: string;
    }
  | {
      type: 'alert';
      title: string;
      message?: string;
      confirmLabel?: string;
      eyebrow?: string;
      onConfirm: () => void;
      testID?: string;
    }
  | {
      type: 'actionSheet';
      title?: string;
      subtitle?: string;
      actions: ReadonlyArray<V2ActionSheetItem>;
      onSelect: (key: string) => void;
      cancelLabel?: string;
      testID?: string;
    }
  | null;

type Listener = (state: V2DialogState) => void;

class V2DialogManagerClass {
  private currentState: V2DialogState = null;
  private listeners = new Set<Listener>();
  private originalAlertAlert: typeof Alert.alert | null = null;
  private bridgeInstalled = false;

  public getState(): V2DialogState {
    return this.currentState;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentState));
  }

  public showConfirm(config: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    eyebrow?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    testID?: string;
  }) {
    this.currentState = {
      type: 'confirm',
      ...config,
    };
    this.notify();
  }

  public showAlert(config: {
    title: string;
    message?: string;
    confirmLabel?: string;
    eyebrow?: string;
    onConfirm?: () => void;
    testID?: string;
  }) {
    this.currentState = {
      type: 'alert',
      ...config,
      onConfirm: config.onConfirm ?? (() => this.hide()),
    };
    this.notify();
  }

  public showActionSheet(config: {
    title?: string;
    subtitle?: string;
    actions: ReadonlyArray<V2ActionSheetItem>;
    onSelect: (key: string) => void;
    cancelLabel?: string;
    testID?: string;
  }) {
    this.currentState = {
      type: 'actionSheet',
      ...config,
    };
    this.notify();
  }

  public hide() {
    if (this.currentState !== null) {
      this.currentState = null;
      this.notify();
    }
  }

  /**
   * Installs an app-wide bridge that redirects native Alert.alert calls
   * into Anchor 2.0 bottom sheet modals, scrubbing native OS dialogs.
   */
  public installAlertBridge() {
    if (this.bridgeInstalled) return;
    this.bridgeInstalled = true;
    this.originalAlertAlert = Alert.alert;

    Alert.alert = (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: AlertOptions
    ) => {
      // 0 or 1 button -> 2.0 Alert Sheet
      if (!buttons || buttons.length <= 1) {
        const onlyBtn = buttons?.[0];
        this.showAlert({
          title: title || 'Notice',
          message,
          confirmLabel: onlyBtn?.text ?? 'Got it',
          onConfirm: () => {
            this.hide();
            onlyBtn?.onPress?.();
            options?.onDismiss?.();
          },
        });
        return;
      }

      // 2 buttons -> 2.0 Confirm Sheet
      if (buttons.length === 2) {
        const cancelBtn = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
        const actionBtn = buttons.find((b) => b !== cancelBtn) ?? buttons[1];

        this.showConfirm({
          title: title || 'Confirm',
          message,
          confirmLabel: actionBtn?.text ?? 'Confirm',
          cancelLabel: cancelBtn?.text ?? 'Cancel',
          destructive: actionBtn?.style === 'destructive',
          onConfirm: () => {
            this.hide();
            actionBtn?.onPress?.();
          },
          onCancel: () => {
            this.hide();
            cancelBtn?.onPress?.();
            options?.onDismiss?.();
          },
        });
        return;
      }

      // 3+ buttons -> 2.0 Action Sheet
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const actionItems: V2ActionSheetItem[] = buttons
        .filter((b) => b.style !== 'cancel')
        .map((b) => ({
          key: b.text ?? '',
          label: b.text ?? '',
          destructive: b.style === 'destructive',
        }));

      this.showActionSheet({
        title,
        subtitle: message,
        actions: actionItems,
        cancelLabel: cancelBtn?.text ?? 'Cancel',
        onSelect: (selectedKey) => {
          this.hide();
          const target = buttons.find((b) => b.text === selectedKey);
          target?.onPress?.();
        },
      });
    };
  }

  public uninstallAlertBridge() {
    if (this.bridgeInstalled && this.originalAlertAlert) {
      Alert.alert = this.originalAlertAlert;
      this.bridgeInstalled = false;
    }
  }
}

export const V2DialogManager = new V2DialogManagerClass();
