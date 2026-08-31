export type ConvoTag = '一般' | '交易中' | '買家詢問' | '系統';

export interface Me {
  id: string;
  name: string;
  email: string;
  /** 給別人加你用的短代碼,像 LINE ID */
  userCode: string;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  price: number;
  year: number | null;
  mileage: number | null;
  location: string;
  accent: string;
  isMine: boolean;
}

export interface Conversation {
  id: string;
  tag: ConvoTag;
  peerId: string | null;
  peerName: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  /** 這個對話是從哪則刊登開始的,沒有就是直接聯絡 */
  listingTitle: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
}

export interface NewListing {
  title: string;
  price: number;
  year: number | null;
  mileage: number | null;
  location: string;
}

/** 訊息模組需要的所有後端操作。Supabase 與 demo 兩種實作共用這個介面。 */
export interface Backend {
  readonly isDemo: boolean;
  getMe(): Promise<Me | null>;
  onAuthChange(cb: (me: Me | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirm: boolean }>;
  signOut(): Promise<void>;

  listConversations(): Promise<Conversation[]>;
  listListings(): Promise<Listing[]>;
  createListing(input: NewListing): Promise<void>;
  deleteListing(id: string): Promise<void>;

  /** 從車輛刊登聯絡賣家 */
  startFromListing(listingId: string): Promise<string>;
  /** 用使用者代碼或信箱直接聯絡 */
  startByHandle(handle: string): Promise<string>;

  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string): Promise<Message>;
  markRead(conversationId: string): Promise<void>;

  subscribeToConversation(conversationId: string, cb: (m: Message) => void): () => void;
  subscribeToInbox(cb: () => void): () => void;
}
