import {
  interpretLocally,
  toVoiceResult,
  VOICE_SYSTEM_PROMPT,
  voiceResultSchema,
  voiceUserMessage,
  type VoiceTurnRequest,
  type VoiceTurnResult,
} from '@raco/shared';
import * as Speech from 'expo-speech';
import { fetch } from 'expo/fetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from './config';
import { DEMO } from './demo';
import { noteSampleError, previewSample } from './preview-ai';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Speaking: the phone's built-in text-to-speech (free, on-device).
// ---------------------------------------------------------------------------

let voiceId: string | undefined;
let voicePicked = false;

/** Prefers an "enhanced" English voice where the phone has one. */
async function pickVoice() {
  if (voicePicked) return voiceId;
  voicePicked = true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter((v) => v.language?.startsWith('en'));
    voiceId = (english.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? english[0])?.identifier;
  } catch {
    voiceId = undefined;
  }
  return voiceId;
}

/** Speaks text aloud; resolves when it finishes or is interrupted. */
export async function speak(text: string): Promise<void> {
  const voice = await pickVoice();
  Speech.stop();
  await new Promise<void>((resolve) => {
    // Some engines never report the end of speech; don't let that stall the flow.
    const fallback = setTimeout(resolve, 1500 + text.split(/\s+/).length * 450);
    const done = () => {
      clearTimeout(fallback);
      resolve();
    };
    Speech.speak(text, { voice, rate: 1.0, onDone: done, onStopped: done, onError: done });
  });
}

export function stopSpeaking() {
  Speech.stop();
}

/**
 * Adds text to the phone's speech queue without interrupting what's already
 * playing; `onDone` runs when this piece finishes or is stopped.
 */
export async function speakQueued(text: string, onDone: () => void): Promise<void> {
  const voice = await pickVoice();
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone();
  };
  Speech.speak(text, { voice, rate: 1.0, onDone: done, onStopped: done, onError: done });
}

// ---------------------------------------------------------------------------
// Listening: the phone's built-in speech recognition, push-to-talk.
// ---------------------------------------------------------------------------

type Recognizer = (typeof import('expo-speech-recognition'))['ExpoSpeechRecognitionModule'];

// Loaded lazily: the native module isn't in Expo Go, and importing it there
// throws. Without it, voice input is unavailable and the app offers typing.
const recognizer: Recognizer | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
})();

