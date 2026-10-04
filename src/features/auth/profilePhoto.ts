export const PROFILE_PHOTO_JPEG_PREFIX = 'data:image/jpeg;base64,';
// Our firestore.rules limit the complete data URL, including this prefix, to 200023 characters.
export const PROFILE_PHOTO_MAX_DATA_URL_LENGTH = 200023;
export const PROFILE_PHOTO_RESIZE_WIDTH = 512;
export const PROFILE_PHOTO_COMPRESSION = 0.6;
