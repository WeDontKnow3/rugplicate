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

  useEffect(() => {
    fetchMe();
    fetchUnreadCount();
    function handleVisibility() {
      if (pollRef.current) clearInterval(pollRef.current);
      if (!document.hidden) {
        pollRef.current = setInterval(() => {
          fetchMe();
          fetchUnreadCount();
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
  const MAX_TRADES = 15;

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

  const statusColors = {
    connected: '#10b981',
    connecting: '#f59e0b',
    disconnected: '#ef4444',
    error: '#ef4444'
  };

  const statusLabels = {
    connected: 'Live',
    connecting: 'Connecting',
    disconnected: 'Offline',
    error: 'Error'
  };

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
        <div className="sidebar-top">
          <div className="logo">ZT</div>
          <div className="sidebar-title">
            <div className="header-title">RUGPLICATE</div>
            <div className="header-sub">by zt01</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem active={view === 'market'} label="Market" onClick={() => navigate('market')} icon="market" />
          <NavItem active={view === 'portfolio'} label="Portfolio" onClick={() => navigate('portfolio')} icon="portfolio" />
          <NavItem active={view === 'dashboard'} label="Dashboard" onClick={() => navigate('dashboard')} icon="dashboard" />
          <NavItem active={view === 'create'} label="Create Coin" onClick={() => navigate('create')} icon="create" />
          <NavItem active={view === 'news'} label="News" onClick={() => navigate('news')} icon="news" />
          <NavItem active={view === 'hopium'} label="Hopium" onClick={() => navigate('hopium')} icon="hopium" />
          <NavItem active={view === 'leaderboard'} label="Leaderboard" onClick={() => navigate('leaderboard')} icon="leaderboard" />
          <NavItem active={view === 'promos'} label="Promocodes" onClick={() => navigate('promos')} icon="promo" />
          <NavItem active={view === 'gambling'} label="Gambling" onClick={() => navigate('gambling')} icon="gambling" />
          <NavItem active={view === 'notifications'} label="Notifications" onClick={() => navigate('notifications')} icon="notification" badge={unreadCount > 0 ? unreadCount : null} />
          <NavItem active={view === 'apikeys'} label="API Keys" onClick={() => navigate('apikeys')} icon="apikey" />
          <NavItem active={view === 'settings'} label="Settings" onClick={() => navigate('settings')} icon="settings" />
          {me && me.is_admin && (
            <NavItem active={view === 'admin'} label="Admin" onClick={() => navigate('admin')} icon="admin" />
          )}
        </nav>

        <div className="live-trades-card">
          <div className="live-trades-header">
            <div className="live-trades-title">Live Trades ($1k+)</div>
            <div className="live-trades-status">
              <span className={`status-dot ${wsStatus}`}></span>
              {statusLabels[wsStatus]}
            </div>
          </div>

          <div className="live-trades-list">
            {trades.length === 0 ? (
              <div className="live-trades-empty">
                {wsStatus === 'connected' ? 'Waiting for trades...' : 'Connecting to live feed...'}
              </div>
            ) : (
              trades.map((t, i) => (
                <div key={`${t.created_at}-${i}`} className={`trade-item ${t.side}`}>
                  <div className="trade-coin">{t.coin}</div>
                  <div className="trade-side">{t.side}</div>
                  <div className="trade-amount">
                    ${Number(t.usdAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-bottom">
          {me ? (
            <>
              <div className="sidebar-user">
                <div className="user-avatar">{me.username ? me.username[0].toUpperCase() : '?'}</div>
                <div className="user-info">
                  <div className="user-name">{me.username}</div>
                  <div className="user-balance">
                    <span className={balanceAnim ? `balance-anim anim-${balanceAnim}` : ''}>
                      ${me ? fmtUSD(me.usd_balance || 0) : '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              <button className="logout-btn" onClick={handleLogout} aria-label="Logout">⎋ Logout</button>
            </>
          ) : (
            <div className="sidebar-login-msg">
              <p>{loading ? 'Loading...' : 'Login to trade and create coins'}</p>
            </div>
          )}
        </div>
      </aside>

      <style>{`
        .sidebar {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .sidebar-top {
          flex-shrink: 0;
          padding: 1rem;
        }

        .sidebar-nav {
          flex-shrink: 0;
          overflow-y: auto;
          max-height: 40vh;
          padding: 0.5rem 0;
        }

        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-nav::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.1);
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }

        .live-trades-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          margin: 10px;
          padding: 12px;
          background: rgba(148, 163, 184, 0.05);
          border-radius: 8px;
          min-height: 200px;
          max-height: 400px;
          overflow: hidden;
        }

        @media (max-height: 800px) {
          .live-trades-card {
            max-height: 250px;
            min-height: 150px;
          }
        }

        @media (max-height: 600px) {
          .live-trades-card {
            max-height: 180px;
            min-height: 120px;
          }
        }

        .live-trades-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-shrink: 0;
        }

        .live-trades-title {
          font-weight: 800;
          font-size: 13px;
        }

        .live-trades-status {
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-dot.connected {
          background-color: #10b981;
          animation: pulse 2s infinite;
        }

        .status-dot.connecting {
          background-color: #f59e0b;
        }

        .status-dot.disconnected,
        .status-dot.error {
          background-color: #ef4444;
        }

        .live-trades-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
          min-height: 0;
        }

        .live-trades-list::-webkit-scrollbar {
          width: 6px;
        }

        .live-trades-list::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.1);
          border-radius: 3px;
        }

        .live-trades-list::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }

        .live-trades-list::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }

        .live-trades-empty {
          text-align: center;
          padding: 20px 0;
          font-size: 13px;
          color: #94a3b8;
        }

        .trade-item {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 6px;
          border-left: 3px solid;
          animation: slideIn 0.3s ease-out;
          flex-shrink: 0;
        }

        .trade-item.buy {
          background-color: rgba(16, 185, 129, 0.08);
          border-left-color: #10b981;
        }

        .trade-item.sell {
          background-color: rgba(239, 68, 68, 0.08);
          border-left-color: #ef4444;
        }

        .trade-coin {
          min-width: 60px;
          font-weight: 700;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trade-side {
          flex: 1;
          font-size: 12px;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: 600;
        }

        .trade-amount {
          min-width: 70px;
          text-align: right;
          font-weight: 700;
          font-size: 13px;
        }

        .trade-item.buy .trade-amount {
          color: #10b981;
        }

        .trade-item.sell .trade-amount {
          color: #ef4444;
        }

        .sidebar-bottom {
          flex-shrink: 0;
          padding: 1rem;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @media (max-width: 900px) {
          .sidebar-nav {
            max-height: none;
          }
          
          .live-trades-card {
            max-height: 300px;
          }
        }
      `}</style>
    </>
  );
}

function NavItem({ active, label, onClick, icon, badge }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} style={{ position: 'relative' }}>
      <span className="nav-icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <span className="nav-label">{label}</span>
      {badge && (
        <span style={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: '#ef4444',
          color: 'white',
          borderRadius: '50%',
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

function Icon({ name }) {
  switch (name) {
    case 'market':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 4L20 20H4L12 4Z" fill="currentColor"/>
        </svg>
      );
    case 'portfolio':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="3" width="8" height="8" fill="currentColor"/>
          <rect x="13" y="3" width="8" height="8" fill="currentColor" opacity="0.85"/>
          <rect x="3" y="13" width="8" height="8" fill="currentColor" opacity="0.7"/>
          <rect x="13" y="13" width="8" height="8" fill="currentColor" opacity="0.55"/>
        </svg>
      );
    case 'dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="4" width="18" height="3" fill="currentColor"/>
          <rect x="3" y="10.5" width="18" height="3" fill="currentColor"/>
          <rect x="3" y="17" width="18" height="3" fill="currentColor"/>
        </svg>
      );
    case 'create':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M11 11V4h2v7h7v2h-7v7h-2v-7H4v-2h7z" fill="currentColor"/>
        </svg>
      );
    case 'news':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
          <line x1="6" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="6" y1="16" x2="18" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'hopium':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
        </svg>
      );
    case 'leaderboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 2l2.6 6.6L21 9.3l-5 3.9L17 21l-5-3.3L7 21l1-7.8-5-3.9 6.4-.7L12 2z" fill="currentColor"/>
        </svg>
      );
    case 'promo':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M21 8.5L16 3.5L10.5 9L9 7.5L3 13.5L4.5 15L9 10.5L10.5 12L16.5 6L19 8.5V8.5C19.5523 8.5 20 8.94772 20 9.5V14.5C20 15.0523 19.5523 15.5 19 15.5H9C8.44772 15.5 8 15.0523 8 14.5V13L6 15V16.5C6 17.6046 6.89543 18.5 8 18.5H19C20.1046 18.5 21 17.6046 21 16.5V8.5Z" fill="currentColor"/>
          <circle cx="16" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      );
    case 'gambling':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none"/>
          <circle cx="8.5" cy="11.5" r="1.2" fill="currentColor"/>
          <rect x="11" y="9" width="6" height="4" rx="0.8" fill="currentColor"/>
        </svg>
      );
    case 'notification':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 2C11.172 2 10.5 2.672 10.5 3.5V4.19C8.13 4.86 6.5 7.03 6.5 9.5V14.5L4.5 16.5V17.5H19.5V16.5L17.5 14.5V9.5C17.5 7.03 15.87 4.86 13.5 4.19V3.5C13.5 2.672 12.828 2 12 2ZM10 19.5C10 20.605 10.895 21.5 12 21.5C13.105 21.5 14 20.605 14 19.5H10Z" fill="currentColor"/>
        </svg>
      );
    case 'apikey':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14ZM12.6 10C11.8 7.7 9.6 6 7 6C3.7 6 1 8.7 1 12C1 15.3 3.7 18 7 18C9.6 18 11.8 16.3 12.6 14H16V18H20V14H23V10H12.6Z" fill="currentColor"/>
        </svg>
      );
    case 'settings':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5z" fill="currentColor"/>
          <path d="M19.4 13.3a7.9 7.9 0 0 0 .1-2.6l2.1-1.6-2-3.5-2.5.7a8 8 0 0 0-2.2-1.3L14.4 2h-4.8l-.5 2.9a8 8 0 0 0-2.2 1.3l-2.5-.7-2 3.5L4.5 10.7a7.9 7.9 0 0 0 .1 2.6L2.6 14.9l2 3.5 2.5-.7c.7.5 1.5.9 2.2 1.3L9.6 22h4.8l.5-2.9c.8-.4 1.5-.8 2.2-1.3l2.5.7 2-3.5-2.1-1.6z" fill="currentColor" opacity="0.6"/>
        </svg>
      );
    case 'admin':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 2l2 4 4 .5-3 2 1 4-4-2-4 2 1-4-3-2 4-.5L12 2z" fill="currentColor"/>
        </svg>
      );
    default:
      return null;
  }
}
