import { describe, expect, it } from 'vitest';
import { greeting, humanList } from './greeting';
import { forClipboard, parseInline, parseMarkdown, toPlainText } from './markdown';
import { SseParser } from './sse';
import { meterLevel, splitForSpeech, VoiceActivity } from './voice-activity';

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

describe('toPlainText', () => {
  it('strips formatting so a reply can be spoken', () => {
    expect(toPlainText('# Plan\n\n**Day 1:** read\n\n- one\n- *two*\n\n```js\nx()\n```')).toBe('Plan. Day 1: read. one. two.');
  });
});

describe('forClipboard', () => {
  it('turns cards into readable lines and keeps the text', () => {
    const reply = 'Here you go.\n\n```cards\n[{"type":"place","name":"Little Bean","address":"48 Station Road"}]\n```\n\nEnjoy.';
    expect(forClipboard(reply)).toBe('Here you go.\n\n- Little Bean · 48 Station Road\n\nEnjoy.');
  });
});

describe('VoiceActivity', () => {
  const feed = (va: VoiceActivity, levels: [number, number][]) => levels.map(([db, at]) => va.push(db, at));

  it('ends after speech and then a pause', () => {
    const va = new VoiceActivity(0);
    expect(feed(va, [[-60, 100], [-20, 500], [-25, 900], [-55, 1000], [-55, 2000], [-55, 2300]])).toEqual([
      'continue',
      'continue',
      'continue',
      'continue',
      'continue',
      'done',
    ]);
  });

  it('keeps listening through short gaps between words', () => {
    const va = new VoiceActivity(0);
    expect(feed(va, [[-20, 100], [-55, 200], [-20, 1200], [-55, 1300], [-55, 2500]])).toEqual(['continue', 'continue', 'continue', 'continue', 'continue']);
  });

  it('gives up when nothing is said', () => {
    const va = new VoiceActivity(0);
    expect(va.push(-60, 6900)).toBe('continue');
    expect(va.push(undefined, 7000)).toBe('nothing');
  });

  it('stops a recording that runs too long', () => {
    const va = new VoiceActivity(0);
    va.push(-20, 100);
    expect(va.push(-20, 30_000)).toBe('done');
  });
});

describe('meterLevel', () => {
  it('maps dB to 0-1', () => {
    expect(meterLevel(-160)).toBe(0);
    expect(meterLevel(-30)).toBe(0.5);
    expect(meterLevel(0)).toBe(1);
    expect(meterLevel(undefined)).toBe(0);
  });
});

describe('splitForSpeech', () => {
  it('keeps short text whole', () => {
    expect(splitForSpeech('Hi there. How are you?')).toEqual(['Hi there. How are you?']);
  });

  it('splits long text on sentence boundaries', () => {
    const pieces = splitForSpeech('One two three. Four five six. Seven eight nine.', 20);
    expect(pieces).toEqual(['One two three.', 'Four five six.', 'Seven eight nine.']);
  });

  it('breaks a very long sentence between words', () => {
    const pieces = splitForSpeech('alpha beta gamma delta epsilon zeta', 12);
    expect(pieces.every((p) => p.length <= 12)).toBe(true);
    expect(pieces.join(' ')).toBe('alpha beta gamma delta epsilon zeta');
  });

  it('returns nothing for blank text', () => {
    expect(splitForSpeech('  ')).toEqual([]);
  });
});
