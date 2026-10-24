import { randomUUID } from 'node:crypto';
import { DEFAULT_AGENT_NAME, type MessageRole, type ReportReason } from '@raco/shared';
import type { VerifyToken } from './auth';
import type { Conversation, Store, StoredMessage, UsageRecord, UserContext } from './store';

/**
 * In-memory store for running the API locally without Supabase
 * (STORE=memory). Everything is lost when the process stops.
 */
export class MemoryStore implements Store {
  private readonly users = new Map<string, UserContext>();
  private readonly conversations = new Map<string, Conversation & { userId: string; updatedAt: number }>();
  private readonly messages: (StoredMessage & { id: string; conversationId: string; userId: string; at: number })[] = [];
  readonly usage: UsageRecord[] = [];
  readonly reports: { userId: string; messageId: string; content: string; reason: ReportReason; note?: string }[] = [];

  async getUserContext(userId: string): Promise<UserContext> {
    let ctx = this.users.get(userId);
    if (!ctx) {
      ctx = {
        userId,
        workspaceId: `ws-${userId}`,
        plan: 'free',
        displayName: null,
        agentName: DEFAULT_AGENT_NAME,
        interests: [],
        responseStyle: 'balanced',
        // Local runs only: the app asks for consent; here it's assumed.
        aiConsent: true,
      };
      this.users.set(userId, ctx);
    }
    return ctx;
  }

  async countUserMessagesSince(userId: string, since: Date): Promise<number> {
    return this.messages.filter((m) => m.userId === userId && m.role === 'user' && m.at >= since.getTime()).length;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | null> {
    const c = this.conversations.get(id);
    return c && c.userId === userId ? { id: c.id, title: c.title } : null;
  }

  async createConversation(ctx: UserContext, title: string): Promise<Conversation> {
    const id = randomUUID();
    this.conversations.set(id, { id, title, userId: ctx.userId, updatedAt: Date.now() });
    return { id, title };
  }

  async recentMessages(conversationId: string, limit: number): Promise<StoredMessage[]> {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .slice(-limit)
      .map(({ role, content }) => ({ role, content }));
  }

  async insertMessage(ctx: UserContext, conversationId: string, role: MessageRole, content: string): Promise<string> {
    const id = randomUUID();
    this.messages.push({ id, conversationId, userId: ctx.userId, role, content, at: Date.now() });
    return id;
  }

  async touchConversation(conversationId: string): Promise<void> {
    const c = this.conversations.get(conversationId);
    if (c) c.updatedAt = Date.now();
  }

  async recordUsage(usage: UsageRecord): Promise<void> {
    this.usage.push(usage);
  }

  async reportMessage(userId: string, messageId: string, reason: ReportReason, note?: string): Promise<boolean> {
    const m = this.messages.find((x) => x.id === messageId && x.userId === userId && x.role === 'assistant');
    if (!m) return false;
    this.reports.push({ userId, messageId, content: m.content, reason, note });
    return true;
  }

  async deleteUser(userId: string): Promise<void> {
    for (let i = this.reports.length - 1; i >= 0; i--) if (this.reports[i]!.userId === userId) this.reports.splice(i, 1);
    this.users.delete(userId);
    for (const [id, c] of this.conversations) if (c.userId === userId) this.conversations.delete(id);
    for (let i = this.messages.length - 1; i >= 0; i--) if (this.messages[i]!.userId === userId) this.messages.splice(i, 1);
  }
}

/**
 * Local-only login for STORE=memory: a bearer token "dev:<name>" signs in as
 * that user. Never used with the Supabase store.
 */
export const devTokenVerifier: VerifyToken = async (token) => {
  const m = token.match(/^dev:([\w-]{1,64})$/);
  return m ? { id: m[1]! } : null;
};
