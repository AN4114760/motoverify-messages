import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Backend, Conversation, ConvoTag, Me, Message, Peer } from './types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(URL && KEY && URL.startsWith('http'));

function toMe(user: User): Me {
  return {
    id: user.id,
    name: (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || '騎士',
    email: user.email ?? '',
  };
}

export function createSupabaseBackend(): Backend {
  const sb: SupabaseClient = createClient(URL!, KEY!);

  async function requireUid(): Promise<string> {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error('尚未登入');
    return data.user.id;
  }

  return {
    isDemo: false,

    async getMe() {
      const { data } = await sb.auth.getSession();
      return data.session ? toMe(data.session.user) : null;
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        cb(session ? toMe(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translate(error.message));
    },

    async signUp(email, password, name) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (error) throw new Error(translate(error.message));
      // 專案若開啟 email 驗證,session 會是 null
      return { needsConfirm: !data.session };
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async listConversations() {
      const uid = await requireUid();
      const { data, error } = await sb
        .from('conversation_overview')
        .select('*')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map(
        (r): Conversation => ({
          id: r.id,
          tag: (r.tag ?? '一般') as ConvoTag,
          peerId: r.peer_id,
          peerName: r.peer_name ?? '未知使用者',
          lastMessage: r.last_message ?? '還沒有訊息',
          updatedAt: r.updated_at,
          unread: Number(r.unread_count ?? 0),
        }),
      );
    },

    async listPeers() {
      const uid = await requireUid();
      const { data, error } = await sb
        .from('profiles')
        .select('id, display_name')
        .neq('id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((p): Peer => ({ id: p.id, name: p.display_name }));
    },

    async startConversation(peerId, tag) {
      const { data, error } = await sb.rpc('start_conversation', { peer: peerId, tag });
      if (error) throw new Error(error.message);
      return data as string;
    },

    async listMessages(conversationId) {
      const { data, error } = await sb
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToMessage);
    },

    async sendMessage(conversationId, content) {
      const uid = await requireUid();
      const { data, error } = await sb
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: uid, content })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return rowToMessage(data);
    },

    async markRead(conversationId) {
      const uid = await requireUid();
      await sb
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', uid);
    },

    subscribeToConversation(conversationId, cb) {
      const channel = sb
        .channel(`convo:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => cb(rowToMessage(payload.new)),
        )
        .subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },

    subscribeToInbox(cb) {
      // RLS 會過濾掉不屬於自己的對話,所以這裡收到的都是有權看的訊息
      const channel = sb
        .channel('inbox')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => cb())
        .subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },
  };
}

function rowToMessage(r: Record<string, unknown>): Message {
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    senderId: r.sender_id as string,
    content: r.content as string,
    createdAt: r.created_at as string,
  };
}

function translate(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return '帳號或密碼不正確';
  if (/User already registered/i.test(msg)) return '這個信箱已經註冊過了,直接登入吧';
  if (/Password should be at least/i.test(msg)) return '密碼至少要 6 個字元';
  if (/Email address .* is invalid/i.test(msg)) return '信箱格式不正確';
  return msg;
}
