import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

import { ProductImageAsset } from '../types/vendor';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

type ProductImageSource = 'camera' | 'library';

async function launchProductImagePicker(source: ProductImageSource): Promise<ProductImageAsset | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(source === 'camera'
      ? 'Allow camera access to take a product photo.'
      : 'Allow photo access to choose a product image.');
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.86,
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const fileSize = asset.fileSize ?? asset.file?.size ?? null;
  if (fileSize && fileSize > MAX_IMAGE_BYTES) {
    throw new Error('Product image must be 5 MB or smaller.');
  }

  const originalFileName = asset.fileName ?? asset.uri.split('/').pop()?.split('?')[0] ?? '';
  const extension = originalFileName.includes('.')
    ? originalFileName.split('.').pop()?.toLowerCase() ?? ''
    : '';
  const mimeType = (asset.mimeType || asset.file?.type || '').trim().toLowerCase();

  if ((mimeType && !SUPPORTED_IMAGE_TYPES.has(mimeType))
    || (!mimeType && extension && !SUPPORTED_IMAGE_EXTENSIONS.has(extension))) {
    throw new Error('Unsupported image format. Choose a JPG, PNG, or WebP image.');
  }

  const normalizedMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : (mimeType || 'image/jpeg');
  const preferredExtension = normalizedMimeType === 'image/png'
    ? 'png'
    : normalizedMimeType === 'image/webp' ? 'webp' : 'jpg';
  const normalizedFileName = extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)
    ? originalFileName
    : `product-${Date.now()}.${preferredExtension}`;

  return {
    uri: asset.uri,
    fileName: normalizedFileName,
    mimeType: normalizedMimeType,
    file: asset.file ?? null,
  };
}

export async function pickProductImage(): Promise<ProductImageAsset | null> {
  // Browsers already show their own file-source chooser. Native apps receive a
  // clear camera/gallery choice before either permission is requested.
  if (Platform.OS === 'web') {
    return launchProductImagePicker('library');
  }

  return new Promise<ProductImageAsset | null>((resolve, reject) => {
    let settled = false;
    const finish = (value: ProductImageAsset | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const open = (source: ProductImageSource): void => {
      void launchProductImagePicker(source).then(finish).catch(fail);
    };

    Alert.alert(
      'Add product photo',
      'Take a new photo or choose one from your gallery.',
      [
        { text: 'Take photo', onPress: () => open('camera') },
        { text: 'Choose from gallery', onPress: () => open('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => finish(null) },
      ],
      { cancelable: true, onDismiss: () => finish(null) },
    );
  });
}
