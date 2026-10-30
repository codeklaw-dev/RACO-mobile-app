import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';
import { OpenAICompatibleLlm, OpenAICompatibleVoiceInterpreter } from '../src/openai-compatible';

/** A fetch that answers like an OpenAI-compatible server and records requests. */
function fakeServer(reply: (body: Record<string, unknown>) => Response) {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ url: String(url), headers: new Headers(init?.headers), body });
    return reply(body);
  }) as typeof fetch;
  return { fetchImpl, requests };
}

function sse(chunks: string[]) {
  const stream = new ReadableStream({
    start(c) {
      for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
      c.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}

const delta = (content: string) => `data: ${JSON.stringify({ model: 'my-model', choices: [{ delta: { content } }] })}\n\n`;

describe('OpenAICompatibleLlm', () => {
  it('streams text and usage, with chunks split anywhere', async () => {
    const usage = `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } })}\n\n`;
    const all = delta('Hello') + delta(' Sam') + usage + 'data: [DONE]\n\n';
    // Split the byte stream at awkward places.
    const { fetchImpl, requests } = fakeServer(() => sse([all.slice(0, 17), all.slice(17, 60), all.slice(60)]));
    const llm = new OpenAICompatibleLlm({ baseUrl: 'https://models.example/v1/', apiKey: 'k', model: 'my-model', fetch: fetchImpl });

    const events = [];
    for await (const e of llm.stream({ system: 'Be kind', messages: [{ role: 'user', content: 'Hi' }] })) events.push(e);

    expect(events).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' Sam' },
      { type: 'done', refused: false, usage: { model: 'my-model', inputTokens: 12, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    ]);
    expect(requests[0]!.url).toBe('https://models.example/v1/chat/completions');
    expect(requests[0]!.headers.get('authorization')).toBe('Bearer k');
    expect(requests[0]!.headers.get('ngrok-skip-browser-warning')).toBe('true');
    expect(requests[0]!.body).toMatchObject({
      model: 'my-model',
      stream: true,
      messages: [
        { role: 'system', content: 'Be kind' },
        { role: 'user', content: 'Hi' },
      ],
    });
  });

  it('handles endpoints that already end in /chat/completions without duplicating', async () => {
    const { fetchImpl, requests } = fakeServer(() => sse([delta('ok'), 'data: [DONE]\n\n']));
    const llm = new OpenAICompatibleLlm({
      baseUrl: 'https://models.example/v1/chat/completions',
      apiKey: 'k',
      model: 'my-model',
      fetch: fetchImpl,
    });
    const events = [];
    for await (const e of llm.stream({ system: '', messages: [] })) events.push(e);
    expect(requests[0]!.url).toBe('https://models.example/v1/chat/completions');
  });

  it('handles reasoning delta chunks and falls back to reasoning if content is empty', async () => {
    const reasoningDelta = (reasoning: string) => `data: ${JSON.stringify({ choices: [{ delta: { reasoning } }] })}\n\n`;
    const all = reasoningDelta('Thinking...') + reasoningDelta(' Done.') + 'data: [DONE]\n\n';
    const { fetchImpl } = fakeServer(() => sse([all]));
    const llm = new OpenAICompatibleLlm({ baseUrl: 'https://m/v1', apiKey: 'k', model: 'x', fetch: fetchImpl });
    const events = [];
    for await (const e of llm.stream({ system: '', messages: [] })) events.push(e);
    expect(events[0]).toEqual({ type: 'text', text: 'Thinking... Done.' });
  });

  it('throws on a server error so the chat route reports it', async () => {
    const { fetchImpl } = fakeServer(() => new Response('bad key', { status: 401 }));
    const llm = new OpenAICompatibleLlm({ baseUrl: 'https://m/v1', apiKey: 'k', model: 'x', fetch: fetchImpl });
    await expect(async () => {
      for await (const _ of llm.stream({ system: '', messages: [] })) void _;
    }).rejects.toThrow(/401/);
  });
});

describe('OpenAICompatibleVoiceInterpreter', () => {
  const req = { step: 'name' as const, transcript: "I'm Sam", agentName: 'Raco' };
  const completion = (content: string) => Response.json({ choices: [{ message: { content } }] });

  it('uses the model answer when it matches the schema, even wrapped in prose', async () => {
    const json = JSON.stringify({ understood: true, wantsTour: false, say: 'Lovely to meet you, Sam.', displayName: 'Sam', agentName: null, interests: null, callsAllowed: null });
    const { fetchImpl } = fakeServer(() => completion(`Here you go:\n\`\`\`json\n${json}\n\`\`\``));
    const voice = new OpenAICompatibleVoiceInterpreter({ baseUrl: 'https://m/v1', apiKey: 'k', model: 'x', fetch: fetchImpl });
    expect(await voice.interpret(req)).toEqual({ understood: true, wantsTour: false, say: 'Lovely to meet you, Sam.', displayName: 'Sam' });
  });

  it('falls back to the rule-based reader when the reply is unusable', async () => {
    const { fetchImpl } = fakeServer(() => completion('Sorry, I cannot do JSON.'));
    const voice = new OpenAICompatibleVoiceInterpreter({ baseUrl: 'https://m/v1', apiKey: 'k', model: 'x', fetch: fetchImpl });
    expect(await voice.interpret(req)).toMatchObject({ understood: true, displayName: 'Sam', say: 'Nice to meet you, Sam.' });
  });
});

describe('loadEnv', () => {
  const base = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 's' };

  it('defaults to the demo provider, which needs no keys', () => {
    expect(loadEnv(base).LLM_PROVIDER).toBe('demo');
  });

  it('refuses the demo provider and memory store in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/LLM_PROVIDER/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', STORE: 'memory', LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'a' })).toThrow(/STORE/);
  });

  it('requires the Anthropic key for Claude', () => {
    expect(() => loadEnv({ ...base, LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(loadEnv({ ...base, LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'a' }).LLM_PROVIDER).toBe('anthropic');
  });

  it('requires base URL, key and model for an OpenAI-compatible server', () => {
    expect(() => loadEnv({ ...base, LLM_PROVIDER: 'openai-compatible' })).toThrow(/LLM_BASE_URL.*LLM_API_KEY.*CHAT_MODEL/);
    const env = loadEnv({ ...base, LLM_PROVIDER: 'openai-compatible', LLM_BASE_URL: 'https://m.example/v1', LLM_API_KEY: 'k', CHAT_MODEL: 'm' });
    expect(env.LLM_BASE_URL).toBe('https://m.example/v1');
  });

  it('accepts LLM_CHAT_URL and LLM_MODEL as aliases for openai-compatible', () => {
    const env = loadEnv({
      ...base,
      LLM_CHAT_URL: 'https://m.example/v1/chat/completions',
      LLM_MODEL: 'qwen3',
      LLM_API_KEY: 'k',
    });
    expect(env.LLM_PROVIDER).toBe('openai-compatible');
    expect(env.LLM_BASE_URL).toBe('https://m.example/v1/chat/completions');
    expect(env.CHAT_MODEL).toBe('qwen3');
  });
});
