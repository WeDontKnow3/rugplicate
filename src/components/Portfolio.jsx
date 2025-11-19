import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function Portfolio({ onActionComplete }) {
  const { t } = useTranslation();

  const [me, setMe] = useState(null);
  const [txs, setTxs] = useState([]);
  const [sellAmounts, setSellAmounts] = useState({});
  const [msg, setMsg] = useState('');
  const [loadingSell, setLoadingSell] = useState(null);

  async function load() {
    setMsg('');
    try {
      const r = await api.getMe();
      if (r && r.user) setMe(r.user);
    } catch (e) {
      setMsg(t('portfolio.loadError'));
    }

    try {
      const tr = await api.getTransactions();
      setTxs(tr.transactions || []);
    } catch (_) {
      setTxs([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function sell(symbol) {
    setMsg('');
    const amt = Number(sellAmounts[symbol] || 0);
    if (!amt || amt <= 0) { setMsg(t('portfolio.invalidAmount')); return; }
    setLoadingSell(symbol);

    try {
      const res = await api.sellCoin(symbol, amt);
      if (res.ok) {
        setMsg(t('portfolio.sold', { amount: Number(res.sold.tokenAmount).toFixed(6), symbol }));
        await load();

        if (onActionComplete)
          onActionComplete({ keepView: true, animate: { amount: Number(res.sold.usdGained || 0), type: 'up' } });

        setSellAmounts(s => ({ ...s, [symbol]: '' }));
      } else {
        setMsg(res.error || t('portfolio.sellError'));
      }
    } catch (err) {
      setMsg(err.message || t('portfolio.error'));
    } finally {
      setLoadingSell(null);
    }
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>{t('portfolio.title')}</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>{me ? me.username : ''}</div>
      </div>

      {msg && <p className="msg">{msg}</p>}

      <div className="card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="small muted">{t('portfolio.usdBalance')}</div>
            <div style={{fontWeight:800, fontSize:20}}>{me ? `$${Number(me.usd_balance).toFixed(2)}` : '—'}</div>
          </div>

          <div style={{textAlign:'right'}}>
            <div className="small muted">{t('portfolio.tokens')}</div>
            <div style={{fontWeight:700}}>{me ? me.tokens.length : 0}</div>
          </div>
        </div>
      </div>

      <div style={{marginTop:8}}>
        <h3>{t('portfolio.holdings')}</h3>

        {me && me.tokens.length === 0 && (
          <div className="card muted">{t('portfolio.noTokens')}</div>
        )}

        {me && me.tokens.map(tk => (
          <div key={tk.symbol} className="card" style={{display:'flex', alignItems:'center', gap:12, justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:800}}>{tk.symbol}</div>
              <div className="muted">{tk.name}</div>
              <div className="muted">{t('portfolio.amount', { value: Number(tk.amount).toLocaleString() })}</div>
            </div>

            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <input
                className="small-input"
                placeholder={t('portfolio.amountPlaceholder')}
                value={sellAmounts[tk.symbol] || ''}
                onChange={e=>setSellAmounts({...sellAmounts, [tk.symbol]: e.target.value})}
              />
              <button
                className="btn"
                onClick={()=>sell(tk.symbol)}
                disabled={loadingSell && loadingSell !== tk.symbol}
              >
                {loadingSell === tk.symbol ? t('portfolio.selling') : t('portfolio.sell')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:14}}>
        <h3>{t('portfolio.transactions')}</h3>

        {txs.length === 0 && (
          <div className="card muted">{t('portfolio.noTransactions')}</div>
        )}

        {txs.map(tx => (
          <div key={tx.id} className="card" style={{marginBottom:8}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontWeight:800}}>{tx.type.toUpperCase()}</div>
                <div className="muted">{tx.symbol} • {new Date(tx.created_at).toLocaleString()}</div>
              </div>

              <div style={{textAlign:'right'}}>
                <div>{tx.usd_amount ? `$${Number(tx.usd_amount).toFixed(4)}` : ''}</div>
                <div className="muted">
                  {tx.token_amount ? t('portfolio.tokenAmount', { value: Number(tx.token_amount).toLocaleString() }) : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
