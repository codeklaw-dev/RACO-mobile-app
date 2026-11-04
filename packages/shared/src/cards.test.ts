import { describe, expect, it } from 'vitest';
import { parseCards } from './cards';
import { messageWithAttachments, splitAttachments } from './chat';
import { demoReply } from './demo';

describe('parseCards', () => {
  it('reads valid cards and drops invalid ones', () => {
    const cards = parseCards(
      JSON.stringify([
        { type: 'place', name: 'Little Bean', rating: 4.6 },
        { type: 'image', url: 'http://insecure.example/a.jpg', alt: 'x' },
        { type: 'link', url: 'https://example.com', title: 'Example' },
        { type: 'weather' },
      ]),
    );
    expect(cards.map((c) => c.type)).toEqual(['place', 'link']);
  });

  it('returns nothing for half-streamed JSON', () => {
    expect(parseCards('[{"type":"place","na')).toEqual([]);
  });

  it('accepts a single object', () => {
    expect(parseCards('{"type":"place","name":"A"}')).toHaveLength(1);
  });

  it('the demo places reply holds three place cards', () => {
    const body = demoReply('Find a KFC near me').split('```cards\n')[1]!.split('```')[0]!;
    expect(parseCards(body)).toHaveLength(3);
  });
});

describe('attachments in messages', () => {
  it('round-trips text, files and photos', () => {
    const stored = messageWithAttachments('Summarise these', [
      { kind: 'file', name: 'notes.md', text: '# Notes\n```js\nx\n```' },
      { kind: 'image', name: 'IMG_1.jpg', mimeType: 'image/jpeg', data: 'AAAA' },
    ]);
    expect(stored).toContain('```file:notes.md');
    expect(stored).not.toContain('AAAA');
    expect(splitAttachments(stored)).toEqual({
      text: 'Summarise these',
      attachments: [
        { kind: 'file', name: 'notes.md' },
        { kind: 'image', name: 'IMG_1.jpg' },
      ],
    });
  });
});
