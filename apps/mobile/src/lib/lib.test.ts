import { describe, expect, it } from 'vitest';
import { greeting, humanList } from './greeting';
import { parseInline, parseMarkdown } from './markdown';
import { SseParser } from './sse';

describe('SseParser', () => {
  it('returns complete events and buffers partial ones', () => {
    const p = new SseParser();
    expect(p.push('data: {"a":1}\n\ndata: {"b"')).toEqual(['{"a":1}']);
    expect(p.push(':2}\n')).toEqual([]);
    expect(p.push('\n')).toEqual(['{"b":2}']);
  });

  it('handles CRLF line endings and ignores comments and other fields', () => {
    const p = new SseParser();
    expect(p.push(': keep-alive\r\n\r\nevent: x\r\ndata: hi\r\n\r\n')).toEqual(['hi']);
  });
});

describe('parseMarkdown', () => {
  it('parses paragraphs, headings and lists', () => {
    const blocks = parseMarkdown('# Plan\n\nIntro line\nsecond line\n\n- one\n- **two**\n\n1. a\n2. b');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ type: 'text', text: 'one' }], [{ type: 'bold' }]] });
    expect(blocks[3]).toMatchObject({ ordered: true, start: 1 });
  });

  it('keeps an unclosed code fence as code while streaming', () => {
    expect(parseMarkdown('Look:\n```ts\nconst x = 1')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Look:' }] },
      { type: 'code', lang: 'ts', text: 'const x = 1' },
    ]);
  });

  it('parses quotes', () => {
    expect(parseMarkdown('> quoted\n> text')).toEqual([
      { type: 'quote', children: [{ type: 'text', text: 'quoted\ntext' }] },
    ]);
  });
});

describe('parseInline', () => {
  it('handles bold, italic, code and links', () => {
    expect(parseInline('a **b** *c* `d` [e](https://x.io)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'd' },
      { type: 'text', text: ' ' },
      { type: 'link', href: 'https://x.io', children: [{ type: 'text', text: 'e' }] },
    ]);
  });

  it('leaves unmatched markers and snake_case alone', () => {
    expect(parseInline('2 * 3 and snake_case_name')).toEqual([{ type: 'text', text: '2 * 3 and snake_case_name' }]);
    expect(parseInline('**unfinished')).toEqual([{ type: 'text', text: '**unfinished' }]);
  });
});

describe('greeting', () => {
  it('picks the part of day', () => {
    expect(greeting('Sam', new Date(2026, 0, 1, 8))).toBe('Good morning, Sam.');
    expect(greeting('Sam', new Date(2026, 0, 1, 14))).toBe('Good afternoon, Sam.');
    expect(greeting(null, new Date(2026, 0, 1, 21))).toBe('Good evening.');
  });

  it('joins lists naturally', () => {
    expect(humanList(['writing'])).toBe('writing');
    expect(humanList(['writing', 'research', 'study'])).toBe('writing, research and study');
  });
});
