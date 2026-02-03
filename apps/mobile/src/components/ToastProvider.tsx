/**
 * Anchor App - Toast Provider
 *
 * Global toast notification manager with context.
 */

import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Toast, ToastProps, ToastType } from './Toast';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastItem extends ToastProps {
  id: string;
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = `${Date.now()}-${toastIdRef.current++}`;
    const newToast: ToastItem = {
      id,
      message,
      type,
      duration,
      onDismiss: () => removeToast(id),
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration + animation time
    setTimeout(() => {
      removeToast(id);
    }, duration + 500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (message: string, duration?: number) => showToast(message, 'success', duration);
  const error = (message: string, duration?: number) => showToast(message, 'error', duration);
  const info = (message: string, duration?: number) => showToast(message, 'info', duration);
  const warning = (message: string, duration?: number) => showToast(message, 'warning', duration);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <View
            key={toast.id}
            style={[styles.toastWrapper, { top: 60 + index * 80 }]}
            pointerEvents="box-none"
          >
            <Toast {...toast} />
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
