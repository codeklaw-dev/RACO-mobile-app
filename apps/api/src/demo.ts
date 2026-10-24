import { demoReply, interpretLocally } from '@raco/shared';
import type { CompletionEvent, CompletionRequest, Llm } from './llm';
import type { VoiceInterpreter } from './voice';

/**
 * LLM_PROVIDER=demo: no model is called. Chat streams a sample reply that
 * matches the last message, and voice onboarding uses the rule-based reader.
 */
export class DemoLlm implements Llm {
  constructor(private readonly wordDelayMs = 25) {}

  async *stream(req: CompletionRequest): AsyncIterable<CompletionEvent> {
    const last = req.messages.findLast((m) => m.role === 'user')?.content ?? '';
    for (const word of demoReply(last).match(/\S+\s*/g) ?? []) {
      if (req.signal?.aborted) break;
      yield { type: 'text', text: word };
      if (this.wordDelayMs) await new Promise((r) => setTimeout(r, this.wordDelayMs));
    }
    yield {
      type: 'done',
      refused: false,
      usage: { model: 'demo', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    };
  }
}

export const demoVoiceInterpreter: VoiceInterpreter = {
  interpret: async (req) => interpretLocally(req),
};
