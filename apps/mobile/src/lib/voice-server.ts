/**
 * Server voice: in demo builds with a model server configured (Expo Go),
 * Raco hears through its speech-to-text model and talks through its
 * text-to-speech model, so voice works without the phone's speech
 * recogniser, which Expo Go doesn't include. Nothing is sent until the user
 * has agreed to the AI service (Guideline 5.1.2(i)); until then, and in
 * every other build, the phone's own speech is used.
 */
import { File, Paths, UploadTask, UploadType } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { config, DEMO } from './config';

/** True when this build talks to a model server for voice. */
export const SERVER_VOICE = DEMO && Platform.OS !== 'web' && !!config.llmChatUrl && !!config.llmApiKey;

let consented = false;

/** Kept in step with the saved AI consent by AiConsentProvider. */
export function setServerVoiceConsent(on: boolean) {
  consented = on;
}

/** Whether voice goes to the model server right now. */
export function serverVoiceOn(): boolean {
  return SERVER_VOICE && consented;
}

/** `https://host/v1`, from the configured chat completions URL. */
const apiBase = config.llmChatUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');

const authHeaders = () => ({ Authorization: `Bearer ${config.llmApiKey}`, 'ngrok-skip-browser-warning': 'true' });

/** Sends a recording to the speech-to-text model and returns what was said. */
export async function transcribe(uri: string): Promise<string> {
  const task = new UploadTask(new File(uri), `${apiBase}/audio/transcriptions`, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'audio/mp4',
    headers: authHeaders(),
    parameters: { model: config.sttModel },
  });
  try {
    const res = await task.uploadAsync();
    if (res.status < 200 || res.status >= 300) throw new Error(`Speech-to-text returned ${res.status}`);
    return String((JSON.parse(res.body) as { text?: unknown }).text ?? '').trim();
  } finally {
    task.release();
  }
}

let clip = 0;

/** Turns text into speech with the text-to-speech model; returns an MP3 file in the cache. */
export async function synthesize(text: string): Promise<File> {
  const res = await fetch(`${apiBase}/audio/speech`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.ttsModel, input: text, voice: config.ttsVoice, response_format: 'mp3' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Text-to-speech returned ${res.status}`);
  const file = new File(Paths.cache, `raco-speech-${Date.now()}-${clip++}.mp3`);
  await file.write(new Uint8Array(await res.arrayBuffer()));
  return file;
}

/** Deletes a clip once played; a missing file is fine. */
export function discard(file: File | null | undefined) {
  try {
    file?.delete();
  } catch {
    // Already gone.
  }
}
