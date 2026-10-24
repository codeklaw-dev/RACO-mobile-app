import { View, type ViewProps, type ViewStyle } from 'react-native';
import { accentSurface, gradient, useTheme, type Surface as SurfaceTokens } from '@/theme';

export type SurfaceKind = 'glass' | 'primary' | 'accent' | 'field';

export function useSurface(kind: SurfaceKind): SurfaceTokens {
  const t = useTheme();
  if (kind === 'accent') return accentSurface;
  return t[kind];
}

/** Style for one of the design's "liquid glass" surfaces. */
export function surfaceStyle(s: SurfaceTokens): ViewStyle {
  return {
    backgroundColor: s.backgroundColor,
    borderColor: s.borderColor,
    borderWidth: 1,
    boxShadow: s.boxShadow,
    ...(s.backgroundImage ? gradient(s.backgroundImage) : null),
  };
}

interface Props extends ViewProps {
  kind?: SurfaceKind;
  radius?: number;
}

export function Surface({ kind = 'glass', radius = 22, style, ...rest }: Props) {
  const s = useSurface(kind);
  return <View style={[surfaceStyle(s), { borderRadius: radius }, style]} {...rest} />;
}
