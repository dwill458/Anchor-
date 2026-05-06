/**
 * Anchor App - Toast Provider
 *
 * Global toast notification manager with context.
 */

import React, { createContext, useContext, useState, ReactNode, useRef, useCallback, useEffect } from 'react';
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
  const idCounterRef = useRef(0);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearToastTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (!timer) return;
    clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const removeToast = useCallback((id: string) => {
    clearToastTimer(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, [clearToastTimer]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    idCounterRef.current += 1;
    const id = `toast-${idCounterRef.current}`;
    const newToast: ToastItem = {
      id,
      message,
      type,
      duration,
      onDismiss: () => removeToast(id),
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration + animation time
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration + 500);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const success = useCallback((message: string, duration?: number) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message: string, duration?: number) => showToast(message, 'error', duration), [showToast]);
  const info = useCallback((message: string, duration?: number) => showToast(message, 'info', duration), [showToast]);
  const warning = useCallback((message: string, duration?: number) => showToast(message, 'warning', duration), [showToast]);

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
