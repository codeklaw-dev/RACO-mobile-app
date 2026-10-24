import { z } from 'zod';
import { INTERESTS, type Interest } from './onboarding';

/** Questions Raco asks during voice onboarding (designs V2-V5), in order. */
export const VOICE_STEPS = ['name', 'agent', 'uses', 'calls'] as const;
export type VoiceStep = (typeof VOICE_STEPS)[number];

export const voiceTurnRequestSchema = z.object({
  step: z.enum(VOICE_STEPS),
  /** What the user said (speech-to-text) or typed. */
  transcript: z.string().trim().min(1).max(500),
  agentName: z.string().trim().min(1).max(40),
  displayName: z.string().trim().max(60).optional(),
});
export type VoiceTurnRequest = z.infer<typeof voiceTurnRequestSchema>;

/** What Raco understood from one answer, and what it says back. */
export interface VoiceTurnResult {
  /** False when the answer didn't fit the question; `say` then asks again. */
  understood: boolean;
  /** The user asked what Raco can do (opens the feature tour, design V4a). */
  wantsTour: boolean;
  say: string;
  displayName?: string;
  agentName?: string;
  interests?: Interest[];
  callsAllowed?: boolean;
}

const KEYWORDS: Record<Interest, RegExp> = {
  Writing: /\b(writ|essay|blog|article|copy|edit)/i,
  Research: /\b(research|sources|look things up|find out|investigat)/i,
  Coding: /\b(cod(e|ing)|program|software|debug|develop)/i,
  'Study & exams': /\b(stud|exam|revis|homework|school|uni|college|class|lecture|learn)/i,
  Emails: /\b(e-?mails?|inbox|messages?)\b/i,
  Brainstorming: /\b(brainstorm|ideas?)\b/i,
  'Data & spreadsheets': /\b(data|spreadsheets?|excel|sheets|numbers)\b/i,
  Planning: /\b(plan|schedul|organi[sz]|calendar|week|tasks?|to-?do)/i,
  Translation: /\b(translat|language)/i,
  'Just curious': /\b(curious|everything|anything|not sure|explor)/i,
};

