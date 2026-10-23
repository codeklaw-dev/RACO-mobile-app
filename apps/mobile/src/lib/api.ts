import { fetch } from 'expo/fetch';
import type { ChatErrorCode, ChatRequest, ChatStreamEvent } from '@raco/shared';
import { config } from './config';
import { DEMO, demoStreamChat } from './demo';
import { SseParser } from './sse';
import { supabase } from './supabase';

export class ChatError extends Error {
  constructor(
    public readonly code: ChatErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Sends a message and yields the reply as it streams. Abort the signal to
 * stop generation (the server keeps whatever was already written).
 */
export async function* streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  if (DEMO) {
    yield* demoStreamChat(req, signal);
    return;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ChatError('unauthorized', 'Sign in again to continue.');

  let res;
  try {
    res = await fetch(`${config.apiUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(req),
      signal,
    });
  } catch {
    if (signal?.aborted) return;
    throw new ChatError('upstream_error', "Couldn't reach Raco. Check your connection and try again.");
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code: ChatErrorCode; message: string } } | null;
    throw new ChatError(body?.error?.code ?? 'internal', body?.error?.message ?? 'Something went wrong. Please try again.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const data of parser.push(decoder.decode(value, { stream: true }))) {
        yield JSON.parse(data) as ChatStreamEvent;
      }
    }
  } catch {
    if (signal?.aborted) return;
    throw new ChatError('upstream_error', 'The connection dropped. Please try again.');
  } finally {
    reader.releaseLock();
  }
}

/** Permanently deletes the signed-in user's account and data. */
export async function deleteAccount(): Promise<void> {
  if (DEMO) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ChatError('unauthorized', 'Sign in again to continue.');
  const res = await fetch(`${config.apiUrl}/v1/account`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ChatError('internal', "Couldn't delete your account. Please try again.");
}
