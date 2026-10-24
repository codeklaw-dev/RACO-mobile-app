/**
 * Demo mode (EXPO_PUBLIC_DEMO=1): the app runs with no backend so it can be
 * shared as a clickable preview. Supabase and the RACO API are answered
 * in-memory with sample data. Production builds never set the flag.
 */
import { VOICE_GUIDANCE, type ChatMode, type ChatStreamEvent } from '@raco/shared';
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

const state = {
  email: 'sam@company.com',
  profile: {
    display_name: null as string | null,
    agent_name: 'Raco',
    interests: [] as string[],
    response_style: 'balanced',
    notification_prefs: {},
    onboarded_at: null as string | null,
  },
  chats: [] as DemoChat[],
};

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
        return json(null, 204);
      }
      return json(state.profile);
    case '/rest/v1/conversations': {
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace('eq.', '');
        state.chats = state.chats.filter((c) => c.id !== id);
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

const REPLIES: { match: RegExp; text: string }[] = [
  {
    match: /flashcard|exam|revise|study/i,
    text: `Happy to help you get ready. Here's a plan that fits the next three days:

**Day 1: map the material**
- List every topic on the syllabus
- Mark each one *confident*, *shaky* or *new*

**Day 2: work on the gaps**
1. Spend 25-minute blocks on each shaky topic
2. Test yourself with flashcards after each block

**Exam morning:** a quick review, not new material.

Paste in your lecture notes and I'll turn them into flashcards.`,
  },
  {
    match: /email|follow-up/i,
    text: `Here's a draft you can send as it is or adjust:

> Hi Priya,
>
> Thanks again for your time on Tuesday. I wanted to follow up on the launch timeline. Could we confirm the **14 November** date by Friday, so the team can lock the release plan?
>
> Best,
> Sam

Want it shorter, or more formal?`,
  },
  {
    match: /plan|week|schedule|deadline/i,
    text: `Let's build your week. Tell me your three deadlines and roughly how long each needs. In the meantime, here's a shape that works for most people:

- **Mornings:** deep work on the hardest deadline
- **After lunch:** meetings and messages
- **Late afternoon:** the smaller tasks

I'll turn it into a day-by-day schedule once I know what's due.`,
  },
];

const FALLBACK = `This is a preview, so my replies are samples rather than real AI answers. In the full app I'll answer anything you ask, read files you share, and talk with you by voice.

Try one of the suggestions on the home screen to see how replies look.`;

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
    const text = REPLIES.find((r) => r.match.test(req.message))?.text ?? FALLBACK;
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
  yield { type: 'done', messageId: id };
}
