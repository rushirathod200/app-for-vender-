import { BackHandler, Platform } from 'react-native';
import { useEffect } from 'react';

interface AndroidBackHandlerOptions {
  enabled?: boolean;
  priority?: number;
}

interface BackHandlerEntry {
  id: number;
  priority: number;
  handler: () => boolean;
}

const backHandlerEntries: BackHandlerEntry[] = [];
let nextBackHandlerId = 1;
let isBackHandlerBound = false;

function bindAndroidBackHandler(): void {
  if (isBackHandlerBound || Platform.OS !== 'android') {
    return;
  }

  BackHandler.addEventListener('hardwareBackPress', () => {
    const orderedEntries = [...backHandlerEntries].sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }

      return right.id - left.id;
    });

    for (const entry of orderedEntries) {
      if (entry.handler()) {
        return true;
      }
    }

    return false;
  });

  isBackHandlerBound = true;
}

export function useAndroidBackHandler(
  handler: () => boolean,
  options: AndroidBackHandlerOptions = {},
): void {
  const enabled = options.enabled ?? true;
  const priority = options.priority ?? 0;

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) {
      return;
    }

    bindAndroidBackHandler();

    const entry: BackHandlerEntry = {
      id: nextBackHandlerId++,
      priority,
      handler,
    };

    backHandlerEntries.push(entry);

    return () => {
      const entryIndex = backHandlerEntries.findIndex((currentEntry) => currentEntry.id === entry.id);

      if (entryIndex >= 0) {
        backHandlerEntries.splice(entryIndex, 1);
      }
    };
  }, [enabled, handler, priority]);
}
