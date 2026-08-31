import type { ReactNode } from 'react';
import { backend } from '../lib/backend';

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="phone">
      <div className="app-shell phone-screen">
        <div className="statusbar">
          <span>9:41</span>
          <span className="icons">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
              <rect x="0" y="7" width="3" height="4" rx="1" />
              <rect x="4.5" y="5" width="3" height="6" rx="1" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
              <rect x="13.5" y="0" width="3" height="11" rx="1" />
            </svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor">
              <rect x="0.5" y="0.5" width="17" height="10" rx="3" opacity="0.4" />
              <rect x="2" y="2" width="12" height="7" rx="1.5" fill="currentColor" stroke="none" />
              <path d="M19.5 4v3" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </svg>
          </span>
        </div>
        {backend.isDemo && (
          <div className="demo-strip">展示模式 — 資料存在瀏覽器記憶體,重整就會重置</div>
        )}
        {children}
      </div>
    </div>
  );
}
