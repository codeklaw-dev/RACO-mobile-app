import { serve } from '@hono/node-server';
import { createApp } from './app';
import { supabaseTokenVerifier } from './auth';
import { loadEnv } from './env';
import { AnthropicLlm } from './llm';
import { SupabaseStore } from './store';

const env = loadEnv();

const app = createApp({
  verifyToken: supabaseTokenVerifier(env.SUPABASE_URL),
  store: new SupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  llm: new AnthropicLlm(env.ANTHROPIC_API_KEY, env.CHAT_MODEL),
  corsOrigins: env.CORS_ORIGINS,
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`RACO API listening on http://localhost:${info.port}`);
});
