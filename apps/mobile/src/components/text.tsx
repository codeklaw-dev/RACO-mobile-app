import { Text, type TextProps, type TextStyle } from 'react-native';
import { fonts, useTheme } from '@/theme';

type Tone = 'text' | 'sub' | 'faint';

interface Props extends TextProps {
  tone?: Tone;
}

function useTone(tone: Tone): string {
  const t = useTheme();
  return t[tone];
}

/** Screen title: Instrument Sans 34/41. */
export function Title({ style, tone = 'text', ...rest }: Props) {
  const color = useTone(tone);
  return <Text accessibilityRole="header" style={[styles.title, { color }, style]} {...rest} />;
}

/** Body copy: Inter 17/24. */
export function Body({ style, tone = 'text', ...rest }: Props) {
  const color = useTone(tone);
  return <Text style={[styles.body, { color }, style]} {...rest} />;
}

/** Small labels and captions: Inter 13. */
export function Caption({ style, tone = 'faint', ...rest }: Props) {
  const color = useTone(tone);
  return <Text style={[styles.caption, { color }, style]} {...rest} />;
}

const styles: Record<'title' | 'body' | 'caption', TextStyle> = {
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
};
