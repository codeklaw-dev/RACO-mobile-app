import { Image, Text, View } from 'react-native';
import { accent, fonts } from '@/theme';

/** The profile photo, or the first letter of the name on the accent colour. */
export function Avatar({ name, photo, size }: { name: string; photo?: string | null; size: number }) {
  if (photo) {
    return <Image source={{ uri: photo }} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, color: '#2A2A2B' }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}
