import { useCallback, useEffect, useState } from 'react';
import { backend } from './lib/backend';
import type { Conversation, Me } from './lib/types';
import { PhoneShell } from './components/PhoneShell';
import { AuthScreen } from './components/AuthScreen';
import { InboxScreen } from './components/InboxScreen';
import { MarketScreen } from './components/MarketScreen';
import { ChatScreen } from './components/ChatScreen';
import { IconMarket, IconMessages } from './lib/icons';

type Tab = 'market' | 'messages';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>('market');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    backend.getMe().then((u) => {
      if (!alive) return;
      setMe(u);
      setBooting(false);
    });
    const unsub = backend.onAuthChange((u) => {
      setMe(u);
      if (!u) {
        setConversations([]);
        setOpenId(null);
        setTab('market');
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      setConversations(await backend.listConversations());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀不到對話列表');
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    return backend.subscribeToInbox(() => void refresh());
  }, [me, refresh]);

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);
  const open = conversations.find((c) => c.id === openId) ?? null;

  function openConversation(id: string) {
    void refresh();
    setTab('messages');
    setOpenId(id);
  }

  return (
    <div className="page">
      <div className="intro">
        <span className="eyebrow">
          <IconMessages size={13} /> MotoVerify 訊息模組
        </span>
        <h1>從車輛刊登長出來的對話</h1>
        <p>
          對話只有兩種開法:在市場點「聯絡賣家」,或輸入對方的使用者代碼。沒有全站名單可以瀏覽,
          就跟實際上線後一樣。
        </p>
      </div>

      <PhoneShell>
        {booting ? (
          <div className="empty-hint" style={{ margin: 'auto' }}>
            載入中…
          </div>
        ) : !me ? (
          <AuthScreen />
        ) : open ? (
          <ChatScreen me={me} conversation={open} onBack={() => setOpenId(null)} onChanged={refresh} />
        ) : (
          <>
            {tab === 'market' ? (
              <MarketScreen onOpenConversation={openConversation} />
            ) : (
              <InboxScreen
                me={me}
                conversations={conversations}
                loading={loading}
                error={error}
                onOpen={setOpenId}
                onRefresh={refresh}
              />
            )}
            <div className="tabbar">
              <button
                className={`tab-btn ${tab === 'market' ? 'active' : ''}`}
                onClick={() => setTab('market')}
              >
                <IconMarket />
                <span className="lbl">市場</span>
              </button>
              <button
                className={`tab-btn ${tab === 'messages' ? 'active' : ''}`}
                onClick={() => setTab('messages')}
              >
                <IconMessages />
                {totalUnread > 0 && <span className="tab-badge">{totalUnread}</span>}
                <span className="lbl">訊息</span>
              </button>
            </div>
          </>
        )}
      </PhoneShell>
    </div>
  );
}