export function speechRecognitionAvailable(): boolean {
  try {
    return recognizer?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

export async function requestMicrophone(): Promise<boolean> {
  try {
    const res = await recognizer?.requestPermissionsAsync();
    return res?.granted ?? false;
  } catch {
    return false;
  }
}

/**
 * Hold-to-talk: `start` on press, `stop` on release. `onFinal` receives the
 * transcript once recognition ends; `partial` shows it while speaking.
 * `unavailable` turns true when the mic can't be used here (permission
 * denied, no recogniser), so the screen can switch to typing.
 */
export function useHoldToTalk(onFinal: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [unavailable, setUnavailable] = useState(!recognizer);
  const latest = useRef('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    if (!recognizer) return;
    const subs = [
      recognizer.addListener('start', () => setListening(true)),
      recognizer.addListener('result', (e) => {
        const t = e.results[0]?.transcript ?? '';
        latest.current = t;
        setPartial(t);
      }),
      recognizer.addListener('end', () => {
        setListening(false);
        const t = latest.current.trim();
        latest.current = '';
        setPartial('');
        if (t) onFinalRef.current(t);
      }),
      recognizer.addListener('error', (e) => {
        // Nothing heard is fine: the user just tries again. Anything else
        // means the mic can't be used here.
        if (e.error === 'aborted' || e.error === 'no-speech' || e.error === 'speech-timeout') return;
        setListening(false);
        setUnavailable(true);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const start = useCallback(() => {
    stopSpeaking();
    latest.current = '';
    recognizer?.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
  }, []);

  const stop = useCallback(() => recognizer?.stop(), []);

  return { listening, partial, unavailable, start, stop };
}

/**
 * Dictation into a text field: `toggle` starts and stops listening, and
 * `onText` receives the running transcript. Unavailable in Expo Go.
 */
export function useDictation(onText: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    if (!recognizer) return;
    const subs = [
      recognizer.addListener('start', () => setListening(true)),
      recognizer.addListener('end', () => setListening(false)),
      recognizer.addListener('error', () => setListening(false)),
      recognizer.addListener('result', (e) => onTextRef.current(e.results[0]?.transcript ?? '')),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const toggle = useCallback(async () => {
    if (!recognizer) return;
    if (listening) {
      recognizer.stop();
      return;
    }
    if (!(await requestMicrophone())) return;
    stopSpeaking();
    recognizer.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
  }, [listening]);

  return { available: !!recognizer && speechRecognitionAvailable(), listening, toggle };
}

/**
 * Hands-free listening for voice mode: `listen()` opens the mic and stops on
 * its own when the user pauses; `onFinal` gets what they said and `onVolume`
 * the input level (0-1) for the orb. Unavailable in Expo Go.
 */
export function useConversationMic({ onFinal, onVolume }: { onFinal: (text: string) => void; onVolume?: (level: number) => void }) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const latest = useRef('');
  const handlers = useRef({ onFinal, onVolume });
  useEffect(() => {
    handlers.current = { onFinal, onVolume };
  }, [onFinal, onVolume]);

  useEffect(() => {
    if (!recognizer) return;
    const subs = [
      recognizer.addListener('start', () => setListening(true)),
      recognizer.addListener('result', (e) => {
        latest.current = e.results[0]?.transcript ?? '';
        setPartial(latest.current);
      }),
      recognizer.addListener('volumechange', (e) => handlers.current.onVolume?.(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
      recognizer.addListener('end', () => {
        setListening(false);
        setPartial('');
        handlers.current.onVolume?.(0);
        const text = latest.current.trim();
        latest.current = '';
        if (text) handlers.current.onFinal(text);
      }),
      recognizer.addListener('error', () => setListening(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // Between start() and the 'start' event `listening` is still false; this stops a second start.
  const starting = useRef(false);
  const listen = useCallback(async () => {
    if (!recognizer || listening || starting.current) return;
    starting.current = true;
    if (!(await requestMicrophone())) {
      starting.current = false;
      return;
    }
    latest.current = '';
    setTimeout(() => (starting.current = false), 800);
    recognizer.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    });
  }, [listening]);

  const cancel = useCallback(() => {
    latest.current = '';
    recognizer?.abort();
  }, []);

  return { available: !!recognizer && speechRecognitionAvailable(), listening, partial, listen, cancel };
}

// ---------------------------------------------------------------------------
// Understanding: the API reads each answer with a small model.
// ---------------------------------------------------------------------------

/**
 * Reads one onboarding answer. Without AI consent (`useAi` false) it stays on
 * the device and uses the rule-based reader (Guideline 5.1.2(i)).
 */
export async function voiceTurn(req: VoiceTurnRequest, useAi: boolean): Promise<VoiceTurnResult> {
  if (!useAi) return interpretLocally(req);
  if (DEMO) return previewVoiceTurn(req);
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`${config.apiUrl}/v1/onboarding/voice-turn`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as VoiceTurnResult;
  } catch {
    // Offline or API trouble: the rule-based reader still gets people through.
    return interpretLocally(req);
  }
}

/** In the web preview or Expo Go: Claude/LLM when available, otherwise rules. */
async function previewVoiceTurn(req: VoiceTurnRequest): Promise<VoiceTurnResult> {
  const sample = await previewSample();
  if (sample) {
    try {
      const out = await sample.json(
        `${VOICE_SYSTEM_PROMPT}\n\nReply with only a JSON object with exactly these keys: understood, wantsTour, say, displayName, agentName, interests, callsAllowed (use null for keys that don't apply).\n\n${voiceUserMessage(req)}`,
        { modelTier: 'quick' },
      );
      const parsed = voiceResultSchema.safeParse(out);
      return parsed.success ? toVoiceResult(parsed.data) : interpretLocally(req);
    } catch (err) {
      noteSampleError(err);
      return interpretLocally(req);
    }
  }

  if (config.llmChatUrl && config.llmApiKey) {
    try {
      const rawUrl = config.llmChatUrl.replace(/\/+$/, '');
      const url = rawUrl.endsWith('/chat/completions') ? rawUrl : `${rawUrl}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.llmApiKey}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          model: config.llmModel || 'qwen3',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: `${VOICE_SYSTEM_PROMPT}\n\nReply with only a JSON object with exactly these keys: understood (boolean), wantsTour (boolean), say (string), displayName (string or null), agentName (string or null), interests (array of allowed interests, or null), callsAllowed (boolean or null).`,
            },
            { role: 'user', content: voiceUserMessage(req) },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const body = (await res.json()) as { choices?: { message?: { content?: string | null; reasoning?: string | null } }[] };
        const msg = body.choices?.[0]?.message;
        const content = msg?.content || msg?.reasoning || '';
        const json = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
        const parsed = voiceResultSchema.safeParse(JSON.parse(json));
        if (parsed.success) return toVoiceResult(parsed.data);
      }
    } catch (err) {
      console.warn('Voice onboarding LLM turn failed, falling back to local interpreter', err);
    }
  }

  return interpretLocally(req);
}
