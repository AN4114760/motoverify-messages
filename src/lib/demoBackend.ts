import type { Backend, Conversation, ConvoTag, Listing, Me, Message, NewListing } from './types';

/**
 * 沒有設定 Supabase 環境變數時使用的假後端。
 * 資料存在記憶體,重整就沒了 — 用途是讓部署好的網址一打開就有東西可看。
 */

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

const ME: Me = { id: 'demo-me', name: '小魚', email: 'demo@motoverify.test', userCode: 'K7M2QX' };

const SELLERS = [
  { id: 'demo-kai', name: '阿凱' },
  { id: 'demo-chang', name: '車行老張' },
  { id: 'demo-rider', name: 'Rider_TW' },
];

const listings: Listing[] = [
  { id: 'l1', sellerId: 'demo-kai', sellerName: '阿凱', title: '2020 山葉 勁戰六代', price: 78000, year: 2020, mileage: 12400, location: '台北市 中正區', accent: '#3360E4', isMine: false },
  { id: 'l2', sellerId: 'demo-chang', sellerName: '車行老張', title: '2019 光陽 雷霆S 125', price: 52000, year: 2019, mileage: 23800, location: '新北市 板橋區', accent: '#1FA463', isMine: false },
  { id: 'l3', sellerId: 'demo-rider', sellerName: 'Rider_TW', title: '2022 Gogoro VIVA MIX', price: 61000, year: 2022, mileage: 8100, location: '台北市 大安區', accent: '#E8912C', isMine: false },
  { id: 'l4', sellerId: ME.id, sellerName: ME.name, title: '2018 三陽 DRG 158', price: 66000, year: 2018, mileage: 31500, location: '桃園市 中壢區', accent: '#E5484D', isMine: true },
];

interface DemoConvo {
  id: string;
  tag: ConvoTag;
  peerId: string;
  peerName: string;
  lastReadAt: string;
  listingTitle: string | null;
}

const convos: DemoConvo[] = [
  { id: 'c1', tag: '買家詢問', peerId: 'demo-kai', peerName: '阿凱', lastReadAt: iso(400), listingTitle: '2020 山葉 勁戰六代' },
  { id: 'c2', tag: '一般', peerId: 'demo-rider', peerName: 'Rider_TW', lastReadAt: iso(1), listingTitle: null },
];

let seq = 0;
const mkId = () => `m${++seq}`;

const messages: Message[] = [
  { id: mkId(), conversationId: 'c1', senderId: ME.id, content: '你好,這台還在嗎?', createdAt: iso(70) },
  { id: mkId(), conversationId: 'c1', senderId: 'demo-kai', content: '還在喔!有興趣可以約看車', createdAt: iso(69) },
  { id: mkId(), conversationId: 'c1', senderId: ME.id, content: '明天下午三點方便嗎?', createdAt: iso(68) },
  { id: mkId(), conversationId: 'c1', senderId: 'demo-kai', content: '可以,那就明天下午三點', createdAt: iso(12) },
  { id: mkId(), conversationId: 'c2', senderId: 'demo-rider', content: '推薦一下新手入門車款喔!', createdAt: iso(1400) },
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

  function openWith(peerId: string, peerName: string, listingTitle: string | null, tag: ConvoTag) {
    const found = convos.find((c) => c.peerId === peerId && c.listingTitle === listingTitle);
    if (found) return found.id;
    const id = `c-${Date.now()}`;
    convos.push({ id, tag, peerId, peerName, lastReadAt: new Date().toISOString(), listingTitle });
    return id;
  }

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
            listingTitle: c.listingTitle,
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async listListings() {
      await wait(100);
      return listings;
    },

    async createListing(input: NewListing) {
      listings.unshift({
        id: `l-${Date.now()}`,
        sellerId: ME.id,
        sellerName: ME.name,
        title: input.title,
        price: input.price,
        year: input.year,
        mileage: input.mileage,
        location: input.location,
        accent: '#7A5AF0',
        isMine: true,
      });
    },

    async deleteListing(id) {
      const i = listings.findIndex((l) => l.id === id);
      if (i >= 0) listings.splice(i, 1);
    },

    async startFromListing(listingId) {
      const l = listings.find((x) => x.id === listingId);
      if (!l) throw new Error('找不到這則刊登');
      if (l.isMine) throw new Error('這是你自己的刊登');
      return openWith(l.sellerId, l.sellerName, l.title, '買家詢問');
    },

    async startByHandle(handle) {
      const h = handle.trim().toUpperCase();
      if (!h) throw new Error('請輸入代碼或信箱');
      if (h === ME.userCode) throw new Error('不能和自己開對話');
      // 展示模式:任何代碼都對到第一個假賣家
      const peer = SELLERS[0];
      return openWith(peer.id, peer.name, null, '一般');
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
