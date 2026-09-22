import { Alert, Platform } from 'react-native';

/** Confirm before a job leaves the dashboard. Web uses window.confirm; native uses Alert. */
export function confirmArchiveJob(jobTitle: string): Promise<boolean> {
  const message = `Archive “${jobTitle}”? It will leave the Jobs list. Photos stay saved.`;
  if (Platform.OS === 'web') {
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    return Promise.resolve(ask ? ask(message) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      'Archive job',
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Archive', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
