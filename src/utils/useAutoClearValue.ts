import { useEffect, useRef } from 'react';

export function useAutoClearValue(
  value: string | null,
  clear: () => void,
  delayMs = 3000,
): void {
  const clearRef = useRef(clear);

  useEffect(() => {
    clearRef.current = clear;
  }, [clear]);

  useEffect(() => {
    if (!value) {
      return;
    }

    const timer = setTimeout(() => {
      clearRef.current();
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, value]);
}
