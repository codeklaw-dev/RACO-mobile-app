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
