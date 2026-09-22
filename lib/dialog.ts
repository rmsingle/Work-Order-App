import { Alert, Platform } from 'react-native';

/**
 * Web confirm/alert must be called as methods on `globalThis`.
 * Copying confirm off the window and calling that copy throws TypeError
 * (Illegal invocation) in browsers, and react-native-web's Alert.alert is a no-op.
 */
export function confirmChoice(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = `${title}\n\n${message}`;
    if (typeof globalThis.confirm !== 'function') return Promise.resolve(false);
    return Promise.resolve(globalThis.confirm(text));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof globalThis.alert === 'function') globalThis.alert(text);
    return;
  }
  Alert.alert(title, message);
}
