export type ConvoTag = '一般' | '交易中' | '買家詢問' | '系統';

export interface Me {
  id: string;
  name: string;
  email: string;
}

export interface Peer {
  id: string;
  name: string;
}

export interface Conversation {
  id: string;
  tag: ConvoTag;
  peerId: string | null;
  peerName: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  /** 樂觀更新用:訊息還沒被伺服器確認 */
  pending?: boolean;
  failed?: boolean;
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
  listPeers(): Promise<Peer[]>;
  startConversation(peerId: string, tag: ConvoTag): Promise<string>;

  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string): Promise<Message>;
  markRead(conversationId: string): Promise<void>;

  /** 訂閱單一對話的新訊息 */
  subscribeToConversation(conversationId: string, cb: (m: Message) => void): () => void;
  /** 訂閱所有對話的變動(用來更新列表與未讀角標) */
  subscribeToInbox(cb: () => void): () => void;
}
