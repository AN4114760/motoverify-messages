import { useEffect, useState } from 'react';
import { backend } from '../lib/backend';
import type { Listing } from '../lib/types';
import { IconAdd, IconBike } from '../lib/icons';

interface Props {
  onOpenConversation: (id: string) => void;
}

export function MarketScreen({ onOpenConversation }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setListings(await backend.listListings());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀不到刊登');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function contact(l: Listing) {
    setBusyId(l.id);
    setError('');
    try {
      onOpenConversation(await backend.startFromListing(l.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法聯絡賣家');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="app-header">
        <div className="row">
          <h2>車輛市場</h2>
          <button className="icon-btn" onClick={() => setPosting(true)} aria-label="刊登車輛">
            <IconAdd />
          </button>
        </div>
      </div>

      <div className="scroll">
        {error && <div className="form-error">{error}</div>}
        {loading && <div className="empty-hint">讀取中…</div>}

        {!loading && !listings.length && (
          <div className="empty-hint">
            市場上還沒有車。
            <br />
            點右上角的 + 刊登一台,組員就能從你的刊登聯絡你。
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {listings.map((l) => (
            <article key={l.id} className="listing-card">
              <div className="listing-thumb" style={{ background: l.accent }}>
                <IconBike />
              </div>
              <div className="listing-body">
                <h3 className="listing-title">{l.title}</h3>
                <div className="listing-price num">NT$ {l.price.toLocaleString('en-US')}</div>
                <div className="listing-meta">
                  {[l.year, l.mileage ? `${l.mileage.toLocaleString('en-US')} km` : null, l.location]
                    .filter(Boolean)
                    .join('・')}
                </div>
                <div className="listing-foot">
                  <span className="listing-seller">賣家 {l.sellerName}</span>
                  {l.isMine ? (
                    <button className="cta-slim ghost" onClick={() => void backend.deleteListing(l.id).then(load)}>
                      下架
                    </button>
                  ) : (
                    <button className="cta-slim solid" disabled={busyId === l.id} onClick={() => contact(l)}>
                      {busyId === l.id ? '開啟中…' : '聯絡賣家'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {posting && (
        <PostSheet
          onClose={() => setPosting(false)}
          onDone={() => {
            setPosting(false);
            void load();
          }}
        />
      )}
    </>
  );
}

function PostSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [location, setLocation] = useState('台北市');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ok = title.trim().length > 0 && Number(price) > 0 && !busy;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await backend.createListing({
        title: title.trim(),
        price: Number(price),
        year: year ? Number(year) : null,
        mileage: mileage ? Number(mileage) : null,
        location: location.trim() || '台北市',
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '刊登失敗');
      setBusy(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>刊登車輛</h3>
        <p className="hint">刊登後,其他人可以從你的車輛聯絡你。</p>
        {error && <div className="form-error">{error}</div>}

        <div className="form-field">
          <label htmlFor="t">車款</label>
          <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2020 山葉 勁戰六代" />
        </div>
        <div className="field-pair">
          <div className="form-field">
            <label htmlFor="p">售價</label>
            <input id="p" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="78000" />
          </div>
          <div className="form-field">
            <label htmlFor="y">年份</label>
            <input id="y" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} placeholder="2020" />
          </div>
        </div>
        <div className="field-pair">
          <div className="form-field">
            <label htmlFor="km">里程 (km)</label>
            <input id="km" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ''))} placeholder="12400" />
          </div>
          <div className="form-field">
            <label htmlFor="loc">地區</label>
            <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <button className="cta-blue" disabled={!ok} onClick={submit}>
          {busy ? '刊登中…' : '刊登'}
        </button>
      </div>
    </div>
  );
}
