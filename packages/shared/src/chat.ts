import { z } from 'zod';

export const MAX_MESSAGE_CHARS = 32_000;

export const chatRequestSchema = z.object({
  // Omit to start a new conversation.
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  // "voice" asks for short, spoken-style replies (voice mode reads them aloud).
  mode: z.enum(['text', 'voice']).optional(),
});
export type ChatMode = NonNullable<z.infer<typeof chatRequestSchema>['mode']>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Voice mode reads replies aloud, so they must sound natural spoken. */
export const VOICE_GUIDANCE =
  'The user is talking to you by voice and your reply will be read aloud. Answer in one to three short, natural spoken sentences. No Markdown, lists, headings, links or emoji. Offer to go into more detail instead of giving it all at once.';


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
  | 'consent_required'
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

/** Reporting an AI response (App Review Guideline 1.2). */
export const REPORT_REASONS = ['harmful', 'sexual', 'hateful', 'inaccurate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const reportRequestSchema = z.object({
  messageId: z.string().min(1).max(100),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(500).optional(),
});
export type ReportRequest = z.infer<typeof reportRequestSchema>;
