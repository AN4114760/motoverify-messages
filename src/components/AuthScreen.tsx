import { useState } from 'react';
import { backend } from '../lib/backend';
import { IconBike } from '../lib/icons';

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'in') {
        await backend.signIn(email.trim(), password);
      } else {
        const { needsConfirm } = await backend.signUp(email.trim(), password, name.trim() || '騎士');
        if (needsConfirm) {
          setNotice('註冊成功。收信點開確認連結後就能登入。');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '出了點問題,再試一次');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div className="mark">
          <IconBike />
        </div>
        <div className="name">
          Moto<b>Verify</b>
        </div>
        <div className="sub">訊息模組 · 獨立測試版</div>
      </div>

      <div className="auth-tabs">
        <button className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>
          登入
        </button>
        <button className={mode === 'up' ? 'active' : ''} onClick={() => setMode('up')}>
          註冊
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {notice && (
        <div className="form-error" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
          {notice}
        </div>
      )}

      {mode === 'up' && (
        <div className="form-field">
          <label htmlFor="name">暱稱</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="對方會看到的名字" />
        </div>
      )}

      <div className="form-field">
        <label htmlFor="email">信箱</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="form-field">
        <label htmlFor="password">密碼</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
          placeholder="至少 6 個字元"
        />
      </div>

      <button className="cta-blue" disabled={!canSubmit} onClick={submit}>
        {busy ? '處理中…' : mode === 'in' ? '登入' : '建立帳號'}
      </button>

      <p className="form-note">
        {backend.isDemo
          ? '展示模式:還沒接上 Supabase,隨便填一組信箱密碼就能進去看畫面。'
          : '要測雙人對話,開一個無痕視窗註冊第二個帳號,兩邊同時開著就能看到訊息即時互推。'}
      </p>
    </div>
  );
}
