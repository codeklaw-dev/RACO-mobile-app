import { Alert, Platform } from 'react-native';

/**
 * A two-button question. React Native's Alert does nothing on web, so the
 * web preview falls back to the browser's confirm dialog.
 */
export function confirm(title: string, message: string, ok: string, cancel = 'Not now'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]);
  });
}

/** A notice with one button; on web, the browser's alert. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
