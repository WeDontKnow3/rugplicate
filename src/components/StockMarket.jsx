import React, { useEffect, useState } from 'react';
import * as api from '../api';

const STOCKS_PER_PAGE = 10;

export default function StockMarket({ onOpenStock, onActionComplete }) {
  const [stocks, setStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
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
      const r = await api.listStocks();
      setStocks(r.coins || []);
    } catch (e) {
      setMsg('Network error');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let result = [...stocks];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.symbol.toLowerCase().includes(query) || 
        s.name.toLowerCase().includes(query)
      );
    }

    if (sortBy === 'price') {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'change') {
      result.sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
    } else if (sortBy === 'volume') {
      result.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    }

    setFilteredStocks(result);
    setCurrentPage(1);
  }, [stocks, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredStocks.length / STOCKS_PER_PAGE);
  const startIndex = (currentPage - 1) * STOCKS_PER_PAGE;
  const endIndex = startIndex + STOCKS_PER_PAGE;
  const currentStocks = filteredStocks.slice(startIndex, endIndex);

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
    if (!v) return 'R$0';
    if (v >= 1000000) return `R$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}K`;
    return `R$${Number(v).toFixed(2)}`;
  }

  async function buy(symbol) {
    setMsg('');
    const usd = Number(usdBuy[symbol] || 0);

    if (!usd || usd <= 0) {
      setMsg('Invalid amount');
      return;
    }

    setLoadingSymbol(symbol);

    try {
      const res = await api.buyCoin(symbol, usd);
      if (res.ok) {
        setMsg(`Bought ${Number(res.bought.tokenAmount)} shares of ${symbol}`);
        await load();

        if (onActionComplete) {
          onActionComplete({
            keepView: true,
            animate: { amount: Number(usd), type: 'down' }
          });
        }
      } else {
        setMsg('Purchase failed');
      }
    } catch (err) {
      setMsg('Network error');
    } finally {
      setLoadingSymbol(null);
    }
  }

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>Brazilian Stocks</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>
          {loadingList ? 'Loading...' : `${filteredStocks.length} stocks`}
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
          placeholder="Search stocks..."
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
            <option value="volume">Volume</option>
            <option value="price">Price</option>
            <option value="change">Change</option>
          </select>
        </div>
      </div>

      {msg && <p className="msg">{msg}</p>}

      <div className="market-list">
        {currentStocks.length === 0 && !loadingList && (
          <div className="card muted">
            {searchQuery ? 'No stocks found matching your search' : 'No stocks available'}
          </div>
        )}

        {currentStocks.map(s => (
          <div key={s.symbol} className="market-item fade-in">
            <div className="market-left" style={{display:'flex', alignItems:'center', gap:12}}>
              {s.logo ? (
                <img src={s.logo} alt={s.symbol} style={{width:48,height:48,objectFit:'cover',borderRadius:8}} />
              ) : (
                <div style={{width:48,height:48,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,background:'linear-gradient(135deg,#16a34a,#15803d)',fontWeight:800,color:'#fff'}}>
                  {s.symbol.slice(0,3)}
                </div>
              )}

              <div style={{display:'flex',flexDirection:'column'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button className="link-btn" onClick={() => onOpenStock(s.symbol)} style={{ color: '#fff' }}>
                    {s.symbol}
                  </button>
                  <span style={{
                    fontSize:10,
                    fontWeight:700,
                    padding:'2px 6px',
                    borderRadius:4,
                    background:'rgba(16,185,129,0.1)',
                    color:'#10b981',
                    border:'1px solid rgba(16,185,129,0.2)'
                  }}>STOCK</span>
                </div>
                <div className="name">{s.name}</div>
                {s.dividends && s.dividends.length > 0 && (
                  <div style={{fontSize:11,color:'#10b981',marginTop:4}}>
                    💰 Next dividend: R${s.dividends[0].rate.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div className="market-mid">
              <div className="small muted">Price</div>
              <div style={{fontWeight:800}}>
                R${Number(s.price).toFixed(2)}
              </div>

              <div style={{marginTop:6}}>
                <span
                  className={
                    s.change24h > 0
                      ? 'flash-up'
                      : s.change24h < 0
                      ? 'flash-down'
                      : ''
                  }
                  style={{fontWeight:700}}
                >
                  {fmtPercent(s.change24h)}
                </span>

                <div className="small muted">
                  Vol: {fmtVol(s.volume24h)}
                </div>
              </div>
            </div>

            <div className="market-right">
              <input
                className="small-input"
                value={usdBuy[s.symbol] || ''}
                onChange={e => setUsdBuy({...usdBuy, [s.symbol]: e.target.value})}
                placeholder="R$"
                inputMode="decimal"
              />

              <button
                className="btn"
                onClick={() => buy(s.symbol)}
                disabled={loadingSymbol && loadingSymbol !== s.symbol}
              >
                {loadingSymbol === s.symbol ? 'Buying...' : 'Buy'}
              </button>
            </div>
          </div>
        ))}
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
          Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, filteredStocks.length)} of {filteredStocks.length} stocks
        </div>
      )}
    </div>
  );
}