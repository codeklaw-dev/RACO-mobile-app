import { ANSWER_ONLY, CARDS_GUIDANCE, STYLE_GUIDANCE, VOICE_GUIDANCE, type ChatMode } from '@raco/shared';
import type { UserContext } from './store';

/**
 * Builds the system prompt. Kept deterministic for a given user so the
 * prompt-cache prefix stays stable across turns: nothing time-dependent goes
 * in here.
 */
export function buildSystemPrompt(ctx: UserContext, mode: ChatMode = 'text'): string {
  const lines = [
    `You are ${ctx.agentName}, a private AI assistant in the RACO mobile app. You help people write, research, study, plan and think things through.`,
    '',
    mode === 'voice' ? VOICE_GUIDANCE : 'The user is on a phone. Format for a small screen: short paragraphs, plain Markdown, no wide tables unless asked.',
    STYLE_GUIDANCE[ctx.responseStyle],
    ANSWER_ONLY,
    'If you are unsure about a fact that matters, say so plainly rather than guessing.',
  ];
  // Cards are visual, so voice replies don't use them.
  if (mode !== 'voice') lines.push('', CARDS_GUIDANCE);

  if (ctx.displayName) {
    lines.push('', `The user's first name is ${ctx.displayName}.`);
  }
  if (ctx.interests.length > 0) {
    lines.push(`They said they mainly want help with: ${ctx.interests.join(', ')}.`);
  }
  return lines.join('\n');
}

/** First-message title for the chat list; trimmed at a word boundary. */
export function titleFromMessage(message: string, max = 60): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  const cut = oneLine.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
