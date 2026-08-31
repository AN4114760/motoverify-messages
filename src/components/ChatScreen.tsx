import { useEffect, useRef, useState } from 'react';
import { backend, shortTime } from '../lib/backend';
import type { Conversation, Me, Message } from '../lib/types';
import { IconBack, IconSend } from '../lib/icons';

interface Props {
  me: Me;
  conversation: Conversation;
  onBack: () => void;
  onChanged: () => void;
}

export function ChatScreen({ me, conversation, onBack, onChanged }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // 載入歷史訊息 + 訂閱即時推播
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    backend
      .listMessages(conversation.id)
      .then((rows) => {
        if (!alive) return;
        setMessages(rows);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '讀不到訊息');
        setLoading(false);
      });

    const unsub = backend.subscribeToConversation(conversation.id, (incoming) => {
      setMessages((prev) => {
        // 自己送出的訊息會同時走 insert 回傳與 realtime,擋掉重複
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      void backend.markRead(conversation.id).then(onChanged);
    });

    void backend.markRead(conversation.id).then(onChanged);

    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // 有新訊息就捲到底
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId: conversation.id,
      senderId: me.id,
      content: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const saved = await backend.sendMessage(conversation.id, text);
      // 用伺服器回來的那筆取代暫時的,拿到真的 id 和 server timestamp
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      onChanged();
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
      );
      setError(e instanceof Error ? e.message : '訊息沒送出去');
    }
  }

  return (
    <>
      <div className="app-header">
        <div className="row">
          <div className="back-row">
            <button className="icon-btn ghost" onClick={onBack} aria-label="返回">
              <IconBack />
            </button>
            <span className="title">{conversation.peerName}</span>
          </div>
          <span className="convo-tag">{conversation.tag}</span>
        </div>
      </div>

      <div className="chat-wrap">
        <div className="chat-log" ref={logRef}>
          {loading && <div className="empty-hint">讀取中…</div>}
          {!loading && !messages.length && (
            <div className="empty-hint">還沒有訊息,說句話開場吧。</div>
          )}
          {messages.map((m) => {
            const mine = m.senderId === me.id;
            return (
              <div key={m.id} className={`bubble-line ${mine ? 'me' : 'them'}`}>
                <div
                  className={`bubble ${mine ? 'me' : 'them'} ${m.pending ? 'pending' : ''} ${
                    m.failed ? 'failed' : ''
                  }`}
                >
                  {m.content}
                </div>
                <span className="bubble-time">
                  {m.failed ? '沒送出去' : m.pending ? '傳送中' : shortTime(m.createdAt)}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="form-error" style={{ margin: '0 14px 8px' }}>
            {error}
          </div>
        )}

        <div className="chat-input-bar">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="輸入訊息..."
            aria-label="訊息內容"
          />
          <button className="send-btn" onClick={send} disabled={!draft.trim()} aria-label="送出">
            <IconSend />
          </button>
        </div>
      </div>
    </>
  );
}
