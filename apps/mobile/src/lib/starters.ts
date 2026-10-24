import type { Interest } from '@raco/shared';

/** Home screen suggestions: one line each, with a monochrome icon. */
export const SUGGESTIONS = [
  { icon: 'calendar', text: 'Plan my week around three deadlines', prompt: 'Help me plan my week. Ask me what I need to get done.' },
  { icon: 'mail', text: 'Draft a polite follow-up email', prompt: 'Help me draft an email. Ask me who it is for and what it needs to say.' },
  { icon: 'bulb', text: 'Explain a topic simply, with examples', prompt: 'Explain a topic to me simply, with examples. Ask me which topic.' },
] as const;

const BY_INTEREST: Partial<Record<Interest, string>> = {
  Writing: 'Help me tighten up something I wrote',
  Research: 'Find and summarise recent sources on a topic',
  Coding: 'Explain what a piece of code does',
  'Study & exams': 'Turn my lecture notes into flashcards',
  Emails: 'Draft a polite follow-up email',
  Brainstorming: 'Brainstorm ten ideas with me',
  'Data & spreadsheets': 'Help me write a spreadsheet formula',
  Planning: 'Plan my week around three deadlines',
  Translation: 'Translate a message and keep the tone',
  'Just curious': 'Tell me something surprising about space',
};

const FALLBACK = [
  'Plan my week around three deadlines',
  'Find and summarise recent sources on a topic',
  'Draft a polite follow-up email',
];

/** Three first-chat starters (design 13), led by the user's picks. */
export function startersFor(interests: readonly Interest[]): string[] {
  const picked = interests.map((i) => BY_INTEREST[i]).filter((s): s is string => !!s);
  return [...new Set([...picked, ...FALLBACK])].slice(0, 3);
}
