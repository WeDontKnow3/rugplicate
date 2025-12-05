import React, { useEffect, useState, useRef } from 'react';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export default function Sidebar({ view, onNavigate, onLogout, open, setOpen }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balanceAnim, setBalanceAnim] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dailyStatus, setDailyStatus] = useState(null);
  const prevBalanceRef = useRef(null);
  const pollRef = useRef(null);

  const [trades, setTrades] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timeout: null });

  function navigate(to) {
    if (onNavigate && typeof onNavigate === 'function') onNavigate(to);
    else window.location.hash = '#' + to;
    if (window.innerWidth < 900 && typeof setOpen === 'function') setOpen(false);
  }

  async function fetchMe() {
    setLoading(true);
    try {
      const token = getCookie('token');
      if (!token) {
        setMe(null);
        setLoading(false);
        return;
      }
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE || 'https://devsite-backend-production.up.railway.app'}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (data && data.user) {
        const nowBal = Number(data.user.usd_balance || 0);
        const prev = prevBalanceRef.current;
        if (prev != null && nowBal !== prev) {
          setBalanceAnim(nowBal > prev ? 'up' : 'down');
          setTimeout(() => setBalanceAnim(null), 1200);
        }
        prevBalanceRef.current = nowBal;
        setMe(data.user);
      } else {
        setMe(null);
      }
    } catch (err) {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnreadCount() {
    try {
      const token = getCookie('token');
      if (!token) return;
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE || 'https://devsite-backend-production.up.railway.app'}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      
      const data = await res.json();
      if (data && typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error('fetch unread count err', err);
    }
  }

  async function fetchDailyStatus() {
    try {
      const token = getCookie('token');
      if (!token) return;
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE || 'https://devsite-backend-production.up.railway.app'}/api/daily/status`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      
      const data = await res.json();
      if (data) {
        setDailyStatus(data);
      }
    } catch (err) {
      console.error('fetch daily status err', err);
    }
  }

  useEffect(() => {
    fetchMe();
    fetchUnreadCount();
    fetchDailyStatus();
    function handleVisibility() {
      if (pollRef.current) clearInterval(pollRef.current);
      if (!document.hidden) {
        pollRef.current = setInterval(() => {
          fetchMe();
          fetchUnreadCount();
          fetchDailyStatus();
        }, 5000);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopWebsocket();
    };
  }, []);

  const WS_URL = import.meta.env.VITE_WS_URL || "wss://devsite-backend-production.up.railway.app";
  const MAX_TRADES = 5;

  function pushTrade(t) {
    setTrades(prev => {
      const next = [t, ...prev].slice(0, MAX_TRADES);
      return next;
    });
  }

  function startWebsocket() {
    if (!WS_URL) return;
    try {
      stopWebsocket();
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      
      ws.addEventListener('open', () => {
        setWsStatus('connected');
        reconnectRef.current.attempts = 0;
      });
      
      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data && (data.type === 'trade' || data.event === 'trade')) {
            const usdAmt = Number(data.usdAmount || data.usd_amount || data.usd || 0);
            
            if (usdAmt >= 1000) {
              const t = {
                coin: data.coin || data.symbol || data.token || 'UNKNOWN',
                side: (data.side === 'sell' || data.type === 'sell') ? 'sell' : 'buy',
                tokenAmount: Number(data.tokenAmount || data.token_amount || data.amount || 0),
                usdAmount: usdAmt,
                price: Number(data.price || 0),
                created_at: data.created_at || data.ts || new Date().toISOString()
              };
              pushTrade(t);
            }
          }
        } catch (e) {
          console.warn('ws parse error', e);
        }
      });
      
      ws.addEventListener('close', () => {
        setWsStatus('disconnected');
        scheduleReconnect();
      });
      
      ws.addEventListener('error', () => {
        setWsStatus('error');
        try { ws.close(); } catch(_){}
      });
    } catch (e) {
      setWsStatus('error');
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    const r = reconnectRef.current;
    r.attempts = (r.attempts || 0) + 1;
    const delay = Math.min(30000, 500 * Math.pow(2, Math.min(r.attempts, 6)));
    if (r.timeout) clearTimeout(r.timeout);
    r.timeout = setTimeout(() => {
      setWsStatus('connecting');
      startWebsocket();
    }, delay);
  }

  function stopWebsocket() {
    if (reconnectRef.current.timeout) { 
      clearTimeout(reconnectRef.current.timeout); 
      reconnectRef.current.timeout = null; 
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    setWsStatus('disconnected');
  }

  useEffect(() => {
    if (WS_URL) startWebsocket();
    return () => stopWebsocket();
  }, [WS_URL]);

  function fmtUSD(n) {
    try { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch (e) { return Number(n).toFixed(2); }
  }

  function handleLogout() {
    fetch(`${import.meta.env.VITE_API_BASE || 'https://devsite-backend-production.up.railway.app'}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${getCookie('token')}` }
    }).then(() => {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
      if (onLogout && typeof onLogout === 'function') onLogout();
      else window.location.reload();
    }).catch(() => {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
      if (onLogout && typeof onLogout === 'function') onLogout();
      else window.location.reload();
    });
  }

  function formatTimeRemaining(seconds) {
    if (!seconds || seconds <= 0) return 'Ready!';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  const totalValue = me ? Number(me.usd_balance || 0) + (me.tokens || []).reduce((sum, t) => sum + (Number(t.amount || 0) * 0.01), 0) : 0;
  const coinsValue = me ? (me.tokens || []).reduce((sum, t) => sum + (Number(t.amount || 0) * 0.01), 0) : 0;

  useEffect(() => {
    if (typeof setOpen === 'function') setOpen(false);
  }, []);

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? 'visible' : ''}`}
        onClick={() => typeof setOpen === 'function' && setOpen(false)}
        style={{ display: window.innerWidth < 900 && open ? 'block' : 'none' }}
      />
      <aside className={`sidebar ${open ? 'open' : 'closed'}`} aria-expanded={open}>
        <div className="sidebar-header">
          <div className="logo">ZT</div>
          <div className="sidebar-brand">
            <div className="brand-title">RUGPLICATE</div>
            <div className="brand-subtitle">by zt01</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem active={view === 'dashboard'} label="Home" onClick={() => navigate('dashboard')} icon="home" />
          <NavItem active={view === 'market'} label="Market" onClick={() => navigate('market')} icon="market" />
          <NavItem active={view === 'hopium'} label="Hopium" onClick={() => navigate('hopium')} icon="hopium" />
          <NavItem active={view === 'gambling'} label="Gambling" onClick={() => navigate('gambling')} icon="gambling" />
          <NavItem active={view === 'leaderboard'} label="Leaderboard" onClick={() => navigate('leaderboard')} icon="leaderboard" />
          <NavItem active={view === 'portfolio'} label="Portfolio" onClick={() => navigate('portfolio')} icon="portfolio" />
          <NavItem active={view === 'news'} label="News" onClick={() => navigate('news')} icon="treemap" />
          <NavItem active={view === 'treemap'} label="Treemap" onClick={() => navigate('treemap')} icon="treemap" />
          <NavItem active={view === 'create'} label="Create coin" onClick={() => navigate('create')} icon="create" />
          <NavItem active={view === 'notifications'} label="Notifications" onClick={() => navigate('notifications')} icon="notification" badge={unreadCount > 0 ? unreadCount : null} />
          <NavItem active={view === 'settings'} label="Settings" onClick={() => navigate('settings')} icon="about" />
          {me && me.is_admin && (
            <NavItem active={view === 'admin'} label="Admin" onClick={() => navigate('admin')} icon="admin" />
          )}
        </nav>

        {dailyStatus && (
          <div className="daily-timer">
            <div className="timer-icon">⏰</div>
            <div className="timer-text">
              Next in {formatTimeRemaining(dailyStatus.seconds_until_next)}
            </div>
          </div>
        )}

        <div className="live-trades-section">
          <div className="section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor"/>
            </svg>
            <span>Live Trades</span>
            <a href="#" className="view-all">View All</a>
          </div>

          <div className="trades-list">
            {trades.length === 0 ? (
              <div className="trades-empty">No big trades yet...</div>
            ) : (
              trades.slice(0, 6).map((t, i) => (
                <div key={`${t.created_at}-${i}`} className="trade-item">
                  <div className="trade-header">
                    <span className="trade-coin">{t.coin}</span>
                    <span className={`trade-badge ${t.side}`}>{t.side}</span>
                  </div>
                  <div className="trade-amount">${Number(t.usdAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {me && (
          <div className="portfolio-summary">
            <div className="summary-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" fill="currentColor"/>
              </svg>
              <span>Portfolio</span>
            </div>

            <div className="summary-items">
              <div className="summary-item">
                <div className="item-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                  Total Value
                </div>
                <div className="item-value">${totalValue.toFixed(2)}</div>
              </div>

              <div className="summary-row">
                <div className="summary-item-small">
                  <div className="item-label-small">Cash:</div>
                  <div className="item-value-small">${me ? fmtUSD(me.usd_balance || 0) : '0.00'}</div>
                </div>
                <div className="summary-item-small">
                  <div className="item-label-small">Coins:</div>
                  <div className="item-value-small">${coinsValue.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {me && (
          <div className="sidebar-footer">
            <button className="user-profile" onClick={() => navigate('settings')}>
              <div className="user-avatar">{me.username ? me.username[0].toUpperCase() : '?'}</div>
              <div className="user-info">
                <div className="user-name">{me.username}</div>
              </div>
              <svg className="profile-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function NavItem({ active, label, onClick, icon, badge }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">
        <Icon name={icon} />
      </span>
      <span className="nav-label">{label}</span>
      {badge && <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}

function Icon({ name }) {
  switch (name) {
    case 'home':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      );
    case 'market':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor"/>
          <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor"/>
          <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor"/>
          <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/>
        </svg>
      );
    case 'hopium':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 12h4l3-9 4 18 3-9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      );
    case 'gambling':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      );
    case 'leaderboard':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 16v6m-8-6v6m4-10v10M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M12 2L4 12h16L12 2z" fill="currentColor"/>
        </svg>
      );
    case 'portfolio':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="6" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M3 10h18M8 3v4m8-4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'treemap':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10H3M12 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'create':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'notification':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      );
    case 'about':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 16v-4m0-4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'admin':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l9 4.5v5c0 5.25-3.375 10.125-9 11.5-5.625-1.375-9-6.25-9-11.5v-5L12 2z" fill="currentColor"/>
        </svg>
      );
    default:
      return null;
  }
}
