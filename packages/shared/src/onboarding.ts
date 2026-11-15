import { z } from 'zod';

export const INTERESTS = [
  'Writing',
  'Research',
  'Coding',
  'Study & exams',
  'Emails',
  'Brainstorming',
  'Data & spreadsheets',
  'Planning',
  'Translation',
  'Just curious',
] as const;

export const interestSchema = z.enum(INTERESTS);
export type Interest = z.infer<typeof interestSchema>;

export const RESPONSE_STYLES = [
  { id: 'concise', title: 'Concise', body: 'Short, direct answers. No fluff.' },
  { id: 'balanced', title: 'Balanced', body: 'Clear answers with just enough context.' },
  { id: 'detailed', title: 'Detailed', body: 'Thorough explanations, examples and steps.' },
] as const;

export const responseStyleSchema = z.enum(['concise', 'balanced', 'detailed']);
export type ResponseStyle = z.infer<typeof responseStyleSchema>;

/** System-prompt wording for each reply style; shared by the API and the demo preview. */
export const STYLE_GUIDANCE: Record<ResponseStyle, string> = {
  concise:
    'Keep replies short and direct. Lead with the answer and skip preamble. Expand only when the user asks.',
  balanced:
    'Give clear answers with just enough context to be useful. Use short paragraphs, and lists only when they help.',
  detailed:
    'Give thorough answers with explanations, worked examples and step-by-step instructions where they help.',
};

/** Keeps replies to what the user needs: no visible reasoning. */
export const ANSWER_ONLY = 'Reply with the answer itself. Never show your reasoning, plans or drafts, and don\'t restate the question.';

export const notificationPrefsSchema = z.object({
  urgentCalls: z.boolean(),
  dailyCheckIn: z.object({
    enabled: z.boolean(),
    // Local time, 24h "HH:MM".
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
  inputNeededCalls: z.boolean(),
  everydayReminders: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  urgentCalls: true,
  dailyCheckIn: { enabled: true, time: '09:00' },
  inputNeededCalls: true,
  everydayReminders: true,
};

export const DEFAULT_AGENT_NAME = 'Raco';

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  agentName: z.string().trim().min(1).max(40),
  interests: z.array(interestSchema).max(INTERESTS.length),
  responseStyle: responseStyleSchema,
  notificationPrefs: notificationPrefsSchema,
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
