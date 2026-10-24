import { useRef, useState } from 'react';
import { Alert, Platform, TextInput, View } from 'react-native';
import { MAX_MESSAGE_CHARS } from '@raco/shared';
import { useDictation } from '@/lib/voice';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { IconButton } from './button';
import { ICONS, MicIcon, PathIcon, PlusIcon, SendIcon, StopIcon, VoiceIcon } from './icons';
import { surfaceStyle, useSurface } from './surface';

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  /** Opens voice mode (the voice canvas). */
  onVoice?: () => void;
  streaming?: boolean;
  autoFocus?: boolean;
  initialText?: string;
}

const comingSoon = (what: string) => Alert.alert(`${what} is coming soon`, 'This is on the roadmap for the next release.');

/**
 * The "Ask anything" bar. The accent button is voice mode while empty, send
 * once there's text, and stop while a reply is streaming.
 */
export function Composer({ onSend, onStop, onVoice, streaming, autoFocus, initialText = '' }: Props) {
  const t = useTheme();
  const glass = useSurface('glass');
  const [text, setText] = useState(initialText);
  const hasText = text.trim().length > 0;
  // Dictated words are added after whatever was typed before the mic opened.
  const typedBefore = useRef('');
  const dictation = useDictation((spoken) => setText(`${typedBefore.current}${typedBefore.current && spoken ? ' ' : ''}${spoken}`));

  const submit = () => {
    if (!hasText || streaming) return;
    if (dictation.listening) void dictation.toggle();
    onSend(text.trim());
    setText('');
  };

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
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 4,
        },
      ]}>
      <IconButton kind="plain" size={40} label="Add photos and files" onPress={() => comingSoon('Adding files')}>
        <PlusIcon color={t.text} />
      </IconButton>
      <TextInput
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
        style={{
          flex: 1,
          minHeight: 40,
          maxHeight: 140,
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
      ) : hasText ? (
        <IconButton kind="accent" size={40} label="Send" onPress={submit}>
          <SendIcon color="#2A2A2B" />
        </IconButton>
      ) : (
        <IconButton kind="accent" size={40} label="Voice mode" onPress={onVoice ?? (() => comingSoon('Voice mode'))}>
          <VoiceIcon color="#2A2A2B" />
        </IconButton>
      )}
    </View>
  );
}
