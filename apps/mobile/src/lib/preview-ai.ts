/**
 * Real AI for the shared web preview. When the preview runs inside a Claude
 * artifact viewer, the viewer's `sample` capability answers with Claude on
 * the viewer's own account (they're asked once). Anywhere else this
 * resolves to null and demo mode falls back to scripted replies.
 */

type Turn = { role: 'user' | 'assistant'; content: string };
type OnText = (update: { text: string; delta: string }) => void;

interface SampleFn {
  (input: string | Turn[], options?: { onText?: OnText; signal?: AbortSignal; cache?: boolean; modelTier?: 'quick' | 'default' | 'complex' }): Promise<{ text: string; truncated: boolean }>;
  json(input: string | Turn[], options?: { signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex' }): Promise<unknown>;
}

interface ClaudeRuntime {
  use(name: 'sample'): Promise<SampleFn | null>;
}

let samplePromise: Promise<SampleFn | null> | null = null;
/** Set once the viewer declines, so we stop asking for this page load. */
let declined = false;

export function previewSample(): Promise<SampleFn | null> {
  if (declined) return Promise.resolve(null);
  const runtime = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!runtime?.use) return Promise.resolve(null);
  samplePromise ??= runtime.use('sample').catch(() => null);
  return samplePromise;
}

/** Marks sampling unavailable after a refusal, so the demo falls back quietly. */
export function noteSampleError(err: unknown) {
  const code = (err as { code?: string })?.code;
  if (code === 'not_granted' || code === 'unavailable') declined = true;
}

/**
 * Streams one reply as text chunks. The callback-based `onText` is bridged
 * to an async iterator so the chat code can treat it like the real API.
 */
export async function* streamPreviewReply(sample: SampleFn, turns: Turn[], signal?: AbortSignal): AsyncGenerator<string> {
  const queue: string[] = [];
  let finished = false;
  let failure: unknown = null;
  let wake: (() => void) | null = null;
  const notify = () => {
    wake?.();
    wake = null;
  };

  sample(turns, {
    cache: false,
    signal,
    modelTier: 'quick',
    onText: ({ delta }) => {
      if (delta) queue.push(delta);
      notify();
    },
  })
    .catch((err) => {
      failure = err;
    })
    .finally(() => {
      finished = true;
      notify();
    });

  while (true) {
    if (queue.length) {
      yield queue.shift()!;
      continue;
    }
    if (finished) break;
    await new Promise<void>((r) => (wake = r));
  }
  if (failure) throw failure;
}
