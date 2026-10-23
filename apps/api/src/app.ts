import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import {
  DAILY_MESSAGE_LIMITS,
  chatRequestSchema,
  type ChatErrorCode,
  type ChatStreamEvent,
} from '@raco/shared';
import { bearerToken, type AuthUser, type VerifyToken } from './auth';
import type { Llm } from './llm';
import { buildSystemPrompt, titleFromMessage } from './prompt';
import type { Store } from './store';

/** How many earlier messages are sent to the model with each turn. */
export const HISTORY_LIMIT = 40;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AppDeps {
  verifyToken: VerifyToken;
  store: Store;
  llm: Llm;
  corsOrigins?: string[];
  log?: (msg: string, err?: unknown) => void;
}

type Vars = { Variables: { user: AuthUser } };

export function createApp(deps: AppDeps) {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));
  const app = new Hono<Vars>();

  if (deps.corsOrigins?.length) {
    app.use('*', cors({ origin: deps.corsOrigins, allowHeaders: ['Authorization', 'Content-Type'] }));
  }

  app.get('/health', (c) => c.json({ ok: true }));

  app.use('/v1/*', async (c, next) => {
    const token = bearerToken(c.req.header('Authorization'));
    const user = token ? await deps.verifyToken(token) : null;
    if (!user) return c.json(errorBody('unauthorized', 'Sign in again to continue.'), 401);
    c.set('user', user);
    await next();
  });

  app.post('/v1/chat', async (c) => {
    const user = c.get('user');
    const parsed = chatRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errorBody('invalid_request', 'That message could not be sent.'), 400);
    }
    const { conversationId, message } = parsed.data;

    const ctx = await deps.store.getUserContext(user.id);
    if (!ctx) return c.json(errorBody('unauthorized', 'Your account is not set up yet.'), 403);

    const used = await deps.store.countUserMessagesSince(user.id, new Date(Date.now() - DAY_MS));
    if (used >= DAILY_MESSAGE_LIMITS[ctx.plan]) {
      return c.json(
        errorBody('quota_exceeded', "You've reached today's message limit. It resets within 24 hours."),
        429,
      );
    }

    let conversation;
    if (conversationId) {
      conversation = await deps.store.getConversation(conversationId, user.id);
      if (!conversation) return c.json(errorBody('not_found', 'That chat no longer exists.'), 404);
    } else {
      conversation = await deps.store.createConversation(ctx, titleFromMessage(message));
    }

    await deps.store.insertMessage(ctx, conversation.id, 'user', message);
    const history = await deps.store.recentMessages(conversation.id, HISTORY_LIMIT);

    return streamSSE(c, async (sse) => {
      const send = (event: ChatStreamEvent) => sse.writeSSE({ data: JSON.stringify(event) });
      const abort = new AbortController();
      sse.onAbort(() => abort.abort());

      await send({ type: 'conversation', conversationId: conversation.id, title: conversation.title });

      let reply = '';
      try {
        for await (const event of deps.llm.stream({
          system: buildSystemPrompt(ctx),
          messages: history,
          signal: abort.signal,
        })) {
          if (event.type === 'text') {
            reply += event.text;
            await send({ type: 'delta', text: event.text });
            continue;
          }

          await deps.store.recordUsage({
            workspaceId: ctx.workspaceId,
            userId: ctx.userId,
            conversationId: conversation.id,
            ...event.usage,
          });

          if (event.refused && !reply) {
            await send({
              type: 'error',
              code: 'refused',
              message: "I can't help with that one. Try asking in a different way.",
            });
            return;
          }

          const messageId = await deps.store.insertMessage(
            ctx,
            conversation.id,
            'assistant',
            reply,
            event.usage.model,
          );
          await deps.store.touchConversation(conversation.id);
          await send({ type: 'done', messageId });
        }
      } catch (err) {
        if (abort.signal.aborted) {
          // Client went away mid-reply: keep what was generated so the chat
          // history matches what the user saw.
          if (reply) await deps.store.insertMessage(ctx, conversation.id, 'assistant', reply).catch(() => {});
          return;
        }
        log('chat stream failed', err);
        if (reply) await deps.store.insertMessage(ctx, conversation.id, 'assistant', reply).catch(() => {});
        await send({
          type: 'error',
          code: 'upstream_error',
          message: 'Something went wrong while replying. Please try again.',
        });
      }
    });
  });

  // Required by the App Store and Google Play: users can delete their account
  // in the app. Chats, messages, usage and the personal workspace cascade.
  app.delete('/v1/account', async (c) => {
    await deps.store.deleteUser(c.get('user').id);
    return c.body(null, 204);
  });

  app.onError((err, c) => {
    log('unhandled error', err);
    return c.json(errorBody('internal', 'Something went wrong. Please try again.'), 500);
  });

  return app;
}

function errorBody(code: ChatErrorCode, message: string) {
  return { error: { code, message } };
}
