import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
// Type-only import: erased at compile time, so this does not create a cycle with AuthContext.
import type { ProfilePhoto } from './AuthContext';

export const PROFILE_PHOTO_JPEG_PREFIX = 'data:image/jpeg;base64,';
// Our firestore.rules limit the complete data URL, including this prefix, to 200023 characters.
export const PROFILE_PHOTO_MAX_DATA_URL_LENGTH = 200023;
export const PROFILE_PHOTO_RESIZE_WIDTH = 512;
export const PROFILE_PHOTO_COMPRESSION = 0.6;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
};

type PickResult = { photo?: ProfilePhoto; error?: string; canceled?: boolean };

/* Normalize a camera or library selection to a compact JPEG data URL Firestore will accept. */
async function toProfilePhoto(result: ImagePicker.ImagePickerResult): Promise<PickResult> {
  if (result.canceled) return { canceled: true };
  const asset = result.assets[0];
  if (!asset) return { canceled: true };

  try {
    const resized = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: PROFILE_PHOTO_RESIZE_WIDTH } }],
      {
        compress: PROFILE_PHOTO_COMPRESSION,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    if (!resized.base64) return { error: 'Could not prepare your photo. Please choose another.' };

    const dataUrl = `${PROFILE_PHOTO_JPEG_PREFIX}${resized.base64}`;
    // Enforce our profile photo size limit before sending the data URL to Firestore.
    if (dataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH) {
      return { error: 'This photo is too detailed. Choose a simpler photo under 150 KB.' };
    }
    return { photo: { uri: resized.uri, dataUrl } };
  } catch {
    return { error: 'Could not prepare your photo. Please choose another.' };
  }
}

export async function pickPhotoFromLibrary(): Promise<PickResult> {
  try {
    return await toProfilePhoto(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
  } catch {
    return { error: 'Could not open your photos. Please try again.' };
  }
}

export async function takeProfilePhoto(): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: 'Allow camera access to take a profile photo.' };
    return await toProfilePhoto(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  } catch {
    return { error: 'Could not open the camera. Please try again.' };
  }
}
