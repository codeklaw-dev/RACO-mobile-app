import { useState } from 'react';
import { Alert, Platform, TextInput, View } from 'react-native';
import { MAX_MESSAGE_CHARS } from '@raco/shared';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { IconButton } from './button';
import { MicIcon, PlusIcon, SendIcon, StopIcon, VoiceIcon } from './icons';
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

  const submit = () => {
    if (!hasText || streaming) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View
      style={[
        surfaceStyle(glass),
        { borderWidth: 0, borderRadius: 20, padding: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
      ]}>
      <IconButton kind="plain" size={40} label="Add photos and files" onPress={() => comingSoon('Adding files')}>
        <PlusIcon color={t.text} />
      </IconButton>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Ask anything"
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
      {!hasText && !streaming ? (
        <IconButton kind="plain" size={40} label="Dictate" onPress={() => comingSoon('Dictation')}>
          <MicIcon color={t.text} />
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
