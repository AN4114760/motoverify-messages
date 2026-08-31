import { useEffect, useState } from 'react';
import { backend, initials, shortTime } from '../lib/backend';
import type { Conversation, Peer } from '../lib/types';
import { IconAdd, IconLogout } from '../lib/icons';

const FILTERS = ['全部', '未讀', '交易中', '一般'] as const;
type Filter = (typeof FILTERS)[number];

interface Props {
  conversations: Conversation[];
  loading: boolean;
  error: string;
  onOpen: (id: string) => void;
  onRefresh: () => void;
}

export function InboxScreen({ conversations, loading, error, onOpen, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>('全部');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [peerError, setPeerError] = useState('');

  useEffect(() => {
    if (!sheetOpen) return;
    let alive = true;
    backend
      .listPeers()
      .then((p) => alive && setPeers(p))
      .catch((e) => alive && setPeerError(e instanceof Error ? e.message : '讀取失敗'));
    return () => {
      alive = false;
    };
  }, [sheetOpen]);

  const visible = conversations.filter((c) => {
    if (filter === '未讀') return c.unread > 0;
    if (filter === '交易中') return c.tag === '交易中';
    if (filter === '一般') return c.tag === '一般';
    return true;
  });

  async function openWith(peerId: string) {
    try {
      const id = await backend.startConversation(peerId, '一般');
      setSheetOpen(false);
      onRefresh();
      onOpen(id);
    } catch (e) {
      setPeerError(e instanceof Error ? e.message : '無法開啟對話');
    }
  }

  return (
    <>
      <div className="app-header">
        <div className="row">
          <h2>訊息中心</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-btn" onClick={() => setSheetOpen(true)} aria-label="開新對話">
              <IconAdd />
            </button>
            <button className="icon-btn ghost" onClick={() => backend.signOut()} aria-label="登出">
              <IconLogout />
            </button>
          </div>
        </div>
        <div className="chip-row">
          {FILTERS.map((f) => (
            <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <div className="form-error">{error}</div>}

          {loading && !conversations.length && <div className="empty-hint">讀取中…</div>}

          {!loading && !visible.length && (
            <div className="empty-hint">
              {filter === '全部' ? (
                <>
                  還沒有任何對話。
                  <br />
                  點右上角的 + 找人開始聊。
                </>
              ) : (
                `沒有符合「${filter}」的訊息`
              )}
            </div>
          )}

          {visible.map((c) => (
            <button key={c.id} className="convo-row" onClick={() => onOpen(c.id)}>
              <div className="avatar">{initials(c.peerName)}</div>
              <div className="convo-body">
                <div className="convo-top">
                  <span className="convo-name">{c.peerName}</span>
                  <span className="convo-tag">{c.tag}</span>
                </div>
                <div className="convo-msg">{c.lastMessage}</div>
              </div>
              <div className="convo-right">
                <span className="convo-time">{shortTime(c.updatedAt)}</span>
                {c.unread > 0 && <span className="unread-dot">{c.unread}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {sheetOpen && (
        <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>開新對話</h3>
            <p className="hint">列出的是目前註冊過、你還沒聊過的帳號。</p>
            {peerError && <div className="form-error">{peerError}</div>}
            {!peers.length && !peerError && (
              <div className="empty-hint">
                沒有其他帳號可選。
                <br />
                開一個無痕視窗再註冊一個帳號試試。
              </div>
            )}
            {peers.map((p) => (
              <button key={p.id} className="convo-row" onClick={() => openWith(p.id)}>
                <div className="avatar">{initials(p.name)}</div>
                <div className="convo-body">
                  <span className="convo-name">{p.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
