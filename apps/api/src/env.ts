import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // "anthropic" (Claude) or "openai-compatible" (your own model server).
  LLM_PROVIDER: z.enum(['anthropic', 'openai-compatible']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.url().optional(),
  LLM_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().min(1).optional(),
  // Voice onboarding only extracts a name or a yes/no, so a small model is enough.
  VOICE_MODEL: z.string().min(1).optional(),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
});

const checkedEnvSchema = envSchema.superRefine((env, ctx) => {
  const need = (key: keyof typeof env) => {
    if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required for LLM_PROVIDER=${env.LLM_PROVIDER}` });
  };
  if (env.LLM_PROVIDER === 'anthropic') need('ANTHROPIC_API_KEY');
  else {
    need('LLM_BASE_URL');
    need('LLM_API_KEY');
    need('CHAT_MODEL');
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = checkedEnvSchema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }
  return parsed.data;
}
