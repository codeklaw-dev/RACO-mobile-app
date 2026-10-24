/**
 * Design tokens taken from the RACO AI Assistant iOS canvas. Light and dark
 * share the same shape so components never branch on the scheme themselves.
 */

export const accent = '#FC7965';

export const fonts = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  display: 'InstrumentSans_600SemiBold',
  displayBold: 'InstrumentSans_700Bold',
} as const;

export interface Palette {
  scheme: 'light' | 'dark';
  background: string;
  text: string;
  sub: string;
  faint: string;
  /** Accent used for text on the light background, darker for contrast. */
  accentText: string;
  hairline: string;
  stepTodo: string;
  stepDone: string;
  glass: Surface;
  primary: Surface;
  field: Surface;
  tile: string;
  /** The user's own chat messages. */
  bubble: string;
  switchTrackOff: string;
  stageGradient: string;
  shimmer: string;
}

export interface Surface {
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  color: string;
  backgroundImage?: string;
}

export const accentSurface: Surface = {
  backgroundColor: 'rgba(252,121,101,0.92)',
  borderColor: 'rgba(255,255,255,0.35)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 12px rgba(252,121,101,0.25)',
  color: '#2A2A2B',
};

export const light: Palette = {
  scheme: 'light',
  background: '#EBEBED',
  text: '#2A2A2B',
  sub: '#55555A',
  faint: '#5F5F64',
  accentText: '#C2412E',
  hairline: 'rgba(42,42,43,0.08)',
  stepTodo: 'rgba(42,42,43,0.12)',
  stepDone: '#2A2A2B',
  glass: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderColor: 'rgba(255,255,255,0.95)',
    boxShadow: 'inset 0 1px 0 #FFFFFF, 0 1px 2px rgba(42,42,43,0.05), 0 4px 14px rgba(42,42,43,0.05)',
    color: '#2A2A2B',
  },
  primary: {
    backgroundColor: 'rgba(42,42,43,0.88)',
    borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 12px rgba(42,42,43,0.16)',
    color: '#FFFFFF',
  },
  field: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(255,255,255,0.95)',
    boxShadow: '0 4px 14px rgba(42,42,43,0.05)',
    color: '#2A2A2B',
  },
  tile: 'rgba(42,42,43,0.06)',
  bubble: 'rgba(42,42,43,0.075)',
  switchTrackOff: 'rgba(42,42,43,0.14)',
  stageGradient: 'linear-gradient(180deg, #D6D6DB 0%, #C9C9CF 50%, #B4B4BC 100%)',
  shimmer: 'rgba(42,42,43,0.45)',
};

export const dark: Palette = {
  scheme: 'dark',
  background: '#2A2A2B',
  text: '#F5F5F7',
  sub: '#B4B4B9',
  faint: '#9C9CA2',
  accentText: accent,
  hairline: 'rgba(255,255,255,0.10)',
  stepTodo: 'rgba(255,255,255,0.16)',
  stepDone: '#F5F5F7',
  glass: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))',
    borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.22)',
    color: '#F5F5F7',
  },
  primary: {
    backgroundColor: 'rgba(245,245,247,0.92)',
    borderColor: 'rgba(255,255,255,0.7)',
    boxShadow: 'inset 0 1px 0 #FFFFFF, 0 4px 14px rgba(0,0,0,0.25)',
    color: '#2A2A2B',
  },
  field: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
    boxShadow: 'none',
    color: '#F5F5F7',
  },
  tile: 'rgba(255,255,255,0.08)',
  bubble: 'rgba(255,255,255,0.10)',
  switchTrackOff: 'rgba(255,255,255,0.16)',
  stageGradient: 'linear-gradient(180deg, #141415 0%, #222224 50%, #3A3A3E 100%)',
  shimmer: 'rgba(245,245,247,0.5)',
};

/** Removes the browser focus outline on web; fields draw their own focus ring. */
// Chrome draws its own focus ring on web text inputs unless the outline style
// is "none"; React Native's types don't list that value, hence the cast.
export const noWebOutline = { outlineWidth: 0, outlineColor: 'transparent', outlineStyle: 'none' as 'solid' } as const;

export const radius = {
  control: 14,
  button: 12,
  card: 18,
  sheet: 22,
} as const;

/** Screen padding from the design (62px top includes the status bar area). */
export const gutter = 24;

/**
 * A CSS gradient as a view background. React Native (0.86) takes it as
 * `experimental_backgroundImage`; react-native-web passes `backgroundImage`
 * through to CSS. Both are set so it works everywhere.
 */
export function gradient(css: string): object {
  return { experimental_backgroundImage: css, backgroundImage: css };
}
