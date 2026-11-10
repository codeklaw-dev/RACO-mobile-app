import { z } from 'zod';

export const MAX_MESSAGE_CHARS = 32_000;

export const MAX_ATTACHMENTS = 4;
/** About 1.5 MB of JPEG; the app shrinks photos well below this. */
export const MAX_IMAGE_BASE64 = 2_000_000;
export const MAX_FILE_CHARS = 60_000;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const imageAttachmentSchema = z.object({
  kind: z.literal('image'),
  name: z.string().trim().min(1).max(200),
  mimeType: z.enum(IMAGE_TYPES),
  data: z.base64().max(MAX_IMAGE_BASE64),
});
const fileAttachmentSchema = z.object({
  kind: z.literal('file'),
  name: z.string().trim().min(1).max(200),
  text: z.string().max(MAX_FILE_CHARS),
});
export const attachmentSchema = z.discriminatedUnion('kind', [imageAttachmentSchema, fileAttachmentSchema]);
export type Attachment = z.infer<typeof attachmentSchema>;
export type ImageAttachment = z.infer<typeof imageAttachmentSchema>;

export const chatRequestSchema = z
  .object({
    // Omit to start a new conversation.
    conversationId: z.uuid().optional(),
    // For a new conversation: the project to file it under.
    projectId: z.uuid().optional(),
    message: z.string().trim().max(MAX_MESSAGE_CHARS),
    // Photos go to the model with this message only; files stay in the chat as text.
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
    // "voice" asks for short, spoken-style replies (voice mode reads them aloud).
    mode: z.enum(['text', 'voice']).optional(),
  })
  .refine((r) => r.message.length > 0 || (r.attachments?.length ?? 0) > 0, { message: 'Empty message', path: ['message'] });

const FENCE = '```';

/**
 * How a sent message is stored and shown: the typed text, then one fenced
 * block per attachment. A file's block holds its text, so later turns can
 * still read it; a photo's block is empty because photos aren't kept.
 */
export function messageWithAttachments(message: string, attachments: Attachment[] = []): string {
  const blocks = attachments.map((a) =>
    a.kind === 'file' ? `${FENCE}file:${a.name}\n${a.text.replaceAll(FENCE, "'''")}\n${FENCE}` : `${FENCE}image:${a.name}\n${FENCE}`,
  );
  return [message, ...blocks].filter(Boolean).join('\n\n');
}

/** Splits a stored message back into its text and the names of what was attached. */
export function splitAttachments(content: string): { text: string; attachments: { kind: 'image' | 'file'; name: string }[] } {
  const attachments: { kind: 'image' | 'file'; name: string }[] = [];
  const text = content
    .replace(/(?:^|\n\n)```(image|file):([^\n]+)\n[\s\S]*?```/g, (_, kind: 'image' | 'file', name: string) => {
      attachments.push({ kind, name: name.trim() });
      return '';
    })
    .trim();
  return { text, attachments };
}
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
  projectId: string | null;
  /** Set when the chat is pinned to the top of the sidebar. */
  pinnedAt: string | null;
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
