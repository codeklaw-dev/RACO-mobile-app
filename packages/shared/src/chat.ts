import { z } from 'zod';

export const MAX_MESSAGE_CHARS = 32_000;

export const chatRequestSchema = z.object({
  // Omit to start a new conversation.
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Events the API streams back over SSE. Each SSE `data:` line is one JSON
 * encoded `ChatStreamEvent`.
 */
export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string; title: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string }
  | { type: 'error'; code: ChatErrorCode; message: string };

export type ChatErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'not_found'
  | 'quota_exceeded'
  | 'refused'
  | 'upstream_error'
  | 'internal';

export type MessageRole = 'user' | 'assistant';

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}
