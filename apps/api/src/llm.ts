import Anthropic from '@anthropic-ai/sdk';
import type { StoredMessage } from './store';

export interface CompletionUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type CompletionEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; usage: CompletionUsage; refused: boolean };

export interface CompletionRequest {
  system: string;
  messages: StoredMessage[];
  signal?: AbortSignal;
}

/** The model provider, behind an interface so the route can be tested. */
export interface Llm {
  stream(req: CompletionRequest): AsyncIterable<CompletionEvent>;
}

export class AnthropicLlm implements Llm {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async *stream(req: CompletionRequest): AsyncIterable<CompletionEvent> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 64_000,
        // Chat replies don't need deep reasoning; low effort keeps
        // time-to-first-token short on a phone.
        output_config: { effort: 'low' },
        // Auto-cache the conversation prefix so each new turn only pays full
        // price for the newest messages.
        cache_control: { type: 'ephemeral' },
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        // If a safety classifier declines, retry server-side on Anthropic's
        // recommended fallback model instead of failing the turn.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal: req.signal },
    );

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    yield {
      type: 'done',
      refused: final.stop_reason === 'refusal',
      usage: {
        model: final.model,
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
