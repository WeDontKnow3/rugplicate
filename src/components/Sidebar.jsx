import React, { useEffect, useState, useRef } from 'react';
import * as api from '../api';

/**
 * Sidebar.jsx (EN) — with Live Trades panel
 *
 * Adds a small live trades window between the admin/settings nav item and the tokens count.
 * The live feed uses a WebSocket URL from `import.meta.env.VITE_WS_URL` (recommended).
 * If VITE_WS_URL is not set, the panel will show a disabled message.
 *
 * Expected incoming websocket message format (JSON):
 * { type: 'trade', coin: 'ABC', side: 'buy'|'sell', tokenAmount: 12345, usdAmount: 12.34, price: 0.000001, created_at: 'ISO' }
 */

export default function Sidebar({ view, onNavigate, onLogout, open, setOpen }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balanceAnim, setBalanceAnim] = useState(null); // 'up'|'down'|null
  const prevBalanceRef = useRef(null);
  const pollRef = useRef(null);

  // live trades state
  const [trades, setTrades] = useState([]); // newest first
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
      const res = await api.getMe();
      if (res && res.user) {
        const nowBal = Number(res.user.usd_balance || 0);
        const prev = prevBalanceRef.current;
        if (prev != null && nowBal !== prev) {
          setBalanceAnim(nowBal > prev ? 'up' : 'down');
          setTimeout(() => setBalanceAnim(null), 1200);
        }
        prevBalanceRef.current = nowBal;
        setMe(res.user);
      } else {
        setMe(null);
      }
    } catch (err) {
      // silently ignore network errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial load
    fetchMe();

    // poll while page is visible
    function handleVisibility() {
      if (pollRef.current) clearInterval(pollRef.current);
      if (!document.hidden) pollRef.current = setInterval(fetchMe, 5000);
    }

    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopWebsocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- WebSocket live trades logic ----------------
  const WS_URL = import.meta.env.VITE_WS_URL || "ws://devsite-backend-production.up.railway.app";
  const MAX_TRADES = 6;

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
        reconnectRef.current.attempts = 0;
        // optionally subscribe to a channel (protocol depends on your server)
        // ws.send(JSON.stringify({ action: 'subscribe', channel: 'trades' }));
      });

      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // accept either direct trade objects or messages with type
          if (data && (data.type === 'trade' || data.event === 'trade')) {
            const t = {
              coin: data.coin || data.symbol || data.token || 'UNKNOWN',
              side: (data.side === 'sell' || data.type === 'sell') ? 'sell' : 'buy',
              tokenAmount: Number(data.tokenAmount || data.token_amount || data.amount || 0),
              usdAmount: Number(data.usdAmount || data.usd_amount || data.usd || 0),
              price: Number(data.price || 0),
              created_at: data.created_at || data.ts || new Date().toISOString()
            };
            pushTrade(t);
          } else if (data && data.type === 'pong') {
            // ignore
          }
        } catch (e) {
          // ignore malformed messages
          console.warn('ws parse error', e);
        }
      });

      ws.addEventListener('close', () => scheduleReconnect());
      ws.addEventListener('error', () => {
        try { ws.close(); } catch(_){}
      });
    } catch (e) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    // exponential backoff up to a limit
    const r = reconnectRef.current;
    r.attempts = (r.attempts || 0) + 1;
    const delay = Math.min(30000, 500 * Math.pow(2, Math.min(r.attempts, 6)) );
    if (r.timeout) clearTimeout(r.timeout);
    r.timeout = setTimeout(() => {
      startWebsocket();
    }, delay);
  }

  function stopWebsocket() {
    if (reconnectRef.current.timeout) { clearTimeout(reconnectRef.current.timeout); reconnectRef.current.timeout = null; }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
  }

  useEffect(() => {
    if (WS_URL) startWebsocket();
    return () => stopWebsocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WS_URL]);

  // ---------------- end websocket ----------------

  const tokensCount = (me && Array.isArray(me.tokens)) ? me.tokens.reduce((s, t) => s + Number(t.amount || 0), 0) : 0;

  function fmtUSD(n) {
    try { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch (e) { return Number(n).toFixed(2); }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    if (onLogout && typeof onLogout === 'function') onLogout();
    else window.location.reload();
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString();
    } catch (e) { return iso; }
  }

  return (
    <>
      {/* Mobile overlay when sidebar is open */}
      <div
        className={`sidebar-overlay ${open ? 'visible' : ''}`}
        onClick={() => typeof setOpen === 'function' && setOpen(false)}
        style={{ display: window.innerWidth < 900 && open ? 'block' : 'none' }}
      />

      <aside className={`sidebar ${open ? 'open' : 'closed'}`} aria-expanded={open}>
        <div className="sidebar-top">
          <div className="logo">CS</div>
          <div className="sidebar-title">
            <div className="header-title">CoinSim</div>
            <div className="header-sub">AMM Simulator</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem active={view === 'market'} label="Market" onClick={() => navigate('market')} icon={'▲'} />
          <NavItem active={view === 'portfolio'} label="Portfolio" onClick={() => navigate('portfolio')} icon={'▣'} />
          <NavItem active={view === 'dashboard'} label="Dashboard" onClick={() => navigate('dashboard')} icon={'≡'} />
          <NavItem active={view === 'create'} label="Create Coin" onClick={() => navigate('create')} icon={'＋'} />
          <NavItem active={view === 'leaderboard'} label="Leaderboard" onClick={() => navigate('leaderboard')} icon={'★'} />
          <NavItem active={view === 'settings'} label="Settings" onClick={() => navigate('settings')} icon={'⚙'} />

          {me && me.is_admin && (
            <NavItem active={view === 'admin'} label="Admin" onClick={() => navigate('admin')} icon={'♛'} className="admin-item" />
          )}
        </nav>

        {/* ---------------- Live trades panel ---------------- */}
        <div className="live-trades-card" style={{ marginTop: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Live Trades</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{WS_URL ? 'connected' : 'no feed'}</div>
          </div>

          {WS_URL ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trades.length === 0 ? (
                <div className="muted">Waiting for trades...</div>
              ) : (
                trades.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 72, fontWeight: 700 }}>{t.coin}</div>
                    <div style={{ flex: 1, fontSize: 13, color: '#94a3b8' }}>{t.side === 'sell' ? 'sell' : 'buy'} • {Number(t.tokenAmount).toLocaleString()}</div>
                    <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700 }}>{t.price ? `$${Number(t.price).toFixed(6)}` : `$${Number(t.usdAmount || 0).toFixed(2)}`}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="muted">No websocket configured. Set VITE_WS_URL to enable live trades.</div>
          )}
        </div>
        {/* ---------------- end live trades ---------------- */}

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
                  {me.is_admin && <div className="user-badge">ADMIN</div>}
                </div>
              </div>

              <div className="tokens-info">
                <div className="tokens-label">Tokens</div>
                <div className="tokens-value">{Intl.NumberFormat().format(tokensCount)}</div>
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
    </>
  );
}

function NavItem({ active, label, onClick, icon, className = '' }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''} ${className}`} onClick={onClick}>
      <span className="nav-icon" aria-hidden>{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}
