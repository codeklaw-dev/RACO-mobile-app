import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthUser {
  id: string;
  email?: string;
}

export type VerifyToken = (token: string) => Promise<AuthUser | null>;

/**
 * Verifies Supabase access tokens against the project's published signing
 * keys, so the API never needs the JWT secret.
 */
export function supabaseTokenVerifier(supabaseUrl: string): VerifyToken {
  const issuer = new URL('/auth/v1', supabaseUrl).toString();
  const jwks = createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl));

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' });
      if (typeof payload.sub !== 'string') return null;
      return {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };
    } catch {
      return null;
    }
  };
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
