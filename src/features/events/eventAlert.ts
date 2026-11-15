import { Alert, Platform } from 'react-native';

// Expo Web's Alert implementation is empty; keep native dialogs unchanged.
export const eventAlert: typeof Alert.alert = (title, message, buttons, options) => {
  if (Platform.OS === 'web') {
    const browser = globalThis as typeof globalThis & { alert?: (message: string) => void };
    browser.alert?.([title, message].filter(Boolean).join('\n\n'));
    return;
  }
  Alert.alert(title, message, buttons, options);
};
