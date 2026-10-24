/**
 * Demo mode (EXPO_PUBLIC_DEMO=1): the app runs with no backend so it can be
 * shared as a clickable preview. Supabase and the RACO API are answered
 * in-memory with sample data. Production builds never set the flag.
 */
import { demoReply, VOICE_GUIDANCE, type ChatMode, type ChatStreamEvent } from '@raco/shared';
import { noteSampleError, previewSample, streamPreviewReply } from './preview-ai';

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const USER_ID = '00000000-0000-4000-8000-000000000001';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function sessionBody(email: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, exp, aud: 'authenticated', email })}.demo`,
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: exp,
    refresh_token: 'demo',
    user,
  };
}

interface DemoChat {
  id: string;
  title: string;
  updated_at: string;
  messages: { id: string; role: 'user' | 'assistant'; content: string; created_at: string }[];
}

const STORAGE_KEY = 'raco-demo-state';

const state = {
  email: 'sam@company.com',
  profile: {
    display_name: null as string | null,
    agent_name: 'Raco',
    interests: [] as string[],
    response_style: 'balanced',
    notification_prefs: {},
    onboarded_at: null as string | null,
    ai_consent_at: null as string | null,
  },
  chats: [] as DemoChat[],
};
loadState();

// The preview keeps its profile and chats in the browser, so a reload picks
// up where the viewer left off. Storage can be unavailable (private
// windows, blocked site data): the demo then just starts fresh each time.
function loadState() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch {
    // Start fresh.
  }
}

function saveState() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not saved; fine for a preview.
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Stands in for fetch() inside the Supabase client. */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : null;
  await new Promise((r) => setTimeout(r, 250));

  switch (url.pathname) {
    case '/auth/v1/otp':
      state.email = body?.email ?? state.email;
      saveState();
      return json({});
    case '/auth/v1/verify':
    case '/auth/v1/token':
      if (body?.email) state.email = body.email;
      return json(sessionBody(state.email));
    case '/auth/v1/user':
      return json(sessionBody(state.email).user);
    case '/auth/v1/logout':
      return json({}, 204);
    case '/rest/v1/profiles':
      if (method === 'PATCH') {
        Object.assign(state.profile, body);
        saveState();
        return json(null, 204);
      }
      return json(state.profile);
    case '/rest/v1/conversations': {
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace('eq.', '');
        state.chats = state.chats.filter((c) => c.id !== id);
        saveState();
        return json(null, 204);
      }
      const range = { 'content-range': `0-${Math.max(state.chats.length - 1, 0)}/${state.chats.length}` };
      if (method === 'HEAD') return new Response(null, { status: 200, headers: range });
      const list = [...state.chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return json(list.map(({ id, title, updated_at }) => ({ id, title, updated_at })), 200, range);
    }
    case '/rest/v1/messages': {
      const id = url.searchParams.get('conversation_id')?.replace('eq.', '');
      return json(state.chats.find((c) => c.id === id)?.messages ?? []);
    }
    default:
      return json({});
  }
}

/** Standing instructions for preview replies; mirrors the API's system prompt. */
function previewInstructions(mode: ChatMode = 'text'): string {
  const p = state.profile;
  return [
    `You are ${p.agent_name}, a private AI assistant in the RACO mobile app. You help people write, research, study, plan and think things through.`,
    mode === 'voice' ? VOICE_GUIDANCE : 'The user is on a phone. Format for a small screen: short paragraphs, plain Markdown, no wide tables unless asked.',
    'Give clear answers with just enough context to be useful.',
    p.display_name ? `The user's first name is ${p.display_name}.` : '',
    p.interests.length ? `They mainly want help with: ${p.interests.join(', ')}.` : '',
    'Reply to the conversation that follows.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Stands in for the RACO API's streaming chat endpoint. */
export async function* demoStreamChat(
  req: { conversationId?: string; message: string; mode?: ChatMode },
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const now = () => new Date().toISOString();
  let chat = state.chats.find((c) => c.id === req.conversationId);
  if (!chat) {
    chat = { id: `demo-${Date.now()}`, title: req.message.slice(0, 60), updated_at: now(), messages: [] };
    state.chats.push(chat);
  }
  chat.messages.push({ id: `m-${Date.now()}`, role: 'user', content: req.message, created_at: now() });
  saveState();
  yield { type: 'conversation', conversationId: chat.id, title: chat.title };

  let sent = '';
  const sample = await previewSample();
  if (sample) {
    // Real replies from Claude, through the preview viewer.
    const turns = [
      { role: 'user' as const, content: previewInstructions(req.mode) },
      ...chat.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    try {
      for await (const delta of streamPreviewReply(sample, turns, signal)) {
        sent += delta;
        yield { type: 'delta', text: delta };
      }
    } catch (err) {
      noteSampleError(err);
      if (!sent && (err as { code?: string })?.code !== 'cancelled') {
        yield* scripted();
      }
    }
  } else {
    yield* scripted();
  }

  async function* scripted(): AsyncGenerator<ChatStreamEvent> {
    await new Promise((r) => setTimeout(r, 700));
    const text = demoReply(req.message);
    for (const word of text.match(/\S+\s*/g) ?? []) {
      if (signal?.aborted) break;
      sent += word;
      yield { type: 'delta', text: word };
      await new Promise((r) => setTimeout(r, 28));
    }
  }
  const id = `m-${Date.now()}`;
  chat.messages.push({ id, role: 'assistant', content: sent, created_at: now() });
  chat.updated_at = now();
  saveState();
  yield { type: 'done', messageId: id };
}
