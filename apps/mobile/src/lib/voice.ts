import {
  interpretLocally,
  type VoiceTurnRequest,
  type VoiceTurnResult,
} from '@raco/shared';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { fetch } from 'expo/fetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from './config';
import { DEMO } from './demo';
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

// ---------------------------------------------------------------------------
// Listening: the phone's built-in speech recognition, push-to-talk.
// ---------------------------------------------------------------------------

export function speechRecognitionAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function requestMicrophone(): Promise<boolean> {
  try {
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/**
 * Hold-to-talk: `start` on press, `stop` on release. `onFinal` receives the
 * transcript once recognition ends; `partial` shows it while speaking.
 */
export function useHoldToTalk(onFinal: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results[0]?.transcript ?? '';
    latest.current = t;
    setPartial(t);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const t = latest.current.trim();
    latest.current = '';
    setPartial('');
    if (t) onFinalRef.current(t);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'aborted' || e.error === 'no-speech') return;
    setError("I couldn't hear that. Try again, or type your answer.");
  });

  const start = useCallback(() => {
    stopSpeaking();
    setError(null);
    latest.current = '';
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  return { listening, partial, error, start, stop };
}

// ---------------------------------------------------------------------------
// Understanding: the API reads each answer with a small model.
// ---------------------------------------------------------------------------

export async function voiceTurn(req: VoiceTurnRequest): Promise<VoiceTurnResult> {
  if (DEMO) return interpretLocally(req);
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
