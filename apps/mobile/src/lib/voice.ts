import {
  interpretLocally,
  toVoiceResult,
  VOICE_SYSTEM_PROMPT,
  voiceResultSchema,
  voiceUserMessage,
  type VoiceTurnRequest,
  type VoiceTurnResult,
} from '@raco/shared';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { fetch } from 'expo/fetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAiConsent } from './ai-consent';
import { config } from './config';
import { DEMO } from './demo';
import { noteSampleError, previewSample } from './preview-ai';
import { supabase } from './supabase';
import { meterLevel, splitForSpeech, VoiceActivity } from './voice-activity';
import { discard, SERVER_VOICE, serverVoiceOn, synthesize, transcribe } from './voice-server';

// ---------------------------------------------------------------------------
// Speaking: the model server's voice when it's on (see voice-server.ts),
// otherwise the phone's built-in text-to-speech (free, on-device).
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

/** Speaks with the phone's voice; resolves when it finishes or is interrupted. */
async function speakOnPhone(text: string): Promise<void> {
  const voice = await pickVoice();
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

// Server clips play one after another. stopSpeaking() starts a new
// generation, so clips queued before it are dropped instead of played.
let generation = 0;
let queue: Promise<void> = Promise.resolve();
let endClip: (() => void) | null = null;

function playClip(file: File): Promise<void> {
  return new Promise((resolve) => {
    const player = createAudioPlayer({ uri: file.uri });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      sub.remove();
      if (endClip === finish) endClip = null;
      player.remove();
      discard(file);
      resolve();
    };
    // A clip that never reports its end mustn't stall the queue.
    const guard = setTimeout(finish, 60_000);
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) finish();
    });
    endClip = finish;
    player.play();
  });
}

/** Queues one piece: synthesis starts now, playback waits its turn. Falls back to the phone's voice. */
function queueOnServer(text: string): Promise<void> {
  const gen = generation;
  const audio = synthesize(text).catch(() => null);
  queue = queue.then(async () => {
    const file = await audio;
    if (gen !== generation) return discard(file);
    if (!file) return speakOnPhone(text);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    if (gen !== generation) return discard(file);
    await playClip(file);
  });
  queue = queue.catch(() => undefined);
  return queue;
}

/** Speaks text aloud; resolves when it finishes or is interrupted. */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  if (!serverVoiceOn()) return speakOnPhone(text);
  await Promise.all(splitForSpeech(text).map(queueOnServer));
}

export function stopSpeaking() {
  generation += 1;
  endClip?.();
  Speech.stop();
}

/**
 * Adds text to the speech queue without interrupting what's already
 * playing; `onDone` runs when this piece finishes or is stopped.
 */
export async function speakQueued(text: string, onDone: () => void): Promise<void> {
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone();
  };
  if (serverVoiceOn()) {
    void queueOnServer(text).then(done);
    return;
  }
  const voice = await pickVoice();
  Speech.speak(text, { voice, rate: 1.0, onDone: done, onStopped: done, onError: done });
}

// ---------------------------------------------------------------------------
// Listening: the model server's speech-to-text when it's on, otherwise the
// phone's built-in speech recognition.
// ---------------------------------------------------------------------------

type Recognizer = (typeof import('expo-speech-recognition'))['ExpoSpeechRecognitionModule'];

// Loaded lazily: the native module isn't in Expo Go, and importing it there
// throws. Without it (and without server voice), the app offers typing.
const recognizer: Recognizer | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
})();

