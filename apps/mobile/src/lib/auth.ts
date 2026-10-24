import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Supabase's PKCE helper needs crypto.getRandomValues, which Hermes lacks.
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto?.getRandomValues) {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: Crypto.getRandomValues };
}

export class AuthError extends Error {}

/** Sends a 6-digit sign-in code. Creates the account if it doesn't exist. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new AuthError(friendly(error.message));
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new AuthError('That code is wrong or has expired. Check it, or send a new one.');
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AuthError('Email or password is incorrect.');
}

export const appleSignInAvailable = Platform.OS === 'ios';

/** Native Sign in with Apple, exchanged for a Supabase session. */
export async function signInWithApple(): Promise<{ givenName: string | null } | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new AuthError('Apple did not return a sign-in token.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) throw new AuthError(friendly(error.message));
    // Apple only shares the name on the very first sign-in.
    return { givenName: credential.fullName?.givenName ?? null };
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw err instanceof AuthError ? err : new AuthError("Couldn't sign in with Apple. Please try again.");
  }
}

/** Google sign-in through the system browser (OAuth + PKCE). */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new AuthError("Couldn't start Google sign-in. Please try again.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new AuthError('Google sign-in was not completed.');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new AuthError("Couldn't finish Google sign-in. Please try again.");
  return true;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

function friendly(message: string): string {
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/invalid.*email/i.test(message)) return 'Enter a valid email address.';
  return 'Something went wrong. Please try again.';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
