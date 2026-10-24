import { serve } from '@hono/node-server';
import { createApp } from './app';
import { supabaseTokenVerifier } from './auth';
import { loadEnv } from './env';
import { AnthropicLlm } from './llm';
import { devTokenVerifier, MemoryStore } from './memory-store';
import { SupabaseStore } from './store';
import { OpenAICompatibleLlm, OpenAICompatibleVoiceInterpreter } from './openai-compatible';
import { ClaudeVoiceInterpreter } from './voice';

const env = loadEnv();

const log = (msg: string, err?: unknown) => console.error(msg, err);

function models() {
  if (env.LLM_PROVIDER === 'openai-compatible') {
    const cfg = { baseUrl: env.LLM_BASE_URL!, apiKey: env.LLM_API_KEY!, model: env.CHAT_MODEL! };
    const voice = { ...cfg, model: env.VOICE_MODEL ?? cfg.model };
    return { llm: new OpenAICompatibleLlm(cfg), voice: new OpenAICompatibleVoiceInterpreter(voice, log) };
  }
  const key = env.ANTHROPIC_API_KEY!;
  return {
    llm: new AnthropicLlm(key, env.CHAT_MODEL ?? 'claude-opus-5-5'),
    voice: new ClaudeVoiceInterpreter(key, env.VOICE_MODEL ?? 'claude-haiku-5-5', log),
  };
}

function data() {
  if (env.STORE === 'memory') {
    console.warn('STORE=memory: data is kept in memory and anyone can sign in with "dev:<name>". Local use only.');
    return { verifyToken: devTokenVerifier, store: new MemoryStore() };
  }
  return {
    verifyToken: supabaseTokenVerifier(env.SUPABASE_URL!),
    store: new SupabaseStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  };
}

const app = createApp({
  ...data(),
  ...models(),
  corsOrigins: env.CORS_ORIGINS,
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`RACO API listening on http://localhost:${info.port}`);
});
