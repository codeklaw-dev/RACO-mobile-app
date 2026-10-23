import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export * from './tokens';

/** The palette for the device's current light/dark setting. */
export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
