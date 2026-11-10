import { useColorScheme } from 'react-native';
import { usePreferences } from '@/state/preferences';
import { dark, light, type Palette } from './tokens';

export * from './tokens';

/**
 * The palette for the user's light/dark choice, or the device setting when
 * they chose System. Screens that call this also re-render when the font
 * changes.
 */
export function useTheme(): Palette {
  const device = useColorScheme();
  const { appearance } = usePreferences();
  const scheme = appearance === 'system' ? device : appearance;
  return scheme === 'dark' ? dark : light;
}
