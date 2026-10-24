import { Platform } from 'react-native';
import { DEMO } from './demo';

// The shared web preview is served from an arbitrary path. Pin relative asset
// URLs (fonts, route chunks) to where the page was loaded from, then start
// routing at "/" so the app opens on its first screen.
if (DEMO && Platform.OS === 'web' && typeof document !== 'undefined') {
  const base = document.createElement('base');
  base.href = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  document.head.prepend(base);
  history.replaceState(null, '', '/');
}
