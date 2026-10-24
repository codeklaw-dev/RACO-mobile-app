import * as WebBrowser from 'expo-web-browser';
import { memo, useMemo, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View, type TextStyle } from 'react-native';
import { parseMarkdown, type Inline } from '@/lib/markdown';
import { fonts, useTheme, type Palette } from '@/theme';

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
                style={{ fontFamily: fonts.display, color: t.text, fontSize: b.level === 1 ? 24 : b.level === 2 ? 21 : 18, lineHeight: b.level === 1 ? 30 : 26 }}>
                {renderInline(b.children, t)}
              </Text>
            );
          case 'list':
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={[base, { minWidth: b.ordered ? 22 : 12, color: t.sub }]}>{b.ordered ? `${b.start + j}.` : '•'}</Text>
                    <Text selectable style={[base, { flex: 1 }]}>
                      {renderInline(item, t)}
                    </Text>
                  </View>
                ))}
              </View>
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
