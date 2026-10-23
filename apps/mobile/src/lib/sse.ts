/**
 * Incremental Server-Sent Events parser. Feed it decoded text as it arrives
 * from the network; it returns the `data` payload of every complete event.
 * Network chunks can split an event anywhere, so partial input is buffered.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    const out: string[] = [];
    let end: number;
    while ((end = this.buffer.indexOf('\n\n')) !== -1) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
        .join('\n');
      if (data) out.push(data);
    }
    return out;
  }
}
