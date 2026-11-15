import { describe, expect, it } from 'vitest';
import { greeting, humanList } from './greeting';
import { forClipboard, parseInline, parseMarkdown, toPlainText } from './markdown';
import { SseParser } from './sse';
import { ThinkFilter, withoutThinking } from './think-filter';
import { meterLevel, splitForSpeech, takeSpeakable, VoiceActivity } from './voice-activity';

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

describe('parseMarkdown: model output', () => {
  it('nests indented list items under the one before', () => {
    const [list] = parseMarkdown('*   Visit the **library**.\n*   Walk the park.\n    *   Bring water.\n*   Eat lunch.');
    expect(list).toMatchObject({ type: 'list', ordered: false, depths: [0, 0, 1, 0] });
    expect(list?.type === 'list' && list.items.map((i) => i.map((n) => n.type).join(','))).toEqual(['text,bold,text', 'text', 'text', 'text']);
  });

  it('turns --- into a divider and | tables | into a table', () => {
    const blocks = parseMarkdown('Intro\n\n---\n\n| Item | Cost |\n|---|:---:|\n| Rickshaw | 50 |\n| Tea | 10 |');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'rule', 'table']);
    expect(blocks[2]).toMatchObject({ header: [[{ text: 'Item' }], [{ text: 'Cost' }]], rows: [[[{ text: 'Rickshaw' }], [{ text: '50' }]], [[{ text: 'Tea' }], [{ text: '10' }]]] });
  });

  it('keeps numbering across blank lines between items', () => {
    const blocks = parseMarkdown('1. **First**\n\n2. **Second**');
    expect(blocks).toMatchObject([{ type: 'list', start: 1 }, { type: 'list', start: 2 }]);
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
    expect(feed(va, [[-60, 100], [-20, 500], [-25, 900], [-55, 1000], [-55, 1700], [-55, 1800]])).toEqual([
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
    expect(feed(va, [[-20, 100], [-55, 200], [-20, 900], [-55, 1300], [-55, 2000]])).toEqual(['continue', 'continue', 'continue', 'continue', 'continue']);
  });

  it('ends in a noisy room once speech drops back to the noise', () => {
    const va = new VoiceActivity(0);
    expect(feed(va, [[-40, 100], [-38, 200], [-18, 500], [-40, 700], [-39, 1200], [-40, 1500]])).toEqual([
      'continue',
      'continue',
      'continue',
      'continue',
      'continue',
      'done',
    ]);
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

describe('ThinkFilter', () => {
  const run = (chunks: string[]) => {
    const f = new ThinkFilter();
    return chunks.map((c) => f.push(c)).join('') + f.flush();
  };

  it('drops reasoning in think tags, even when tags are split across chunks', () => {
    expect(run(['<thi', 'nk>Let me work this out', '... 2+2</th', 'ink>\n\n2 plus 2 is 4.'])).toBe('2 plus 2 is 4.');
  });

  it('passes ordinary text straight through, including a lone "<"', () => {
    expect(run(['Use a < b', ' when sorting.'])).toBe('Use a < b when sorting.');
  });

  it('never shows unfinished reasoning', () => {
    expect(run(['<think>still going'])).toBe('');
  });

  it('trims leading blank lines left by the model', () => {
    expect(withoutThinking('\n\nHello there.')).toBe('Hello there.');
  });
});

describe('takeSpeakable', () => {
  it('starts with the first clause, then whole sentences', () => {
    // Mid-stream: the first sentence hasn't finished, but its first clause has.
    const [first, at] = takeSpeakable('The second train catches up at seven, three hours', 0);
    expect(first).toBe('The second train catches up at seven,');
    const text = 'The second train catches up at seven, three hours after it leaves. It closes';
    expect(takeSpeakable(text, at)).toEqual([' three hours after it leaves.', text.indexOf(' It closes')]);
  });

  it('waits when nothing is finished yet', () => {
    expect(takeSpeakable('Sure, let me', 0)).toEqual(['', 0]);
    expect(takeSpeakable('Done. And then, more', 5)).toEqual(['', 5]);
  });
});
