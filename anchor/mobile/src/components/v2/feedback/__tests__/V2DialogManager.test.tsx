import { Alert } from 'react-native';
import { V2DialogManager } from '../V2DialogManager';

describe('V2DialogManager', () => {
  beforeEach(() => {
    V2DialogManager.hide();
  });

  afterEach(() => {
    V2DialogManager.uninstallAlertBridge();
  });

  it('manages confirm and alert states', () => {
    const onConfirm = jest.fn();
    V2DialogManager.showConfirm({
      title: 'Exit Practice',
      message: 'End session now?',
      onConfirm,
    });

    const state = V2DialogManager.getState();
    expect(state).not.toBeNull();
    expect(state?.type).toBe('confirm');
    if (state?.type === 'confirm') {
      expect(state.title).toBe('Exit Practice');
      state.onConfirm();
      expect(onConfirm).toHaveBeenCalled();
    }

    V2DialogManager.hide();
    expect(V2DialogManager.getState()).toBeNull();
  });

  it('intercepts Alert.alert calls and routes to 2.0 dialog states', () => {
    V2DialogManager.installAlertBridge();

    // Single button -> Alert
    Alert.alert('Notice', 'Operation completed');
    let state = V2DialogManager.getState();
    expect(state).not.toBeNull();
    expect(state?.type).toBe('alert');
    if (state?.type === 'alert') {
      expect(state.title).toBe('Notice');
      expect(state.message).toBe('Operation completed');
    }

    // Two buttons -> Confirm
    const onAction = jest.fn();
    const onCancel = jest.fn();
    Alert.alert('Discard Changes?', 'You have unsaved changes.', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Discard', style: 'destructive', onPress: onAction },
    ]);

    state = V2DialogManager.getState();
    expect(state).not.toBeNull();
    expect(state?.type).toBe('confirm');
    if (state?.type === 'confirm') {
      expect(state.title).toBe('Discard Changes?');
      expect(state.confirmLabel).toBe('Discard');
      expect(state.cancelLabel).toBe('Cancel');
      expect(state.destructive).toBe(true);

      state.onConfirm();
      expect(onAction).toHaveBeenCalledTimes(1);
    }
  });
});
