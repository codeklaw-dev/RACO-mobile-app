import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const SIZE = 256;

/**
 * Lets the user choose a photo from their library and returns it as a small
 * square JPEG data URI, or null if they cancelled. The system photo picker
 * only shares the photo the user picks, so no library permission is needed.
 */
export async function pickAvatar(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const side = Math.min(asset.width, asset.height);
  const small = await manipulateAsync(
    asset.uri,
    [
      { crop: { originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side } },
      { resize: { width: SIZE, height: SIZE } },
    ],
    { compress: 0.8, format: SaveFormat.JPEG, base64: true },
  );
  return small.base64 ? `data:image/jpeg;base64,${small.base64}` : null;
}
