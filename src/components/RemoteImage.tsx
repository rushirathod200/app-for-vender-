import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageResizeMode,
  ImageStyle,
  Platform,
  StyleProp,
} from 'react-native';

interface RemoteImageProps {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
}

function isNgrokUrl(value: string): boolean {
  try {
    return new URL(value).hostname.includes('ngrok');
  } catch {
    return false;
  }
}

/**
 * React Native Web loads <Image> through a browser image element, which cannot
 * attach ngrok's bypass header. Fetching an API image as a Blob first prevents
 * ngrok's browser interstitial from being rendered as a broken product photo.
 */
export function RemoteImage({ uri, style, resizeMode = 'cover', accessibilityLabel }: RemoteImageProps) {
  const needsNgrokBypass = useMemo(() => isNgrokUrl(uri), [uri]);
  const shouldFetchBlob = Platform.OS === 'web' && needsNgrokBypass;
  const [resolvedUri, setResolvedUri] = useState<string | null>(shouldFetchBlob ? null : uri);

  useEffect(() => {
    if (!shouldFetchBlob) {
      setResolvedUri(uri);
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    setResolvedUri(null);

    void fetch(uri, {
      headers: {
        Accept: 'image/*',
        'ngrok-skip-browser-warning': 'true',
      },
      signal: controller.signal,
    })
      .then((response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || !contentType.startsWith('image/')) {
          throw new Error(`Product image request failed (${response.status}).`);
        }

        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedUri(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolvedUri(null);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shouldFetchBlob, uri]);

  if (!resolvedUri) {
    return null;
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      resizeMode={resizeMode}
      source={{
        uri: resolvedUri,
        ...(Platform.OS !== 'web' && needsNgrokBypass
          ? { headers: { 'ngrok-skip-browser-warning': 'true' } }
          : {}),
      }}
      style={style}
    />
  );
}
