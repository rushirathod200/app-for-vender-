import React, { createContext, useCallback, useContext, useRef } from 'react';

export type NotificationOrderAction = 'accepted' | 'rejected' | null;

interface NotificationTapEvent {
  orderId: number | null;
  action: NotificationOrderAction;
  reason: string | null;
  handledExternally: boolean;
  requestId: number;
}

type NotificationTapHandler = (event: NotificationTapEvent) => void;

interface NotificationTapContextValue {
  registerHandler: (handler: NotificationTapHandler) => () => void;
  handleNotificationTap: (
    orderId: number | null,
    action?: NotificationOrderAction,
    reason?: string | null,
    handledExternally?: boolean,
  ) => void;
}

const NotificationTapContext = createContext<NotificationTapContextValue | undefined>(undefined);

export function NotificationTapProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<NotificationTapHandler | null>(null);
  const pendingEventRef = useRef<NotificationTapEvent | null>(null);
  const requestIdRef = useRef(0);

  const registerHandler = useCallback((handler: NotificationTapHandler) => {
    handlerRef.current = handler;

    if (pendingEventRef.current) {
      handler(pendingEventRef.current);
      pendingEventRef.current = null;
    }

    return () => {
      handlerRef.current = null;
    };
  }, []);

  const handleNotificationTap = useCallback((
    orderId: number | null,
    action: NotificationOrderAction = null,
    reason: string | null = null,
    handledExternally = false,
  ) => {
    requestIdRef.current += 1;

    const event: NotificationTapEvent = {
      orderId,
      action,
      reason,
      handledExternally,
      requestId: requestIdRef.current,
    };

    if (handlerRef.current) {
      handlerRef.current(event);
      return;
    }

    pendingEventRef.current = event;
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
