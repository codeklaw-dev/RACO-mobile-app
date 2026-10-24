import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { INTERESTS, interpretLocally, voiceQuestion, type VoiceTurnRequest, type VoiceTurnResult } from '@raco/shared';
import { z } from 'zod';

/** Reads one spoken onboarding answer. */
export interface VoiceInterpreter {
  interpret(req: VoiceTurnRequest): Promise<VoiceTurnResult>;
}

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

/** Interprets answers with a small, cheap model; falls back to rules on any failure. */
export class ClaudeVoiceInterpreter implements VoiceInterpreter {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly log: (msg: string, err?: unknown) => void = () => {},
  ) {
    this.client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
  }

  async interpret(req: VoiceTurnRequest): Promise<VoiceTurnResult> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 2_000,
        output_config: { effort: 'low', format: zodOutputFormat(voiceResultSchema) },
        system: VOICE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: voiceUserMessage(req) }],
      });
      const out = response.parsed_output;
      if (response.stop_reason === 'refusal' || !out) return interpretLocally(req);
      return toVoiceResult(out);
    } catch (err) {
      this.log('voice interpret failed, using rules', err);
      return interpretLocally(req);
    }
  }
}
