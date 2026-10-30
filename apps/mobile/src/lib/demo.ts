/**
 * Demo mode (EXPO_PUBLIC_DEMO=1): the app runs with no backend so it can be
 * shared as a clickable preview. Supabase and the RACO API are answered
 * in-memory with sample data. Production builds never set the flag.
 */
import { demoReply, VOICE_GUIDANCE, type ChatMode, type ChatStreamEvent } from '@raco/shared';
import { fetch as expoFetch } from 'expo/fetch';
import { config, DEMO } from './config';
import { noteSampleError, previewSample, streamPreviewReply } from './preview-ai';
import { SseParser } from './sse';

export { DEMO };
const netFetch = typeof expoFetch === 'function' ? expoFetch : globalThis.fetch;

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
  project_id?: string | null;
  pinned_at?: string | null;
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
  projects: [] as Row[],
  tasks: [] as Row[],
  library: [] as Row[],
  seeded: false,
};
loadState();
seed();

type Row = Record<string, unknown> & { id: string };

/** Sample projects and tasks so the preview isn't empty on first open. */
function seed() {
  if (state.seeded) return;
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const project = (id: string, name: string, description: string, days: number) => ({ id, name, description, created_at: at(days), updated_at: at(days) });
  const task = (id: string, title: string, project_id: string | null, days: number, done = false) => ({
    id,
    title,
    notes: '',
    project_id,
    done_at: done ? at(days / 2) : null,
    created_at: at(days),
    updated_at: at(days),
  });
  state.projects = [
    project('p-launch', 'Product launch', 'Plan the November release: messaging, timeline and launch-day checklist.', 1),
    project('p-thesis', 'Thesis research', 'Sources, outlines and drafts for chapter three.', 3),
    project('p-home', 'Home move', 'Movers, utilities and the change-of-address list.', 6),
  ];
  state.tasks = [
    task('t-1', 'Draft the launch announcement', 'p-launch', 1),
    task('t-2', 'Confirm the 14 November date with Priya', 'p-launch', 2),
    task('t-3', 'List three competitors to compare', 'p-launch', 4, true),
    task('t-4', 'Summarise the five core papers', 'p-thesis', 3),
    task('t-5', 'Book the movers', 'p-home', 5),
    task('t-6', 'Renew passport', null, 2),
  ];
  state.seeded = true;
  saveState();
}

const TABLES = { projects: () => state.projects, tasks: () => state.tasks, library_items: () => state.library } as const;