const YES = /\b(yes|yeah|yep|sure|ok(ay)?|please|go ahead|of course|definitely|fine|allow|keep)\b/i;
const NO = /\b(no|nope|not now|don'?t|do not|never|later|rather not|skip)\b/i;
const TOUR = /what (can|do) you do|what are you|how do you work|show me (around|what)/i;

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Pulls a first name out of "I'm Sam", "my name is sam", "Sam", "call me Sam please". */
export function extractName(transcript: string): string | null {
  const t = transcript.trim().replace(/[.!?,]+$/g, '');
  const m =
    t.match(/\b(?:i'?m|i am|my name is|my name's|call me|it'?s|this is|name is)\s+([\p{L}'-]+)/iu) ??
    (t.split(/\s+/).length <= 2 ? t.match(/^([\p{L}'-]+)/u) : null);
  const name = m?.[1];
  if (!name || name.length > 40 || /^(hi|hello|hey|yes|no|um+|uh+|hm+|er+|ah+|oh|ok(ay)?|what|sorry|wait)$/i.test(name)) return null;
  return titleCase(name.toLowerCase());
}

/**
 * Rule-based reading of an answer. The API normally uses the model; this
 * covers demo mode and keeps onboarding working if the model call fails.
 */
export function interpretLocally(req: VoiceTurnRequest): VoiceTurnResult {
  const t = req.transcript;
  if (TOUR.test(t)) {
    return { understood: false, wantsTour: true, say: 'Happy to show you. Here are the main things I can help with.' };
  }

  switch (req.step) {
    case 'name': {
      const name = extractName(t);
      return name
        ? { understood: true, wantsTour: false, displayName: name, say: `Nice to meet you, ${name}.` }
        : { understood: false, wantsTour: false, say: "Sorry, I didn't catch your name. What should I call you?" };
    }
    case 'agent': {
      const rename = t.match(/\b(?:call you|name you|rename you(?: to)?|be called|how about|go with)\s+([\p{L}'-]+)/iu);
      if (rename?.[1]) {
        const agentName = titleCase(rename[1].toLowerCase());
        return { understood: true, wantsTour: false, agentName, say: `${agentName} it is.` };
      }
      if (YES.test(t) && !NO.test(t)) {
        return { understood: true, wantsTour: false, agentName: req.agentName, say: `Great, ${req.agentName} it is.` };
      }
      const single = t.trim().split(/\s+/).length === 1 ? extractName(t) : null;
      if (single) return { understood: true, wantsTour: false, agentName: single, say: `${single} it is.` };
      return { understood: false, wantsTour: false, say: `Should I stay ${req.agentName}, or would you like to give me a new name?` };
    }
    case 'uses': {
      const interests = INTERESTS.filter((i) => KEYWORDS[i].test(t));
      return interests.length
        ? { understood: true, wantsTour: false, interests, say: "Great, that's sorted." }
        : { understood: false, wantsTour: false, say: 'Tell me a bit more. Is it mostly writing, studying, planning or something else?' };
    }
    case 'calls': {
      if (NO.test(t)) return { understood: true, wantsTour: false, callsAllowed: false, say: "No problem. I'll stick to notifications." };
      if (YES.test(t)) return { understood: true, wantsTour: false, callsAllowed: true, say: "Done. I'll only call when it matters." };
      return { understood: false, wantsTour: false, say: 'Is it okay for me to call you when something is urgent? Yes or no is fine.' };
    }
  }
}

/** Raco's question for each step (the large text in designs V2-V5). */
export function voiceQuestion(step: VoiceStep, agentName: string): string {
  switch (step) {
    case 'name':
      return 'What should I call you?';
    case 'agent':
      return `I'm ${agentName}, but you can call me anything you like. Keep it?`;
    case 'uses':
      return 'What will you mostly use me for?';
    case 'calls':
      return "Can I call you when something's urgent, like a deadline coming up?";
  }
}

// ---------------------------------------------------------------------------
// Model prompt and result shape, shared by the API and the web preview.
// ---------------------------------------------------------------------------

// Every field is present so the schema works with structured outputs; null
// means "not given in this answer".
export const voiceResultSchema = z.object({
  understood: z.boolean(),
  wantsTour: z.boolean(),
  say: z.string(),
  displayName: z.string().nullable(),
  agentName: z.string().nullable(),
  interests: z.array(z.enum(INTERESTS)).nullable(),
  callsAllowed: z.boolean().nullable(),
});

export const VOICE_SYSTEM_PROMPT = `You run the spoken onboarding of a mobile AI assistant. Each request gives the step, the question the assistant just asked, and the user's answer as transcribed by speech recognition, which may contain recognition errors.

Fill in only the field for the current step:
- name: displayName, the user's first name, capitalised.
- agent: agentName. If they keep the current name, return the current name. If they choose a new one, return it.
- uses: interests, chosen only from the allowed list. Map loose answers ("revising for finals" is Study & exams).
- calls: callsAllowed, true if they agree to calls for urgent things, false otherwise.

Set understood to false if the answer doesn't answer the question; then "say" asks again in a different, friendly way.
Set wantsTour to true if they ask what the assistant can do.
"say" is one short, warm spoken sentence that acknowledges the answer, e.g. "Nice to meet you, Sam." It is read aloud, so no emoji, lists or markdown.`;

/** The JSON the model is given for one answer. */
export function voiceUserMessage(req: VoiceTurnRequest): string {
  return JSON.stringify({
    step: req.step,
    question: voiceQuestion(req.step, req.agentName),
    currentAgentName: req.agentName,
    userName: req.displayName ?? null,
    allowedInterests: INTERESTS,
    answer: req.transcript,
  });
}

export function toVoiceResult(out: z.infer<typeof voiceResultSchema>): VoiceTurnResult {
  return {
    understood: out.understood,
    wantsTour: out.wantsTour,
    say: out.say,
    ...(out.displayName ? { displayName: out.displayName.slice(0, 60) } : {}),
    ...(out.agentName ? { agentName: out.agentName.slice(0, 40) } : {}),
    ...(out.interests ? { interests: out.interests } : {}),
    ...(out.callsAllowed !== null ? { callsAllowed: out.callsAllowed } : {}),
  };
}

