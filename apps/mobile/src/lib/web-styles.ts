import { Platform } from 'react-native';

// Phones show a thin scroll indicator only while scrolling. Browsers keep a
// permanent scrollbar, which looks out of place in the app, so hide it on the
// web; scrolling with touch, wheel and keys still works.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '* { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }';
  document.head.appendChild(style);
}
