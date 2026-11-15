import * as WebBrowser from 'expo-web-browser';
import { memo, useMemo, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View, type TextStyle } from 'react-native';
import { CARDS_LANG } from '@raco/shared';
import { parseMarkdown, type Inline } from '@/lib/markdown';
import { fonts, useTheme, type Palette } from '@/theme';
import { Cards } from './cards';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Renders an assistant reply. Re-parses on every streamed chunk; replies are small. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const t = useTheme();
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const base: TextStyle = { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: t.text };

  return (
    <View style={{ gap: 12 }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'paragraph':
            return (
              <Text key={i} selectable style={base}>
                {renderInline(b.children, t)}
              </Text>
            );
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={{
                  fontFamily: fonts.display,
                  color: t.text,
                  fontSize: b.level === 1 ? 24 : b.level === 2 ? 21 : 18,
                  lineHeight: b.level === 1 ? 30 : 26,
                }}>
                {renderInline(b.children, t)}
              </Text>
            );
          case 'list': {
            // Top-level items are numbered in order; nested ones get a hollow bullet.
            let n = b.start - 1;
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((item, j) => {
                  const depth = b.depths[j] ?? 0;
                  if (depth === 0) n++;
                  const marker = depth > 0 ? '◦' : b.ordered ? `${n}.` : '•';
                  return (
                    <View key={j} style={{ flexDirection: 'row', gap: 8, marginLeft: depth * 20 }}>
                      <Text style={[base, { minWidth: b.ordered && depth === 0 ? 22 : 12, color: t.sub }]}>{marker}</Text>
                      <Text selectable style={[base, { flex: 1 }]}>
                        {renderInline(item, t)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          }
          case 'rule':
            return <View key={i} style={{ height: 1, backgroundColor: t.hairline, marginVertical: 4 }} />;
          case 'table':
            return (
              <ScrollView
                key={i}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ borderRadius: 12, borderWidth: 1, borderColor: t.hairline }}>
                <View>
                  {[b.header, ...b.rows].map((row, r) => (
                    <View
                      key={r}
                      style={{
                        flexDirection: 'row',
                        backgroundColor: r === 0 ? t.tile : 'transparent',
                        borderTopWidth: r ? 1 : 0,
                        borderTopColor: t.hairline,
                      }}>
                      {row.map((cell, c) => (
                        <Text
                          key={c}
                          selectable
                          style={[
                            base,
                            { width: 140, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, lineHeight: 21 },
                            r === 0 && { fontFamily: fonts.bodySemibold },
                          ]}>
                          {renderInline(cell, t)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          case 'quote':
            return (
              <View key={i} style={{ paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: t.hairline }}>
                <Text selectable style={[base, { color: t.sub }]}>
                  {renderInline(b.children, t)}
                </Text>
              </View>
            );
          case 'code':
            if (b.lang === CARDS_LANG) return <Cards key={i} body={b.text} />;
            return (
              <ScrollView
                key={i}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ borderRadius: 12, backgroundColor: t.tile }}
                contentContainerStyle={{ padding: 12 }}>
                <Text selectable style={{ fontFamily: mono, fontSize: 14, lineHeight: 20, color: t.text }}>
                  {b.text}
                </Text>
              </ScrollView>
            );
        }
      })}
    </View>
  );
});

function renderInline(nodes: Inline[], t: Palette): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return n.text;
      case 'bold':
        return (
          <Text key={i} style={{ fontFamily: fonts.bodySemibold }}>
            {renderInline(n.children, t)}
          </Text>
        );
      case 'italic':
        return (
          <Text key={i} style={{ fontStyle: 'italic' }}>
            {renderInline(n.children, t)}
          </Text>
        );
      case 'code':
        return (
          <Text key={i} style={{ fontFamily: mono, fontSize: 15, backgroundColor: t.tile }}>
            {` ${n.text} `}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={i}
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(n.href)}
            style={{ color: t.accentText, textDecorationLine: 'underline' }}>
            {renderInline(n.children, t)}
          </Text>
        );
    }
  });
}
