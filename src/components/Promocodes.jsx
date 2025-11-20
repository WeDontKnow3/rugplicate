import React, { useEffect, useState } from 'react';
import * as api from '../api';

export default function Promocodes({ onActionComplete }) {
  const [promos, setPromos] = useState([]);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadPromos() {
    const res = await api.listAvailablePromoCodes();
    if (res && res.promos) setPromos(res.promos);
  }

  useEffect(() => {
    loadPromos();
  }, []);

  async function handleRedeem(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMsg('');
    const res = await api.redeemPromoCode(code.trim());
    if (res && res.ok) {
      setMsg(`Successfully redeemed $${res.credited}!`);
      setCode('');
      await loadPromos();
      if (onActionComplete) {
        onActionComplete({ 
          animate: { amount: res.credited, type: 'up' },
          keepView: true 
        });
      }
    } else {
      setMsg(res && res.error ? res.error : 'Failed to redeem code');
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Promocodes</h2>
        <p className="muted">Redeem promotional codes to get free USD balance</p>

        <form onSubmit={handleRedeem} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Enter promo code"
              style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
              disabled={loading}
            />
            <button type="submit" className="btn" disabled={loading || !code.trim()}>
              Redeem
            </button>
          </div>
        </form>

        {msg && (
          <div 
            className="msg" 
            style={{ 
              marginTop: 12, 
              color: msg.includes('Successfully') ? '#86efac' : '#fda4af' 
            }}
          >
            {msg}
          </div>
        )}

        {promos.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3>Available Promocodes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {promos.map(p => (
                <div 
                  key={p.id} 
                  style={{ 
                    padding: '12px 16px', 
                    background: 'rgba(255,255,255,0.02)', 
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{p.code}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        Reward: ${p.amount}
                        {p.max_uses > 0 && ` • ${p.used_count}/${p.max_uses} used`}
                        {p.per_user_limit > 0 && ` • ${p.per_user_limit} per user`}
                        {p.expires_at && ` • Expires: ${new Date(p.expires_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button 
                      className="btn" 
                      onClick={() => { setCode(p.code); }}
                    >
                      Use Code
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {promos.length === 0 && !loading && (
          <div className="muted" style={{ marginTop: 24, textAlign: 'center' }}>
            No public promocodes available. Enter a code above to redeem.
          </div>
        )}
      </div>
    </div>
  );
}
