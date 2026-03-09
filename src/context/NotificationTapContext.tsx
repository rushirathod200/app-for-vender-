import React, { createContext, useCallback, useContext, useRef } from 'react';

type NotificationTapHandler = (orderId: number | null) => void;

interface NotificationTapContextValue {
  registerHandler: (handler: NotificationTapHandler) => () => void;
  handleNotificationTap: (orderId: number | null) => void;
}

const NotificationTapContext = createContext<NotificationTapContextValue | undefined>(undefined);

export function NotificationTapProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<NotificationTapHandler | null>(null);

  const registerHandler = useCallback((handler: NotificationTapHandler) => {
    handlerRef.current = handler;
    return () => {
      handlerRef.current = null;
    };
  }, []);

  const handleNotificationTap = useCallback((orderId: number | null) => {
    handlerRef.current?.(orderId);
  }, []);

  const value: NotificationTapContextValue = {
    registerHandler,
    handleNotificationTap,
  };

  return (
    <NotificationTapContext.Provider value={value}>
      {children}
    </NotificationTapContext.Provider>
  );
}

export function useNotificationTap(): NotificationTapContextValue {
  const context = useContext(NotificationTapContext);
  if (!context) {
    throw new Error('useNotificationTap must be used within NotificationTapProvider');
  }
  return context;
}
