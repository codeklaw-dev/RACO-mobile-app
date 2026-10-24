/**
 * Small Markdown parser for chat replies. Covers what the assistant is told
 * to produce on a phone: paragraphs, headings, lists, quotes, fenced code
 * and inline bold/italic/code/links. It must tolerate half-streamed input,
 * e.g. a code fence that hasn't closed yet.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; lang: string; text: string };

const LIST_ITEM = /^\s{0,3}(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', children: parseInline(para.join('\n')) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const fence = line.match(/^\s{0,3}(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith(fence[1]!)) body.push(lines[i++]!);
      blocks.push({ type: 'code', lang: fence[2] ?? '', text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      flushPara();
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flushPara();
      const level = Math.min(heading[1]!.length, 3) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2]!) });
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      flushPara();
      const quoted: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) quoted.push(lines[i++]!.replace(/^\s{0,3}>\s?/, ''));
      i--;
      blocks.push({ type: 'quote', children: parseInline(quoted.join('\n')) });
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      flushPara();
      const ordered = !item[1];
      const start = ordered ? Number(item[2]) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(LIST_ITEM);
        if (m && !m[1] === ordered) {
          items.push(m[3]!);
        } else if (items.length && /^\s{2,}\S/.test(lines[i]!)) {
          items[items.length - 1] += `\n${lines[i]!.trim()}`; // continuation line
        } else {
          break;
        }
        i++;
      }
      i--;
      blocks.push({ type: 'list', ordered, start, items: items.map(parseInline) });
      continue;
    }

    para.push(line);
  }
  flushPara();
  return blocks;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ type: 'text', text });
    text = '';
  };

  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);

    if (rest[0] === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ type: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    const strong = rest.match(/^(\*\*|__)(?=\S)([\s\S]*?\S)\1/);
    if (strong) {
      flush();
      out.push({ type: 'bold', children: parseInline(strong[2]!) });
      i += strong[0].length;
      continue;
    }

    const em = rest.match(/^(\*|_)(?=\S)([\s\S]*?\S)\1(?!\1)/);
    if (em && !(em[1] === '_' && /\w/.test(src[i - 1] ?? ''))) {
      flush();
      out.push({ type: 'italic', children: parseInline(em[2]!) });
      i += em[0].length;
      continue;
    }

    const link = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (link) {
      flush();
      out.push({ type: 'link', href: link[2]!, children: parseInline(link[1]!) });
      i += link[0].length;
      continue;
    }

    text += src[i];
    i++;
  }
  flush();
  return out;
}

/** Plain text for reading a reply aloud or showing it on the voice stage. */
export function toPlainText(src: string): string {
  const inline = (nodes: Inline[]): string =>
    nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inline(n.children))).join('');
  return parseMarkdown(src)
    .map((b) => {
      switch (b.type) {
        case 'list':
          return b.items.map((item) => endSentence(inline(item))).join(' ');
        case 'code':
          return '';
        default:
          return endSentence(inline(b.children));
      }
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ends a block with a full stop so separate blocks are read as separate sentences. */
function endSentence(text: string): string {
  const t = text.trim();
  return !t || /[.!?:…]$/.test(t) ? t : `${t}.`;
}
