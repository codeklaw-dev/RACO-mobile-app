import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MAX_ATTACHMENTS, MAX_MESSAGE_CHARS, type Attachment } from '@raco/shared';
import { pickFiles, pickPhotos } from '@/lib/attachments';
import { notify } from '@/lib/dialog';
import { useDictation } from '@/lib/voice';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { useActionSheet } from './action-sheet';
import { IconButton } from './button';
import { ICONS, MicIcon, PathIcon, PlusIcon, SendIcon, StopIcon, VoiceIcon } from './icons';
import { surfaceStyle, useSurface } from './surface';

interface Props {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  /** Opens voice mode (the voice canvas). */
  onVoice?: () => void;
  streaming?: boolean;
  autoFocus?: boolean;
  initialText?: string;
  /** Puts text in the box to edit, e.g. from a sent message's Edit button. A new `key` replaces what's there. */
  draft?: { text: string; key: number };
}

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 140;
const web = Platform.OS === 'web';

const comingSoon = (what: string) => Alert.alert(`${what} is coming soon`, 'This is on the roadmap for the next release.');

/**
 * The "Ask anything" bar. The accent button is voice mode while empty, send
 * once there's text, and stop while a reply is streaming.
 */
export function Composer({ onSend, onStop, onVoice, streaming, autoFocus, initialText = '', draft }: Props) {
  const t = useTheme();
  const glass = useSurface('glass');
  const sheet = useActionSheet();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState(initialText);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draftKey, setDraftKey] = useState(draft?.key);
  if (draft && draft.key !== draftKey) {
    setDraftKey(draft.key);
    setText(draft.text);
  }
  useEffect(() => {
    if (draftKey !== undefined) input.current?.focus();
  }, [draftKey]);
  const hasText = text.trim().length > 0;
  const canSend = hasText || attachments.length > 0;
  // On the web a textarea doesn't grow by itself: size it to its content so it
  // never shows a scrollbar until it reaches the maximum height.
  const [webHeight, setWebHeight] = useState(MIN_HEIGHT);
  // Dictated words are added after whatever was typed before the mic opened.
  const typedBefore = useRef('');
  const dictation = useDictation((spoken) => setText(`${typedBefore.current}${typedBefore.current && spoken ? ' ' : ''}${spoken}`));

  const submit = () => {
    if (!canSend || streaming) return;
    if (dictation.listening) void dictation.toggle();
    onSend(text.trim(), attachments);
    setText('');
    setAttachments([]);
    setWebHeight(MIN_HEIGHT);
  };

  const add = (pick: (room: number) => Promise<Attachment[]>) => async () => {
    try {
      const picked = await pick(MAX_ATTACHMENTS - attachments.length);
      if (picked.length) setAttachments((a) => [...a, ...picked].slice(0, MAX_ATTACHMENTS));
    } catch {
      notify("Couldn't add that", 'Please try another one.');
    }
  };

  const attach = () =>
    sheet({
      options: [
        { label: 'Photos', icon: ICONS.photo, onPress: () => void add(pickPhotos)() },
        { label: 'Files', icon: ICONS.document, onPress: () => void add(pickFiles)() },
      ],
    });

  const dictate = () => {
    if (!dictation.listening) typedBefore.current = text.trim();
    void dictation.toggle();
  };

  return (
    <View
      style={[
        surfaceStyle(glass),
        // A pill: fully round while it's one line, softly rounded as it grows.
        {
          borderWidth: 0,
          borderRadius: 28,
          paddingVertical: 8,
          paddingHorizontal: 8,
          gap: 6,
        },
      ]}>
      {attachments.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
          {attachments.map((a, i) => (
            <AttachmentChip key={`${a.name}-${i}`} attachment={a} onRemove={() => setAttachments((all) => all.filter((_, j) => j !== i))} />
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        <IconButton kind="plain" size={40} label="Add photos and files" onPress={attach}>
          <PlusIcon color={t.text} />
        </IconButton>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          placeholder={dictation.listening ? 'Listening…' : 'Ask anything'}
          placeholderTextColor={t.faint}
          accessibilityLabel="Message"
          selectionColor={accent}
          multiline
          // Web textareas default to two rows; native grows from one line.
          numberOfLines={Platform.OS === 'web' ? 1 : undefined}
          maxLength={MAX_MESSAGE_CHARS}
          autoFocus={autoFocus}
          submitBehavior="blurAndSubmit"
          returnKeyType="send"
          onSubmitEditing={submit}
          // With a keyboard, Enter sends and Shift+Enter starts a new line.
          onKeyPress={(e) => {
            const key = e.nativeEvent as { key: string; shiftKey?: boolean };
            if (web && key.key === 'Enter' && !key.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          onContentSizeChange={(e) => {
            if (web) setWebHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(e.nativeEvent.contentSize.height))));
          }}
          style={{
            flex: 1,
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
            ...(web ? { height: webHeight, overflow: webHeight < MAX_HEIGHT ? 'hidden' : 'scroll' } : null),
            paddingHorizontal: 4,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 17,
            lineHeight: 22,
            fontFamily: fonts.body,
            color: t.text,
            ...noWebOutline,
          }}
        />
        {dictation.available && !streaming ? (
          <IconButton kind="plain" size={40} label={dictation.listening ? 'Stop dictating' : 'Dictate'} onPress={dictate}>
            {dictation.listening ? <PathIcon d={ICONS.stopSquare} color={accent} size={18} strokeWidth={2} /> : <MicIcon color={t.text} />}
          </IconButton>
        ) : null}
        {streaming ? (
          <IconButton kind="accent" size={40} label="Stop generating" onPress={onStop}>
            <StopIcon color="#2A2A2B" />
          </IconButton>
        ) : canSend ? (
          <IconButton kind="accent" size={40} label="Send" onPress={submit}>
            <SendIcon color="#2A2A2B" />
          </IconButton>
        ) : (
          <IconButton kind="accent" size={40} label="Voice mode" onPress={onVoice ?? (() => comingSoon('Voice mode'))}>
            <VoiceIcon color="#2A2A2B" />
          </IconButton>
        )}
      </View>
    </View>
  );
}

/** A photo thumbnail or file name waiting to be sent, with a remove button. */
function AttachmentChip({ attachment: a, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const t = useTheme();
  return (
    <View>
      {a.kind === 'image' ? (
        <Image
          source={{ uri: `data:${a.mimeType};base64,${a.data}` }}
          accessibilityLabel={a.name}
          style={{ width: 56, height: 56, borderRadius: 14 }}
        />
      ) : (
        <View
          style={{
            height: 56,
            maxWidth: 180,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: t.tile,
          }}>
          <PathIcon d={ICONS.document} color={t.text} size={20} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.text }}>
            {a.name}
          </Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${a.name}`}
        onPress={onRemove}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: t.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <PathIcon d={ICONS.close} color={t.background} size={12} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}
