import {
  interpretLocally,
  toVoiceResult,
  VOICE_SYSTEM_PROMPT,
  voiceResultSchema,
  voiceUserMessage,
  type VoiceTurnRequest,
  type VoiceTurnResult,
} from '@raco/shared';
import type { CompletionEvent, CompletionRequest, Llm } from './llm';
import type { VoiceInterpreter } from './voice';

/**
 * A self-hosted or third-party model behind an OpenAI-compatible API
 * (`POST {baseUrl}/chat/completions`), e.g. vLLM, Ollama, LM Studio or
 * llama.cpp. Selected with LLM_PROVIDER=openai-compatible.
 */
export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

interface ChatChunk {
  model?: string;
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

export class OpenAICompatibleLlm implements Llm {
  private readonly fetch: typeof fetch;

  constructor(private readonly cfg: OpenAICompatibleConfig) {
    this.fetch = cfg.fetch ?? fetch;
  }

  async *stream(req: CompletionRequest): AsyncIterable<CompletionEvent> {
    const res = await this.fetch(endpoint(this.cfg.baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.cfg.model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'system', content: req.system }, ...req.messages],
      }),
      signal: req.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Model server returned ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }

    let model = this.cfg.model;
    let inputTokens = 0;
    let outputTokens = 0;
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const bytes of res.body) {
      buffer += decoder.decode(bytes, { stream: true }).replace(/\r\n?/g, '\n');
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let chunk: ChatChunk;
        try {
          chunk = JSON.parse(data) as ChatChunk;
        } catch {
          continue; // keep-alives and partial lines from some servers
        }
        if (chunk.model) model = chunk.model;
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        }
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { type: 'text', text };
      }
    }

    yield {
      type: 'done',
      refused: false,
      usage: { model, inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 },
    };
  }
}

/**
 * Voice onboarding on the same server. Not every OpenAI-compatible server
 * enforces a JSON schema, so the reply is validated here and anything
 * unusable falls back to the rule-based reader.
 */
export class OpenAICompatibleVoiceInterpreter implements VoiceInterpreter {
  private readonly fetch: typeof fetch;

  constructor(
    private readonly cfg: OpenAICompatibleConfig,
    private readonly log: (msg: string, err?: unknown) => void = () => {},
  ) {
    this.fetch = cfg.fetch ?? fetch;
  }

  async interpret(req: VoiceTurnRequest): Promise<VoiceTurnResult> {
    try {
      const res = await this.fetch(endpoint(this.cfg.baseUrl), {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${VOICE_SYSTEM_PROMPT}\n\nReply with only a JSON object with exactly these keys: understood (boolean), wantsTour (boolean), say (string), displayName (string or null), agentName (string or null), interests (array of allowed interests, or null), callsAllowed (boolean or null).`,
            },
            { role: 'user', content: voiceUserMessage(req) },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Model server returned ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content ?? '';
      const json = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
      const parsed = voiceResultSchema.safeParse(JSON.parse(json));
      if (!parsed.success) throw new Error('Model reply did not match the expected shape');
      return toVoiceResult(parsed.data);
    } catch (err) {
      this.log('voice interpret failed, using rules', err);
      return interpretLocally(req);
    }
  }
}
