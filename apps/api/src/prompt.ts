import { VOICE_GUIDANCE, type ChatMode, type ResponseStyle } from '@raco/shared';
import type { UserContext } from './store';

const STYLE_GUIDANCE: Record<ResponseStyle, string> = {
  concise:
    'Keep replies short and direct. Lead with the answer and skip preamble. Expand only when the user asks.',
  balanced:
    'Give clear answers with just enough context to be useful. Use short paragraphs, and lists only when they help.',
  detailed:
    'Give thorough answers with explanations, worked examples and step-by-step instructions where they help.',
};

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
    'If you are unsure about a fact that matters, say so plainly rather than guessing.',
  ];

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