/** A small PostgREST stand-in: eq/is filters, order, limit, insert, update, delete. */
function table(name: keyof typeof TABLES, url: URL, method: string, headers: Headers, body: unknown): Response {
  const rows = TABLES[name]();
  const filters = [...url.searchParams].filter(([k]) => !['select', 'order', 'limit', 'offset', 'columns'].includes(k));
  const matches = (r: Row) =>
    filters.every(([k, v]) => (v === 'is.null' ? r[k] == null : v === 'not.is.null' ? r[k] != null : v.startsWith('eq.') ? String(r[k]) === v.slice(3) : true));
  const one = headers.get('accept')?.includes('vnd.pgrst.object');
  const wantsRows = headers.get('prefer')?.includes('return=representation');
  const reply = (list: Row[], status = 200) => (one ? (list[0] ? json(list[0], status) : json({ message: 'not found' }, 406)) : json(list, status));
  const now = new Date().toISOString();

  switch (method) {
    case 'POST': {
      const added = (Array.isArray(body) ? body : [body]).map((b) => ({
        id: `${name[0]}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: now,
        updated_at: now,
        ...(name === 'tasks' ? { notes: '', project_id: null, done_at: null } : name === 'projects' ? { description: '' } : { conversation_id: null }),
        ...(b as object),
      }));
      rows.unshift(...added);
      saveState();
      return wantsRows ? reply(added, 201) : json(null, 201);
    }
    case 'PATCH': {
      const changed = rows.filter(matches);
      for (const r of changed) Object.assign(r, body, { updated_at: now });
      saveState();
      return wantsRows ? reply(changed) : json(null, 204);
    }
    case 'DELETE': {
      const gone = new Set(rows.filter(matches).map((r) => r.id));
      TABLES[name]().splice(0, rows.length, ...rows.filter((r) => !gone.has(r.id)));
      if (name === 'projects') {
        for (const t of state.tasks) if (gone.has(t.project_id as string)) t.project_id = null;
        for (const c of state.chats) if (c.project_id && gone.has(c.project_id)) c.project_id = null;
      }
      saveState();
      return json(null, 204);
    }
    default: {
      let list = rows.filter(matches);
      const [col, dir] = (url.searchParams.get('order') ?? 'created_at.desc').split('.');
      list = [...list].sort((a, b) => String(a[col!] ?? '').localeCompare(String(b[col!] ?? '')) * (dir === 'asc' ? 1 : -1));
      const range = { 'content-range': `0-${Math.max(list.length - 1, 0)}/${list.length}` };
      if (method === 'HEAD') return new Response(null, { status: 200, headers: range });
      const limit = Number(url.searchParams.get('limit') ?? list.length);
      return one ? reply(list) : json(list.slice(0, limit), 200, range);
    }
  }
}

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
  const headers = new Headers(init?.headers);
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
    case '/rest/v1/projects':
      return table('projects', url, method, headers, body);
    case '/rest/v1/tasks':
      return table('tasks', url, method, headers, body);
    case '/rest/v1/library_items':
      return table('library_items', url, method, headers, body);
    case '/rest/v1/conversations': {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (method === 'DELETE') {
        state.chats = state.chats.filter((c) => c.id !== id);
        saveState();
        return json(null, 204);
      }
      if (method === 'PATCH') {
        const chat = state.chats.find((c) => c.id === id);
        if (chat) Object.assign(chat, body);
        saveState();
        return json(null, 204);
      }
      const project = url.searchParams.get('project_id')?.replace('eq.', '');
      const list = [...state.chats]
        .filter((c) => !project || c.project_id === project)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const range = { 'content-range': `0-${Math.max(list.length - 1, 0)}/${list.length}` };
      if (method === 'HEAD') return new Response(null, { status: 200, headers: range });
      return json(
        list.map(({ id, title, updated_at, project_id, pinned_at }) => ({ id, title, updated_at, project_id: project_id ?? null, pinned_at: pinned_at ?? null })),
        200,
        range,
      );
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

/** Streams live text from the configured OpenAI-compatible LLM directly in Expo Go / demo mode. */
async function* streamLlmDirect(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const rawUrl = config.llmChatUrl.replace(/\/+$/, '');
  const url = rawUrl.endsWith('/chat/completions') ? rawUrl : `${rawUrl}/chat/completions`;

  const res = await netFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.llmApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({
      model: config.llmModel || 'qwen3',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`LLM returned ${res.status}`);
  }

  let sentAnyText = false;
  let reasoningBuffer = '';
  const parser = new SseParser();

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const data of parser.push(decoder.decode(value, { stream: true }))) {
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data) as {
              choices?: {
                delta?: {
                  content?: string | null;
                  reasoning?: string | null;
                  reasoning_content?: string | null;
                };
              }[];
            };
            const delta = chunk.choices?.[0]?.delta;
            const text = delta?.content;
            if (text) {
              sentAnyText = true;
              yield text;
            } else {
              const reasoning = delta?.reasoning ?? delta?.reasoning_content;
              if (reasoning) reasoningBuffer += reasoning;
            }
          } catch {
            // ignore partial JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const fullText = await res.text();
    for (const data of parser.push(fullText)) {
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: {
            delta?: {
              content?: string | null;
              reasoning?: string | null;
              reasoning_content?: string | null;
            };
          }[];
        };
        const delta = chunk.choices?.[0]?.delta;
        const text = delta?.content;
        if (text) {
          sentAnyText = true;
          yield text;
        } else {
          const reasoning = delta?.reasoning ?? delta?.reasoning_content;
          if (reasoning) reasoningBuffer += reasoning;
        }
      } catch {
        // ignore partial JSON
      }
    }
  }

  if (!sentAnyText && reasoningBuffer) {
    yield reasoningBuffer;
  }
}

/** Stands in for the RACO API's streaming chat endpoint. */
export async function* demoStreamChat(
  req: { conversationId?: string; projectId?: string; message: string; mode?: ChatMode },
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const now = () => new Date().toISOString();
  let chat = state.chats.find((c) => c.id === req.conversationId);
  if (!chat) {
    chat = { id: `demo-${Date.now()}`, title: req.message.slice(0, 60), updated_at: now(), project_id: req.projectId ?? null, messages: [] };
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
  } else if (config.llmChatUrl && config.llmApiKey) {
    // Real replies from the configured LLM in Expo Go / Demo mode.
    try {
      for await (const delta of streamLlmDirect(chat.messages, previewInstructions(req.mode), signal)) {
        sent += delta;
        yield { type: 'delta', text: delta };
      }
    } catch (err) {
      console.warn('Direct LLM stream failed in Expo Go, falling back to scripted', err);
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
