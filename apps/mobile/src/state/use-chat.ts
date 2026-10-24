import type { ChatMessage, ChatMode } from '@raco/shared';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAiConsent } from '@/lib/ai-consent';
import { ChatError, streamChat } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export interface UiMessage extends ChatMessage {
  /** True while the reply is still streaming in. */
  pending?: boolean;
}

interface ChatState {
  conversationId: string | null;
  /** The conversation's title, once known. */
  title: string | null;
  /** The project the conversation is filed under, if any. */
  projectId: string | null;
  messages: UiMessage[];
  loading: boolean;
  streaming: boolean;
  error: string | null;
  send(text: string): Promise<void>;
  /** Sends the last message again after an error. */
  retry(): void;
  stop(): void;
}

let localId = 0;
const nextLocalId = () => `local-${++localId}`;

/**
 * One conversation: loads its history, sends messages and streams replies.
 * `onConversation` fires when the server creates a new conversation.
 */
export function useChat(
  initialId: string | null,
  onConversation?: (id: string) => void,
  mode: ChatMode = 'text',
  /** Files a new conversation under this project. */
  projectId?: string,
): ChatState {
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(!!initialId);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [chatProjectId, setChatProjectId] = useState<string | null>(projectId ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const { ensure: ensureConsent } = useAiConsent();
  // Only an existing chat loads history. A new chat gets its id mid-stream,
  // and reloading then would replace the reply that's still streaming in.
  const [historyId] = useState(initialId);

  useEffect(() => {
    if (!historyId) return;
    let active = true;
    void supabase
      .from('conversations')
      .select('title, project_id')
      .eq('id', historyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setTitle(data.title);
        setChatProjectId(data.project_id ?? null);
      });
    supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', historyId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError("Couldn't load this chat.");
        else setMessages((data ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at })));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || abortRef.current) return;
      if (!(await ensureConsent())) {
        setError('Raco can’t reply until you agree. Send again to see the terms.');
        return;
      }

      const now = new Date().toISOString();
      const replyId = nextLocalId();
      setError(null);
      setMessages((m) => [
        ...m,
        { id: nextLocalId(), role: 'user', content: message, createdAt: now },
        { id: replyId, role: 'assistant', content: '', createdAt: now, pending: true },
      ]);
      setStreaming(true);
      const abort = new AbortController();
      abortRef.current = abort;

      const patchReply = (fn: (m: UiMessage) => UiMessage) =>
        setMessages((all) => all.map((m) => (m.id === replyId ? fn(m) : m)));

      let firstToken = true;
      try {
        for await (const event of streamChat({ conversationId: conversationId ?? undefined, projectId: conversationId ? undefined : projectId, message, mode }, abort.signal)) {
          switch (event.type) {
            case 'conversation':
              setTitle(event.title);
              if (!conversationId) {
                setConversationId(event.conversationId);
                onConversation?.(event.conversationId);
              }
              break;
            case 'delta':
              if (firstToken) {
                firstToken = false;
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              patchReply((m) => ({ ...m, content: m.content + event.text }));
              break;
            case 'done':
              patchReply((m) => ({ ...m, id: event.messageId, pending: false }));
              break;
            case 'error':
              setError(event.message);
              break;
          }
        }
      } catch (err) {
        setError(err instanceof ChatError ? err.message : 'Something went wrong. Please try again.');
      } finally {
        abortRef.current = null;
        setStreaming(false);
        // Drop an empty placeholder (refusal, error or stop before any text).
        setMessages((all) =>
          all.filter((m) => m.id !== replyId || m.content).map((m) => (m.id === replyId ? { ...m, pending: false } : m)),
        );
      }
    },
    [conversationId, onConversation, mode, ensureConsent, projectId],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || abortRef.current) return;
    // Drop the failed attempt so the message isn't shown twice.
    setMessages((all) => all.filter((m) => m.id !== lastUser.id));
    void send(lastUser.content);
  }, [messages, send]);

  return { conversationId, title, projectId: chatProjectId, messages, loading, streaming, error, send, retry, stop };
}
