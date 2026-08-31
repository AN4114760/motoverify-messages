import { useState } from 'react';
import { backend, initials, shortTime } from '../lib/backend';
import type { Conversation, Me } from '../lib/types';
import { IconAdd, IconLogout } from '../lib/icons';

const FILTERS = ['全部', '未讀', '買家詢問', '一般'] as const;
type Filter = (typeof FILTERS)[number];

interface Props {
  me: Me;
  conversations: Conversation[];
  loading: boolean;
  error: string;
  onOpen: (id: string) => void;
  onRefresh: () => void;
}

export function InboxScreen({ me, conversations, loading, error, onOpen, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>('全部');
  const [sheetOpen, setSheetOpen] = useState(false);

  const visible = conversations.filter((c) => {
    if (filter === '未讀') return c.unread > 0;
    if (filter === '買家詢問') return c.tag === '買家詢問';
    if (filter === '一般') return c.tag === '一般';
    return true;
  });

  return (
    <>
      <div className="app-header">
        <div className="row">
          <h2>訊息中心</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-btn" onClick={() => setSheetOpen(true)} aria-label="用代碼聯絡">
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
                  到「市場」找一台車聯絡賣家,或用右上角的 + 輸入對方代碼。
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
                {c.listingTitle && <div className="convo-listing">關於 {c.listingTitle}</div>}
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
        <HandleSheet
          me={me}
          onClose={() => setSheetOpen(false)}
          onOpened={(id) => {
            setSheetOpen(false);
            onRefresh();
            onOpen(id);
          }}
        />
      )}
    </>
  );
}

function HandleSheet({
  me,
  onClose,
  onOpened,
}: {
  me: Me;
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function go() {
    setBusy(true);
    setError('');
    try {
      onOpened(await backend.startByHandle(handle));
    } catch (e) {
      setError(e instanceof Error ? e.message : '開不了對話');
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(me.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('複製失敗,手動抄一下吧');
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>用代碼聯絡</h3>
        <p className="hint">輸入對方的使用者代碼或註冊信箱。找不到人就不會建立對話。</p>
        {error && <div className="form-error">{error}</div>}

        <div className="form-field">
          <label htmlFor="handle">對方的代碼或信箱</label>
          <input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handle.trim() && !busy && go()}
            placeholder="K7M2QX 或 rider@example.com"
            autoCapitalize="characters"
          />
        </div>

        <button className="cta-blue" disabled={!handle.trim() || busy} onClick={go}>
          {busy ? '開啟中…' : '開始對話'}
        </button>

        <div className="my-code">
          <span className="my-code-label">你的代碼</span>
          <button className="my-code-value num" onClick={copy}>
            {me.userCode}
            <span className="my-code-hint">{copied ? '已複製' : '點一下複製'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
