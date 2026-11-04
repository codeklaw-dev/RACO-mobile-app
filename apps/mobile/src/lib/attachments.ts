import { MAX_ATTACHMENTS, MAX_FILE_CHARS, type Attachment } from '@raco/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { notify } from './dialog';

/** Long edge for photos sent to the model: enough to read text, small to send. */
const PHOTO_EDGE = 1568;

/** File types read as text on the phone. PDFs and Office files need the server, which isn't built yet. */
const TEXT_TYPES = ['text/*', 'application/json', 'application/xml', 'application/csv'];
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|xml|html?|ya?ml|log|ics|vcf|js|ts|tsx|py|swift|kt|java|rb|go|rs|sql|sh)$/i;

/**
 * Lets the user choose photos with the system picker (it shares only what
 * they pick, so no library permission is needed) and shrinks each to a JPEG.
 */
export async function pickPhotos(room: number): Promise<Attachment[]> {
  if (room <= 0) return tooMany();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: room,
    quality: 1,
  });
  if (result.canceled) return [];
  const photos: Attachment[] = [];
  for (const [i, asset] of result.assets.slice(0, room).entries()) {
    const scale = Math.min(1, PHOTO_EDGE / Math.max(asset.width, asset.height));
    const small = await manipulateAsync(
      asset.uri,
      scale < 1 ? [{ resize: { width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) } }] : [],
      { compress: 0.8, format: SaveFormat.JPEG, base64: true },
    );
    if (small.base64) {
      photos.push({ kind: 'image', name: asset.fileName ?? `Photo ${i + 1}.jpg`, mimeType: 'image/jpeg', data: small.base64 });
    }
  }
  return photos;
}

/** Lets the user choose text files (notes, CSV, code, etc.) and reads them. */
export async function pickFiles(room: number): Promise<Attachment[]> {
  if (room <= 0) return tooMany();
  const result = await DocumentPicker.getDocumentAsync({ type: Platform.OS === 'ios' ? '*/*' : TEXT_TYPES, multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  const files: Attachment[] = [];
  const skipped: string[] = [];
  for (const asset of result.assets.slice(0, room)) {
    const isText = asset.mimeType?.startsWith('text/') || TEXT_TYPES.includes(asset.mimeType ?? '') || TEXT_EXTENSIONS.test(asset.name);
    if (!isText) {
      skipped.push(asset.name);
      continue;
    }
    const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
    files.push({ kind: 'file', name: asset.name, text: text.slice(0, MAX_FILE_CHARS) });
  }
  if (skipped.length) {
    notify("Some files can't be read yet", `${skipped.join(', ')}: Raco can read text files such as notes, CSV and code for now. PDFs and documents are coming.`);
  }
  return files;
}

function tooMany(): Attachment[] {
  notify(`You can attach up to ${MAX_ATTACHMENTS} items`, 'Remove one to add another.');
  return [];
}

// The home screen's first message opens a new chat screen; its attachments
// are handed over here because they're too large for route params.
let handoff: Attachment[] = [];
export function handOffAttachments(attachments: Attachment[]) {
  handoff = attachments;
}
export function takeHandedOffAttachments(): Attachment[] {
  const taken = handoff;
  handoff = [];
  return taken;
}
