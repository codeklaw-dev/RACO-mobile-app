import { z } from 'zod';

/**
 * Cards: rich content inside a reply, shown as tiles instead of text. The
 * model writes them as a fenced block whose language is `cards`, holding a
 * JSON array:
 *
 * ```cards
 * [{ "type": "place", "name": "KFC Oxford Street", "address": "…" }]
 * ```
 *
 * Anything that doesn't match is dropped, so a malformed block never shows
 * up as raw JSON.
 */

const httpsUrl = z.url().refine((u) => u.startsWith('https://'), 'https only');

export const PlaceCardSchema = z.object({
  type: z.literal('place'),
  name: z.string().min(1).max(120),
  category: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  rating: z.number().min(0).max(5).optional(),
  hours: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  url: httpsUrl.optional(),
});

export const ImageCardSchema = z.object({
  type: z.literal('image'),
  url: httpsUrl,
  alt: z.string().min(1).max(200),
  credit: z.string().max(120).optional(),
});

export const LinkCardSchema = z.object({
  type: z.literal('link'),
  url: httpsUrl,
  title: z.string().min(1).max(160),
  description: z.string().max(300).optional(),
  site: z.string().max(80).optional(),
});

export const CardSchema = z.discriminatedUnion('type', [PlaceCardSchema, ImageCardSchema, LinkCardSchema]);

export type PlaceCard = z.infer<typeof PlaceCardSchema>;
export type ImageCard = z.infer<typeof ImageCardSchema>;
export type LinkCard = z.infer<typeof LinkCardSchema>;
export type Card = z.infer<typeof CardSchema>;

export const CARDS_LANG = 'cards';
export const MAX_CARDS = 10;

/** The valid cards in a `cards` block's body; an empty list if it can't be read (e.g. still streaming). */
export function parseCards(body: string): Card[] {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return [];
  }
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((c) => CardSchema.safeParse(c))
    .filter((r) => r.success)
    .map((r) => r.data)
    .slice(0, MAX_CARDS);
}

/** Tells the model when and how to use cards. */
export const CARDS_GUIDANCE = [
  'You can show rich cards in a reply with a fenced block whose language is "cards", holding a JSON array. Card types:',
  '- {"type":"place","name","category"?,"address"?,"lat"?,"lon"?,"rating"? (0-5),"hours"?,"phone"?,"url"?}',
  '- {"type":"image","url","alt","credit"?} (https image URLs only)',
  '- {"type":"link","url","title","description"?,"site"?}',
  'Use cards only for real details you were given in this conversation or by a tool result. Never invent places, addresses, ratings, phone numbers, images or links. Without real details, answer in text and suggest where to look.',
  'Put a one-line text answer before the block. Keep to 5 cards or fewer.',
].join('\n');
