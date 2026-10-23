import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MessageRole, Plan, ResponseStyle } from '@raco/shared';

export interface UserContext {
  userId: string;
  workspaceId: string;
  plan: Plan;
  displayName: string | null;
  agentName: string;
  interests: string[];
  responseStyle: ResponseStyle;
}

export interface Conversation {
  id: string;
  title: string;
}

export interface StoredMessage {
  role: MessageRole;
  content: string;
}

export interface UsageRecord {
  workspaceId: string;
  userId: string;
  conversationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Everything the chat route needs from the database. */
export interface Store {
  getUserContext(userId: string): Promise<UserContext | null>;
  countUserMessagesSince(userId: string, since: Date): Promise<number>;
  getConversation(id: string, userId: string): Promise<Conversation | null>;
  createConversation(ctx: UserContext, title: string): Promise<Conversation>;
  recentMessages(conversationId: string, limit: number): Promise<StoredMessage[]>;
  insertMessage(
    ctx: UserContext,
    conversationId: string,
    role: MessageRole,
    content: string,
    model?: string,
  ): Promise<string>;
  touchConversation(conversationId: string): Promise<void>;
  recordUsage(usage: UsageRecord): Promise<void>;
  /** Permanently deletes the user; their data cascades from auth.users. */
  deleteUser(userId: string): Promise<void>;
}

/**
 * Store backed by Supabase using the service role. Every query is scoped to
 * the authenticated user explicitly, because the service role bypasses RLS.
 */
export class SupabaseStore implements Store {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async getUserContext(userId: string): Promise<UserContext | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select(
        'default_workspace_id, display_name, agent_name, interests, response_style, workspaces!profiles_default_workspace_id_fkey(plan)',
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const ws = data.workspaces as unknown as { plan: Plan } | null;
    return {
      userId,
      workspaceId: data.default_workspace_id,
      plan: ws?.plan ?? 'free',
      displayName: data.display_name,
      agentName: data.agent_name,
      interests: data.interests ?? [],
      responseStyle: data.response_style,
    };
  }

  async countUserMessagesSince(userId: string, since: Date): Promise<number> {
    const { count, error } = await this.db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', since.toISOString());
    if (error) throw error;
    return count ?? 0;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from('conversations')
      .select('id, title')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async createConversation(ctx: UserContext, title: string): Promise<Conversation> {
    const { data, error } = await this.db
      .from('conversations')
      .insert({ workspace_id: ctx.workspaceId, user_id: ctx.userId, title })
      .select('id, title')
      .single();
    if (error) throw error;
    return data;
  }

  async recentMessages(conversationId: string, limit: number): Promise<StoredMessage[]> {
    const { data, error } = await this.db
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).reverse();
  }

  async insertMessage(
    ctx: UserContext,
    conversationId: string,
    role: MessageRole,
    content: string,
    model?: string,
  ): Promise<string> {
    const { data, error } = await this.db
      .from('messages')
      .insert({
        conversation_id: conversationId,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        role,
        content,
        model: model ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  async touchConversation(conversationId: string): Promise<void> {
    const { error } = await this.db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    if (error) throw error;
  }

  async recordUsage(u: UsageRecord): Promise<void> {
    const { error } = await this.db.from('usage_events').insert({
      workspace_id: u.workspaceId,
      user_id: u.userId,
      conversation_id: u.conversationId,
      model: u.model,
      input_tokens: u.inputTokens,
      output_tokens: u.outputTokens,
      cache_read_tokens: u.cacheReadTokens,
      cache_write_tokens: u.cacheWriteTokens,
    });
    if (error) throw error;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.db.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}
