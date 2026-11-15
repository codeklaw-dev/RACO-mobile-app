/**
 * Small Markdown parser for chat replies. Covers what the assistant is told
 * to produce on a phone: paragraphs, headings, lists (with nesting), quotes,
 * fenced code, tables, dividers and inline bold/italic/code/links. It must tolerate half-streamed input,
 * e.g. a code fence that hasn't closed yet.
 */

import { parseCards } from '@raco/shared';

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  /** `depths[i]` is 0 for a top-level item, 1 or 2 for nested ones. */
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][]; depths: number[] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { type: 'rule' };

const LIST_ITEM = /^\s{0,3}(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;
const ANY_ITEM = /^(\s*)(?:[-*+]|\d{1,9}[.)])\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** The cells of a `| a | b |` row. */
function cells(line: string): Inline[][] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => parseInline(c.trim()));
}

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

    if (RULE.test(line)) {
      flushPara();
      blocks.push({ type: 'rule' });
      continue;
    }

    // A table: a row of cells, then a |---|---| divider.
    if (line.includes('|') && TABLE_DIVIDER.test(lines[i + 1] ?? '')) {
      flushPara();
      const header = cells(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim()) rows.push(cells(lines[i++]!));
      i--;
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      flushPara();
      const ordered = !item[1];
      const start = ordered ? Number(item[2]) : 1;
      const base = line.length - line.trimStart().length;
      const items: string[] = [];
      const depths: number[] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const indent = current.length - current.trimStart().length;
        const nested = indent >= base + 2 ? current.match(ANY_ITEM) : null;
        const m = current.match(LIST_ITEM);
        if (items.length && nested) {
          // An indented item belongs under the one before it.
          items.push(nested[2]!);
          depths.push(indent >= base + 6 ? 2 : 1);
        } else if (m && !m[1] === ordered) {
          items.push(m[3]!);
          depths.push(0);
        } else if (items.length && /^\s{2,}\S/.test(current)) {
          items[items.length - 1] += `\n${current.trim()}`; // continuation line
        } else {
          break;
        }
        i++;
      }
      i--;
      blocks.push({ type: 'list', ordered, start, items: items.map(parseInline), depths });
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
        case 'table':
          return [b.header, ...b.rows].map((row) => endSentence(row.map(inline).join(', '))).join(' ');
        case 'code':
        case 'rule':
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

/**
 * A reply as it should be pasted elsewhere: Markdown stays, but `cards`
 * blocks become readable lines instead of JSON.
 */
export function forClipboard(src: string): string {
  return src
    .replace(/```cards\s*\n([\s\S]*?)(?:```|$)/g, (_, body: string) =>
      parseCards(body)
        .map((c) => {
          switch (c.type) {
            case 'place':
              return `- ${[c.name, c.address, c.hours, c.phone].filter(Boolean).join(' · ')}`;
            case 'link':
              return `- ${c.title}: ${c.url}`;
            case 'image':
              return `- ${c.alt}: ${c.url}`;
          }
        })
        .join('\n'),
    )
    .trim();
}
