import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ChatStreamEvent } from '@raco/shared';
import { createApp, HISTORY_LIMIT } from '../src/app';
import { DemoLlm } from '../src/demo';
import { devTokenVerifier } from '../src/memory-store';
import type { CompletionEvent, CompletionRequest, Llm } from '../src/llm';
import { buildSystemPrompt, titleFromMessage } from '../src/prompt';
import { demoReply, interpretLocally } from '@raco/shared';
import type { Conversation, Store, StoredMessage, UsageRecord, UserContext } from '../src/store';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';

function baseContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: USER_ID,
    workspaceId: 'ws-1',
    plan: 'free',
    displayName: 'Sam',
    agentName: 'Raco',
    interests: ['Writing', 'Research'],
    responseStyle: 'balanced',
    ...overrides,
  };
}

class MemoryStore implements Store {
  contexts = new Map<string, UserContext>([[USER_ID, baseContext()]]);
  conversations: (Conversation & { userId: string })[] = [];
  messages: (StoredMessage & { conversationId: string; userId: string })[] = [];
  usage: UsageRecord[] = [];
  priorMessagesToday = 0;

  async getUserContext(userId: string) {
    return this.contexts.get(userId) ?? null;
  }
  async countUserMessagesSince() {
    return this.priorMessagesToday;
  }
  async getConversation(id: string, userId: string) {
    return this.conversations.find((c) => c.id === id && c.userId === userId) ?? null;
  }
  async createConversation(ctx: UserContext, title: string) {
    const conv = { id: randomUUID(), title, userId: ctx.userId };
    this.conversations.push(conv);
    return { id: conv.id, title };
  }
  async recentMessages(conversationId: string, limit: number) {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .slice(-limit)
      .map(({ role, content }) => ({ role, content }));
  }
  async insertMessage(ctx: UserContext, conversationId: string, role: 'user' | 'assistant', content: string) {
    this.messages.push({ conversationId, userId: ctx.userId, role, content });
    return `msg-${this.messages.length}`;
  }
  async touchConversation() {}
  async recordUsage(u: UsageRecord) {
    this.usage.push(u);
  }
  deleted: string[] = [];
  async deleteUser(userId: string) {
    this.deleted.push(userId);
  }
}

class FakeLlm implements Llm {
  requests: CompletionRequest[] = [];
  constructor(private readonly script: (req: CompletionRequest) => AsyncIterable<CompletionEvent>) {}
  stream(req: CompletionRequest) {
    this.requests.push(req);
    return this.script(req);
  }
}

const usage = {
  model: 'claude-opus-5-5',
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

function replying(...chunks: string[]) {
  return new FakeLlm(async function* () {
    for (const text of chunks) yield { type: 'text', text };
    yield { type: 'done', usage, refused: false };
  });
}

function setup(llm: Llm = replying('Hello', ' Sam!'), store = new MemoryStore()) {
  const app = createApp({
    store,
    llm,
    voice: { interpret: async (req) => interpretLocally(req) },
    verifyToken: async (token) =>
      token === 'good' ? { id: USER_ID } : token === 'other' ? { id: OTHER_USER } : null,
    log: () => {},
  });
  const chat = (body: unknown, token = 'good') =>
    app.request('/v1/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { app, store, chat };
}

async function events(res: Response): Promise<ChatStreamEvent[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()) as ChatStreamEvent);
}

