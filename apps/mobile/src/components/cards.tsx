import { parseCards, type Card, type ImageCard, type LinkCard, type PlaceCard } from '@raco/shared';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { fonts, useTheme } from '@/theme';
import { surfaceStyle, useSurface } from './surface';

const CARD_WIDTH = 264;

/**
 * The cards in a reply's `cards` block: one card full width, several as a
 * row you swipe through. Nothing shows while the block is still streaming.
 */
export function Cards({ body }: { body: string }) {
  const cards = useMemo(() => parseCards(body), [body]);
  if (!cards.length) return null;
  if (cards.length === 1) return <CardView card={cards[0]!} />;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + 10}
      decelerationRate="fast"
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
      {cards.map((c, i) => (
        <View key={i} style={{ width: c.type === 'image' ? 200 : CARD_WIDTH }}>
          <CardView card={c} />
        </View>
      ))}
    </ScrollView>
  );
}

function CardView({ card }: { card: Card }) {
  switch (card.type) {
    case 'place':
      return <Place card={card} />;
    case 'image':
      return <Photo card={card} />;
    case 'link':
      return <Link card={card} />;
  }
}

function Tile({ children, onPress, label }: { children: React.ReactNode; onPress?: () => void; label?: string }) {
  const glass = useSurface('glass');
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [surfaceStyle(glass), { borderRadius: 22, padding: 14, gap: 4, flexGrow: 1, opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center', backgroundColor: pressed ? t.bubble : t.tile })}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13, color: t.text }}>{label}</Text>
    </Pressable>
  );
}

function mapsUrl(p: PlaceCard): string {
  const query = encodeURIComponent([p.name, p.address].filter(Boolean).join(', '));
  const at = p.lat !== undefined && p.lon !== undefined ? `${p.lat},${p.lon}` : null;
  if (Platform.OS === 'ios') return `https://maps.apple.com/?q=${query}${at ? `&ll=${at}` : ''}`;
  if (Platform.OS === 'android') return at ? `geo:${at}?q=${at}(${query})` : `geo:0,0?q=${query}`;
  return `https://www.google.com/maps/search/?api=1&query=${at ?? query}`;
}

function Place({ card }: { card: PlaceCard }) {
  const t = useTheme();
  const meta = [card.category, card.rating !== undefined ? `★ ${card.rating.toFixed(1)}` : null].filter(Boolean).join(' · ');
  return (
    <Tile>
      <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>
        {card.name}
      </Text>
      {meta ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.sub }}>{meta}</Text> : null}
      {card.address ? (
        <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 14, color: t.faint }}>
          {card.address}
        </Text>
      ) : null}
      {card.hours ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: t.sub }}>{card.hours}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <Pill label="Directions" onPress={() => void Linking.openURL(mapsUrl(card))} />
        {card.phone ? <Pill label="Call" onPress={() => void Linking.openURL(`tel:${card.phone!.replace(/[^\d+]/g, '')}`)} /> : null}
        {card.url ? <Pill label="Website" onPress={() => void WebBrowser.openBrowserAsync(card.url!)} /> : null}
      </View>
    </Tile>
  );
}

function Photo({ card }: { card: ImageCard }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ gap: 4 }}>
      <Image
        source={{ uri: card.url }}
        accessibilityLabel={card.alt}
        onError={() => setFailed(true)}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 20, backgroundColor: t.tile }}
      />
      {card.credit ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.faint }}>{card.credit}</Text> : null}
    </View>
  );
}

function Link({ card }: { card: LinkCard }) {
  const t = useTheme();
  const site = card.site ?? new URL(card.url).hostname.replace(/^www\./, '');
  return (
    <Tile label={`${card.title}, ${site}`} onPress={() => void WebBrowser.openBrowserAsync(card.url)}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: t.faint }}>{site}</Text>
      <Text numberOfLines={2} style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>
        {card.title}
      </Text>
      {card.description ? (
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 14, color: t.sub }}>
          {card.description}
        </Text>
      ) : null}
    </Tile>
  );
}
