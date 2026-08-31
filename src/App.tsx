import { useCallback, useEffect, useState } from 'react';
import { backend } from './lib/backend';
import type { Conversation, Me } from './lib/types';
import { PhoneShell } from './components/PhoneShell';
import { AuthScreen } from './components/AuthScreen';
import { InboxScreen } from './components/InboxScreen';
import { ChatScreen } from './components/ChatScreen';
import { IconMessages } from './lib/icons';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 登入狀態
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

  // 任何新訊息都重新算列表和未讀數
  useEffect(() => {
    if (!me) return;
    return backend.subscribeToInbox(() => void refresh());
  }, [me, refresh]);

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);
  const open = conversations.find((c) => c.id === openId) ?? null;

  return (
    <div className="page">
      <div className="intro">
        <span className="eyebrow">
          <IconMessages size={13} /> MotoVerify 訊息模組
        </span>
        <h1>從原型抽出來的獨立訊息功能</h1>
        <p>
          登入、對話列表、即時訊息、未讀數都接真的後端。想測雙人對話,開一個無痕視窗註冊第二個帳號,
          兩邊並排就看得到訊息即時互推。
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
            <InboxScreen
              conversations={conversations}
              loading={loading}
              error={error}
              onOpen={setOpenId}
              onRefresh={refresh}
            />
            <div className="tabbar">
              <button className="tab-btn active">
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
