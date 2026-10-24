import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  interpretLocally,
  toVoiceResult,
  VOICE_SYSTEM_PROMPT,
  voiceResultSchema,
  voiceUserMessage,
  type VoiceTurnRequest,
  type VoiceTurnResult,
} from '@raco/shared';

/** Reads one spoken onboarding answer. */
export interface VoiceInterpreter {
  interpret(req: VoiceTurnRequest): Promise<VoiceTurnResult>;
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