function phoneRecognitionAvailable(): boolean {
  try {
    return recognizer?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

/** Whether voice input can work in this build (server voice still needs AI consent). */
export function speechRecognitionAvailable(): boolean {
  return SERVER_VOICE || phoneRecognitionAvailable();
}

/** Whether voice input works right now, given the user's AI consent. */
export function voiceInputAvailable(consented: boolean): boolean {
  return (SERVER_VOICE && consented) || phoneRecognitionAvailable();
}

export async function requestMicrophone(): Promise<boolean> {
  try {
    const res = SERVER_VOICE ? await requestRecordingPermissionsAsync() : await recognizer?.requestPermissionsAsync();
    return res?.granted ?? false;
  } catch {
    return false;
  }
}

const RECORDING: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, isMeteringEnabled: true };

/**
 * Records for the server's speech-to-text. `begin` opens the mic (with
 * `onLevel` called every 100 ms with the level in dB), `finish` stops and
 * returns the transcript, `cancel` throws the recording away.
 */
function useServerRecorder() {
  const recorder = useAudioRecorder(RECORDING);
  const active = useRef(false);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMeter = () => {
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
  };
  useEffect(() => stopMeter, []);

  const begin = useCallback(
    async (onLevel?: (db: number | undefined) => void): Promise<boolean> => {
      if (active.current) return true;
      if (!(await requestMicrophone())) return false;
      stopSpeaking();
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch {
        return false;
      }
      active.current = true;
      if (onLevel) meter.current = setInterval(() => onLevel(recorder.getStatus().metering), 100);
      return true;
    },
    [recorder],
  );

  const end = useCallback(async (): Promise<string | null> => {
    if (!active.current) return null;
    active.current = false;
    stopMeter();
    try {
      await recorder.stop();
    } finally {
      // Back to playback mode, so replies come out of the speaker.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
    return recorder.uri;
  }, [recorder]);

  const finish = useCallback(async (): Promise<string> => {
    const uri = await end();
    if (!uri) return '';
    try {
      return await transcribe(uri);
    } finally {
      discard(new File(uri));
    }
  }, [end]);

  const cancel = useCallback(async () => {
    const uri = await end().catch(() => null);
    if (uri) discard(new File(uri));
  }, [end]);

  return { begin, finish, cancel };
}

/**
 * Hold-to-talk: `start` on press, `stop` on release. `onFinal` receives the
 * transcript once recognition ends; `partial` shows it while speaking.
 * `unavailable` turns true when the mic can't be used here (permission
 * denied, no recogniser), so the screen can switch to typing.
 */
export function useHoldToTalk(onFinal: (transcript: string) => void) {
  const { consented } = useAiConsent();
  const server = SERVER_VOICE && consented;
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [unavailable, setUnavailable] = useState(!recognizer && !SERVER_VOICE);
  const latest = useRef('');
  const held = useRef(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  const rec = useServerRecorder();

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

  const finishServer = useCallback(async () => {
    setPartial('…');
    try {
      const t = await rec.finish();
      if (t) onFinalRef.current(t);
    } catch {
      // The server couldn't be reached: switch to typing.
      setUnavailable(true);
    } finally {
      setListening(false);
      setPartial('');
    }
  }, [rec]);

  const start = useCallback(() => {
    stopSpeaking();
    latest.current = '';
    if (server) {
      held.current = true;
      void rec.begin().then((ok) => {
        if (!ok) return setUnavailable(true);
        // Released before the mic opened: nothing to keep.
        if (!held.current) return void rec.cancel();
        setListening(true);
      });
      return;
    }
    if (!recognizer) return setUnavailable(true);
    recognizer.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
  }, [server, rec]);

  const stop = useCallback(() => {
    if (!server) return recognizer?.stop();
    held.current = false;
    void finishServer();
  }, [server, finishServer]);

  return { listening, partial, unavailable, start, stop };
}

/**
 * Dictation into a text field: `toggle` starts and stops listening, and
 * `onText` receives the transcript (live with the phone's recogniser, at the
 * end with the server). `cancel` stops without adding anything.
 */
export function useDictation(onText: (transcript: string) => void) {
  const { ensure } = useAiConsent();
  const [listening, setListening] = useState(false);
  const viaServer = useRef(false);
  const busy = useRef(false);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);
  const rec = useServerRecorder();

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
    if (busy.current) return;
    if (listening) {
      if (!viaServer.current) return recognizer?.stop();
      // Stays "listening" until the words are in the field.
      busy.current = true;
      try {
        const t = await rec.finish();
        if (t) onTextRef.current(t);
      } catch {
        // Nothing usable came back; the field keeps what was typed.
      } finally {
        busy.current = false;
        setListening(false);
      }
      return;
    }
    // With server voice, ask for AI consent first; without it, the phone's recogniser (if any) is used.
    if (SERVER_VOICE && (await ensure().catch(() => false))) {
      busy.current = true;
      const ok = await rec.begin();
      busy.current = false;
      viaServer.current = ok;
      if (ok) setListening(true);
      return;
    }
    if (!recognizer || !(await recognizer.requestPermissionsAsync().then((r) => r.granted, () => false))) return;
    viaServer.current = false;
    stopSpeaking();
    recognizer.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
  }, [listening, ensure, rec]);

  const cancel = useCallback(() => {
    if (viaServer.current) {
      void rec.cancel();
      setListening(false);
    } else {
      recognizer?.abort();
    }
  }, [rec]);

  return { available: SERVER_VOICE || (!!recognizer && phoneRecognitionAvailable()), listening, toggle, cancel };
}

/**
 * Hands-free listening for voice mode: `listen()` opens the mic and stops on
 * its own when the user pauses; `onFinal` gets what they said and `onVolume`
 * the input level (0-1) for the orb.
 */
export function useConversationMic({ onFinal, onVolume }: { onFinal: (text: string) => void; onVolume?: (level: number) => void }) {
  const { consented } = useAiConsent();
  const server = SERVER_VOICE && consented;
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const latest = useRef('');
  const handlers = useRef({ onFinal, onVolume });
  useEffect(() => {
    handlers.current = { onFinal, onVolume };
  }, [onFinal, onVolume]);
  const rec = useServerRecorder();
  // Bumped by cancel(), so a transcript that arrives afterwards is dropped.
  const turn = useRef(0);

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

  const listenOnServer = useCallback(async () => {
    const mine = ++turn.current;
    const activity = new VoiceActivity(Date.now());
    let decided = false;
    const ended = async (outcome: 'done' | 'nothing') => {
      handlers.current.onVolume?.(0);
      if (outcome === 'nothing') {
        await rec.cancel();
        if (mine === turn.current) setListening(false);
        return;
      }
      setPartial('…');
      try {
        const text = await rec.finish();
        // Sent before `listening` drops, so voice mode doesn't reopen the mic in between.
        if (text && mine === turn.current) handlers.current.onFinal(text);
      } catch {
        // The server couldn't be reached; voice mode simply listens again.
      } finally {
        if (mine === turn.current) {
          setListening(false);
          setPartial('');
        }
      }
    };
    const ok = await rec.begin((db) => {
      handlers.current.onVolume?.(meterLevel(db));
      if (decided) return;
      const step = activity.push(db, Date.now());
      if (step === 'continue') return;
      decided = true;
      void ended(step);
    });
    if (ok && mine === turn.current) setListening(true);
  }, [rec]);

  const listen = useCallback(async () => {
    if (listening || starting.current) return;
    if (server) {
      starting.current = true;
      await listenOnServer();
      starting.current = false;
      return;
    }
    if (!recognizer) return;
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
  }, [listening, server, listenOnServer]);

  const cancel = useCallback(() => {
    latest.current = '';
    turn.current += 1;
    if (server) {
      void rec.cancel();
      setListening(false);
      setPartial('');
      handlers.current.onVolume?.(0);
      return;
    }
    recognizer?.abort();
  }, [server, rec]);

  return { available: server || (!!recognizer && phoneRecognitionAvailable()), listening, partial, listen, cancel };
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
