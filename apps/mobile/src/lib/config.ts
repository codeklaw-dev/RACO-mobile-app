/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values are bundled into
 * the app, and none of them are secrets: the Supabase publishable key is
 * designed to ship in clients, and row level security protects the data.
 */
import { DEMO } from './demo';

function required(name: string, value: string | undefined): string {
  // Demo builds answer everything in-memory, so no backend is configured.
  if (DEMO) return value ?? 'https://demo.invalid';
  if (!value) {
    throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.`);
  }
  return value;
}

export const config = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, ''),
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://racoai.io/terms',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://racoai.io/privacy',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@racoai.io',
  /** Who receives chat data, named in the consent prompt (Guideline 5.1.2(i)). */
  aiProvider: process.env.EXPO_PUBLIC_AI_PROVIDER ?? 'Anthropic',
};
