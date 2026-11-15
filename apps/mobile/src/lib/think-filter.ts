/**
 * Removes a model's `<think>…</think>` reasoning from streamed text. Network
 * chunks can split a tag anywhere, so a possible partial tag at the end of a
 * chunk is held back until the next one arrives.
 */
export class ThinkFilter {
  private buffer = '';
  private thinking = false;
  private started = false;

  push(chunk: string): string {
    this.buffer += chunk;
    let out = '';
    for (;;) {
      if (this.thinking) {
        const end = this.buffer.indexOf('</think>');
        if (end < 0) {
          this.buffer = this.buffer.slice(-('</think>'.length - 1));
          return this.emit(out);
        }
        this.buffer = this.buffer.slice(end + '</think>'.length);
        this.thinking = false;
        continue;
      }
      const start = this.buffer.indexOf('<think>');
      if (start >= 0) {
        out += this.buffer.slice(0, start);
        this.buffer = this.buffer.slice(start + '<think>'.length);
        this.thinking = true;
        continue;
      }
      // Hold back a tail that could be the start of "<think>".
      let keep = 0;
      for (let n = Math.min('<think>'.length - 1, this.buffer.length); n > 0; n--) {
        if ('<think>'.startsWith(this.buffer.slice(-n))) {
          keep = n;
          break;
        }
      }
      out += this.buffer.slice(0, this.buffer.length - keep);
      this.buffer = this.buffer.slice(this.buffer.length - keep);
      return this.emit(out);
    }
  }

  /** Whatever is held back once the stream ends (never unfinished thinking). */
  flush(): string {
    const rest = this.thinking ? '' : this.buffer;
    this.buffer = '';
    return this.emit(rest);
  }

  // Replies often start with blank lines left over from the reasoning.
  private emit(text: string): string {
    if (this.started) return text;
    const trimmed = text.replace(/^\s+/, '');
    if (trimmed) this.started = true;
    return trimmed;
  }
}

/** The answer from a whole (non-streamed) reply, without reasoning. */
export function withoutThinking(text: string): string {
  const f = new ThinkFilter();
  return (f.push(text) + f.flush()).trim();
}

/** Request fields that turn Qwen3's thinking off on vLLM: replies come back faster and without reasoning. */
export const NO_THINKING = { chat_template_kwargs: { enable_thinking: false } } as const;
