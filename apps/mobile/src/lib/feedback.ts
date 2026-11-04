import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { config } from './config';
import { notify } from './dialog';

/**
 * Opens an email to support. Only the app version, platform and, when given,
 * the chat's id are filled in; the user writes the rest and decides to send.
 */
export async function sendFeedback(conversationId?: string | null) {
  const lines = [
    '',
    '',
    '—',
    `App ${Constants.expoConfig?.version ?? 'dev'} on ${Platform.OS} ${Platform.Version}`,
    ...(conversationId ? [`Chat ${conversationId}`] : []),
  ];
  const url = `mailto:${config.supportEmail}?subject=${encodeURIComponent('Raco feedback')}&body=${encodeURIComponent(lines.join('\n'))}`;
  try {
    await Linking.openURL(url);
  } catch {
    notify('No email app found', `Write to us at ${config.supportEmail}.`);
  }
}
