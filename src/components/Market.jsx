import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Market({ onOpenCoin, onActionComplete }) {
  const { t } = useTranslation();

  const [coins, setCoins] = useState([]);
  const [usdBuy, setUsdBuy] = useState({});
  const [msg, setMsg] = useState('');
  const [loadingSymbol, setLoadingSymbol] = useState(null);
  const [loadingList, setLoadingList] = useState(false);

  async function load() {
    setMsg('');
    setLoadingList(true);
    try {
      const r = await api.listCoins();
      setCoins(r.coins || []);
    } catch (e) {
      setMsg(t('genericErrorNetwork'));
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { load(); }, []);

  function fmtPercent(p) {
    if (p == null) return '—';
    const sign = p > 0 ? '+' : '';
    return `${sign}${p.toFixed(2)}%`;
  }

  function fmtVol(v) {
    if (!v) return '$0';
    return `$${Number(v).toFixed(2)}`;
  }

  function getLogoUrl(c) {
    if (!c || !c.logo) return null;
    if (c.logo.startsWith('http') || c.logo.startsWith('//')) return c.logo;
    if (API_BASE) return API_BASE.replace(/\/$/, '') + c.logo;
    return c.logo;
  }

  async function buy(symbol) {
    setMsg('');
    const usd = Number(usdBuy[symbol] || 0);

    if (!usd || usd <= 0) {
      setMsg(t('invalidValue'));
      return;
    }

    setLoadingSymbol(symbol);

    try {
      const res = await api.buyCoin(symbol, usd);
      if (res.ok) {
        setMsg(t('boughtMsgMarket', { amount: Number(res.bought.tokenAmount).toFixed(6), symbol }));
        await load();

        if (onActionComplete) {
          onActionComplete({
            keepView: true,
            animate: { amount: Number(usd), type: 'down' }
          });
        }
      } else {
        setMsg(t('buyErrorMarket'));
      }
    } catch (err) {
      setMsg(t('genericErrorNetwork'));
    } finally {
      setLoadingSymbol(null);
    }
  }

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>{t('marketTitle')}</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>
          {loadingList ? t('loadingMarket') : t('coinsCount', { count: coins.length })}
        </div>
      </div>

      {msg && <p className="msg">{msg}</p>}

      <div className="market-list">
        {coins.length === 0 && !loadingList && (
          <div className="card muted">{t('marketNoCoins')}</div>
        )}

        {coins.map(c => {
          const logoUrl = getLogoUrl(c);

          return (
            <div key={c.symbol} className="market-item fade-in">
              <div className="market-left" style={{display:'flex', alignItems:'center', gap:12}}>
                {logoUrl ? (
                  <img src={logoUrl} alt={c.symbol} style={{width:48,height:48,objectFit:'cover',borderRadius:8}} />
                ) : (
                  <div style={{width:48,height:48,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,background:'linear-gradient(135deg,var(--accent),var(--accent-2))',fontWeight:800}}>
                    {c.symbol.slice(0,3)}
                  </div>
                )}

                <div style={{display:'flex',flexDirection:'column'}}>
                  <button className="link-btn" onClick={() => onOpenCoin(c.symbol)}>
                    {c.symbol}
                  </button>
                  <div className="name">{c.name}</div>

                  <div className="muted" style={{marginTop:6}}>
                    {t('poolLabel', {
                      base: Number(c.liquidity_base || 0).toFixed(4),
                      token: Number(c.liquidity_token || 0).toLocaleString()
                    })}
                  </div>
                </div>
              </div>

              <div className="market-mid">
                <div className="small muted">{t('priceLabel')}</div>
                <div style={{fontWeight:800}}>
                  {c.price === null ? '—' : `$${Number(c.price).toFixed(8)}`}
                </div>

                <div style={{marginTop:6}}>
                  <span
                    className={
                      c.change24h > 0
                        ? 'flash-up'
                        : c.change24h < 0
                        ? 'flash-down'
                        : ''
                    }
                    style={{fontWeight:700}}
                  >
                    {fmtPercent(c.change24h)}
                  </span>

                  <div className="small muted">
                    {t('vol24Label')} {fmtVol(c.volume24h)}
                  </div>
                </div>
              </div>

              <div className="market-right">
                <input
                  className="small-input"
                  value={usdBuy[c.symbol] || ''}
                  onChange={e => setUsdBuy({...usdBuy, [c.symbol]: e.target.value})}
                  placeholder={t('buyInputPlaceholder')}
                  inputMode="decimal"
                />

                <button
                  className="btn"
                  onClick={() => buy(c.symbol)}
                  disabled={loadingSymbol && loadingSymbol !== c.symbol}
                >
                  {loadingSymbol === c.symbol
                    ? t('buying')
                    : t('buyBtnText')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
