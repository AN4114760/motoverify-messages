import type { Backend, Conversation, ConvoTag, Me, Message, Peer } from './types';

/**
 * 沒有設定 Supabase 環境變數時使用的假後端。
 * 資料存在記憶體,重整就沒了 — 它的用途只是讓部署好的網址一打開就有東西可看,
 * 以及讓你在還沒建 Supabase 專案前就能確認 UI。
 */

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

const ME: Me = { id: 'demo-me', name: '小魚', email: 'demo@motoverify.test' };

const PEERS: Peer[] = [
  { id: 'demo-kai', name: '阿凱' },
  { id: 'demo-ivy', name: '買家 Ivy' },
  { id: 'demo-chang', name: '車行老張' },
  { id: 'demo-rider', name: 'Rider_TW' },
];

interface DemoConvo {
  id: string;
  tag: ConvoTag;
  peerId: string;
  peerName: string;
  lastReadAt: string;
}

const convos: DemoConvo[] = [
  { id: 'c1', tag: '交易中', peerId: 'demo-kai', peerName: '阿凱', lastReadAt: iso(400) },
  { id: 'c2', tag: '買家詢問', peerId: 'demo-ivy', peerName: '買家 Ivy', lastReadAt: iso(400) },
  { id: 'c3', tag: '交易中', peerId: 'demo-chang', peerName: '車行老張', lastReadAt: iso(1) },
  { id: 'c4', tag: '一般', peerId: 'demo-rider', peerName: 'Rider_TW', lastReadAt: iso(1) },
];

let seq = 0;
const mkId = () => `m${++seq}`;

const messages: Message[] = [
  { id: mkId(), conversationId: 'c1', senderId: 'demo-kai', content: '你好,這台還在嗎?', createdAt: iso(70) },
  { id: mkId(), conversationId: 'c1', senderId: ME.id, content: '你好!還在喔!', createdAt: iso(69) },
  { id: mkId(), conversationId: 'c1', senderId: 'demo-kai', content: '可以的話明天看車嗎?', createdAt: iso(68) },
  { id: mkId(), conversationId: 'c1', senderId: ME.id, content: '可以啊,下午三點方便嗎?', createdAt: iso(67) },
  { id: mkId(), conversationId: 'c1', senderId: 'demo-kai', content: '好,那就明天下午三點!', createdAt: iso(12) },
  { id: mkId(), conversationId: 'c2', senderId: 'demo-ivy', content: '請問最低可以多少呢?', createdAt: iso(56) },
  { id: mkId(), conversationId: 'c3', senderId: 'demo-chang', content: '謝謝你的購買,我們明天交車', createdAt: iso(150) },
  { id: mkId(), conversationId: 'c4', senderId: 'demo-rider', content: '推薦一下新手入門車款喔!', createdAt: iso(1400) },
];

const REPLIES = ['好的,收到!', '我再確認一下時間', '沒問題,那就這樣說定', '方便的話可以傳張照片嗎?'];

type Listener = (m: Message) => void;
const convoListeners = new Map<string, Set<Listener>>();
const inboxListeners = new Set<() => void>();

function emit(m: Message) {
  convoListeners.get(m.conversationId)?.forEach((cb) => cb(m));
  inboxListeners.forEach((cb) => cb());
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createDemoBackend(): Backend {
  let signedIn = false; // 展示模式也走一次登入流程,任意信箱密碼都會通過
  const authListeners = new Set<(me: Me | null) => void>();

  return {
    isDemo: true,

    async getMe() {
      return signedIn ? ME : null;
    },
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    async signIn() {
      signedIn = true;
      authListeners.forEach((cb) => cb(ME));
    },
    async signUp() {
      signedIn = true;
      authListeners.forEach((cb) => cb(ME));
      return { needsConfirm: false };
    },
    async signOut() {
      signedIn = false;
      authListeners.forEach((cb) => cb(null));
    },

    async listConversations() {
      await wait(120);
      return convos
        .map((c): Conversation => {
          const mine = messages.filter((m) => m.conversationId === c.id);
          const last = mine[mine.length - 1];
          return {
            id: c.id,
            tag: c.tag,
            peerId: c.peerId,
            peerName: c.peerName,
            lastMessage: last?.content ?? '還沒有訊息',
            updatedAt: last?.createdAt ?? iso(9999),
            unread: mine.filter((m) => m.senderId !== ME.id && m.createdAt > c.lastReadAt).length,
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async listPeers() {
      return PEERS.filter((p) => !convos.some((c) => c.peerId === p.id));
    },

    async startConversation(peerId, tag) {
      const existing = convos.find((c) => c.peerId === peerId);
      if (existing) return existing.id;
      const peer = PEERS.find((p) => p.id === peerId);
      const id = `c${convos.length + 1}-${Date.now()}`;
      convos.push({ id, tag, peerId, peerName: peer?.name ?? '新對象', lastReadAt: new Date().toISOString() });
      return id;
    },

    async listMessages(conversationId) {
      await wait(100);
      return messages.filter((m) => m.conversationId === conversationId);
    },

    async sendMessage(conversationId, content) {
      await wait(180);
      const msg: Message = {
        id: mkId(),
        conversationId,
        senderId: ME.id,
        content,
        createdAt: new Date().toISOString(),
      };
      messages.push(msg);
      inboxListeners.forEach((cb) => cb());

      // 模擬對方回覆,讓 realtime 的路徑在 demo 模式下也看得出來
      const convo = convos.find((c) => c.id === conversationId);
      if (convo) {
        setTimeout(() => {
          const reply: Message = {
            id: mkId(),
            conversationId,
            senderId: convo.peerId,
            content: REPLIES[Math.floor(Math.random() * REPLIES.length)],
            createdAt: new Date().toISOString(),
          };
          messages.push(reply);
          emit(reply);
        }, 1400);
      }
      return msg;
    },

    async markRead(conversationId) {
      const c = convos.find((x) => x.id === conversationId);
      if (c) c.lastReadAt = new Date().toISOString();
      inboxListeners.forEach((cb) => cb());
    },

    subscribeToConversation(conversationId, cb) {
      if (!convoListeners.has(conversationId)) convoListeners.set(conversationId, new Set());
      convoListeners.get(conversationId)!.add(cb);
      return () => convoListeners.get(conversationId)?.delete(cb);
    },

    subscribeToInbox(cb) {
      inboxListeners.add(cb);
      return () => inboxListeners.delete(cb);
    },
  };
}