describe('POST /v1/chat', () => {
  it('rejects requests without a valid token', async () => {
    const { chat } = setup();
    const res = await chat({ message: 'hi' }, 'bad');
    expect(res.status).toBe(401);
  });

  it('rejects empty messages', async () => {
    const { chat } = setup();
    const res = await chat({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('creates a conversation, streams the reply and stores both messages', async () => {
    const { chat, store } = setup();
    const res = await chat({ message: 'Hi there' });

    expect(res.status).toBe(200);
    const conversationId = store.conversations[0]!.id;
    expect(await events(res)).toEqual([
      { type: 'conversation', conversationId, title: 'Hi there' },
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ' Sam!' },
      { type: 'done', messageId: 'msg-2' },
    ]);
    expect(store.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Hi there'],
      ['assistant', 'Hello Sam!'],
    ]);
    expect(store.usage).toHaveLength(1);
    expect(store.usage[0]).toMatchObject({ workspaceId: 'ws-1', conversationId, outputTokens: 5 });
  });

  it('sends earlier turns as history when continuing a conversation', async () => {
    const llm = replying('Sure.');
    const { chat, store } = setup(llm);
    await events(await chat({ message: 'One' }));
    const conversationId = store.conversations[0]!.id;

    await events(await chat({ conversationId, message: 'Two' }));
    expect(llm.requests.at(-1)!.messages.map((m) => m.content)).toEqual(['One', 'Sure.', 'Two']);
    expect(store.conversations).toHaveLength(1);
  });

  it("does not let a user continue someone else's conversation", async () => {
    const store = new MemoryStore();
    store.contexts.set(OTHER_USER, baseContext({ userId: OTHER_USER }));
    store.conversations.push({ id: '44444444-4444-4444-8444-444444444444', title: 'Mine', userId: USER_ID });
    const { chat } = setup(replying('x'), store);

    const res = await chat({ conversationId: '44444444-4444-4444-8444-444444444444', message: 'hi' }, 'other');
    expect(res.status).toBe(404);
  });

  it('enforces the daily message limit for the plan', async () => {
    const store = new MemoryStore();
    store.priorMessagesToday = 40;
    const { chat } = setup(replying('x'), store);
    const res = await chat({ message: 'hi' });
    expect(res.status).toBe(429);
    expect(store.messages).toHaveLength(0);
  });

  it('reports a refusal instead of storing an empty reply', async () => {
    const llm = new FakeLlm(async function* () {
      yield { type: 'done', usage, refused: true };
    });
    const { chat, store } = setup(llm);
    const evs = await events(await chat({ message: 'hi' }));
    expect(evs.at(-1)).toMatchObject({ type: 'error', code: 'refused' });
    expect(store.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('keeps the partial reply and reports an error when the model fails mid-stream', async () => {
    const llm = new FakeLlm(async function* () {
      yield { type: 'text', text: 'Partial' };
      throw new Error('boom');
    });
    const { chat, store } = setup(llm);
    const evs = await events(await chat({ message: 'hi' }));
    expect(evs.at(-1)).toMatchObject({ type: 'error', code: 'upstream_error' });
    expect(store.messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Partial' });
  });

  it('caps history at HISTORY_LIMIT messages', async () => {
    const store = new MemoryStore();
    const convId = '55555555-5555-4555-8555-555555555555';
    store.conversations.push({ id: convId, title: 't', userId: USER_ID });
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      store.messages.push({ conversationId: convId, userId: USER_ID, role: i % 2 ? 'assistant' : 'user', content: `${i}` });
    }
    const llm = replying('ok');
    const { chat } = setup(llm, store);
    await events(await chat({ conversationId: convId, message: 'latest' }));
    expect(llm.requests[0]!.messages).toHaveLength(HISTORY_LIMIT);
    expect(llm.requests[0]!.messages.at(-1)!.content).toBe('latest');
  });
});

describe('DELETE /v1/account', () => {
  it('deletes only the signed-in user', async () => {
    const { app, store } = setup();
    const res = await app.request('/v1/account', { method: 'DELETE', headers: { Authorization: 'Bearer good' } });
    expect(res.status).toBe(204);
    expect(store.deleted).toEqual([USER_ID]);
  });

  it('requires a valid token', async () => {
    const { app, store } = setup();
    const res = await app.request('/v1/account', { method: 'DELETE' });
    expect(res.status).toBe(401);
    expect(store.deleted).toEqual([]);
  });
});

describe('POST /v1/onboarding/voice-turn', () => {
  const post = (app: ReturnType<typeof setup>['app'], body: unknown, token = 'good') =>
    app.request('/v1/onboarding/voice-turn', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('returns what Raco understood', async () => {
    const { app } = setup();
    const res = await post(app, { step: 'name', transcript: "I'm Sam", agentName: 'Raco' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ understood: true, displayName: 'Sam' });
  });

  it('rejects unknown steps and unauthenticated calls', async () => {
    const { app } = setup();
    expect((await post(app, { step: 'nope', transcript: 'x', agentName: 'Raco' })).status).toBe(400);
    expect((await post(app, { step: 'name', transcript: 'Sam', agentName: 'Raco' }, 'bad')).status).toBe(401);
  });
});

describe('prompt helpers', () => {
  it('builds a stable system prompt from the profile', () => {
    const prompt = buildSystemPrompt(baseContext({ agentName: 'Nova', responseStyle: 'concise' }));
    expect(prompt).toContain('You are Nova');
    expect(prompt).toContain("first name is Sam");
    expect(prompt).toContain('Writing, Research');
    expect(prompt).toContain('short and direct');
    expect(buildSystemPrompt(baseContext())).toBe(buildSystemPrompt(baseContext()));
  });

  it('asks for short spoken replies in voice mode', () => {
    const prompt = buildSystemPrompt(baseContext(), 'voice');
    expect(prompt).toContain('read aloud');
    expect(prompt).not.toContain('Markdown, no wide tables');
  });

  it('titles long messages at a word boundary', () => {
    expect(titleFromMessage('Short one')).toBe('Short one');
    const title = titleFromMessage('Help me revise for my exam on Friday about cell biology and genetics please');
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });
});

describe('devTokenVerifier', () => {
  it('accepts only dev:<name> tokens', async () => {
    expect(await devTokenVerifier('dev:sam')).toEqual({ id: 'sam' });
    expect(await devTokenVerifier('eyJhbGciOi.x.y')).toBeNull();
    expect(await devTokenVerifier('dev:../etc')).toBeNull();
  });
});

describe('DemoLlm', () => {
  it('streams the sample reply for the last user message', async () => {
    const events = [];
    for await (const e of new DemoLlm(0).stream({ system: '', messages: [{ role: 'user', content: 'Plan my week' }] })) events.push(e);
    const text = events.flatMap((e) => (e.type === 'text' ? [e.text] : [])).join('');
    expect(text).toBe(demoReply('Plan my week'));
    expect(events.at(-1)).toMatchObject({ type: 'done', refused: false, usage: { model: 'demo' } });
  });
});
