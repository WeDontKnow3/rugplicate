import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const COINS_PER_PAGE = 10;

export default function Market({ onOpenCoin, onActionComplete }) {
  const { t } = useTranslation();

  const [coins, setCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);
  const [usdBuy, setUsdBuy] = useState({});
  const [msg, setMsg] = useState('');
  const [loadingSymbol, setLoadingSymbol] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('volume');
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    let result = [...coins];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.symbol.toLowerCase().includes(query) || 
        c.name.toLowerCase().includes(query)
      );
    }

    if (sortBy === 'price') {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'change') {
      result.sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
    } else if (sortBy === 'volume') {
      result.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    }

    setFilteredCoins(result);
    setCurrentPage(1);
  }, [coins, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredCoins.length / COINS_PER_PAGE);
  const startIndex = (currentPage - 1) * COINS_PER_PAGE;
  const endIndex = startIndex + COINS_PER_PAGE;
  const currentCoins = filteredCoins.slice(startIndex, endIndex);

  function getPageNumbers() {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  }

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
          {loadingList ? t('loadingMarket') : t('coinsCount', { count: filteredCoins.length })}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Search coins..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 200px',
            padding: '10px 14px',
            fontSize: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#fff'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>Sort by:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '10px 14px',
              fontSize: 14,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="volume">24h Volume</option>
            <option value="price">Price</option>
            <option value="change">24h Change</option>
          </select>
        </div>
      </div>

      {msg && <p className="msg">{msg}</p>}

      <div className="market-list">
        {currentCoins.length === 0 && !loadingList && (
          <div className="card muted">
            {searchQuery ? 'No coins found matching your search' : t('marketNoCoins')}
          </div>
        )}

        {currentCoins.map(c => {
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

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginTop: 24,
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: currentPage === 1 ? '#64748b' : '#fff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Previous
          </button>

          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} style={{ color: '#64748b', padding: '0 4px' }}>
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  padding: '8px 12px',
                  minWidth: 40,
                  background: currentPage === page ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: currentPage === page ? 700 : 600
                }}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: currentPage === totalPages ? '#64748b' : '#fff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Next
          </button>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{
          textAlign: 'center',
          marginTop: 12,
          fontSize: 13,
          color: '#64748b'
        }}>
          Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, filteredCoins.length)} of {filteredCoins.length} coins
        </div>
      )}
    </div>
  );
}
