import React, { useEffect, useState, useRef } from 'react';
import * as api from '../api';

export default function Sidebar({ view, onNavigate, onLogout, open, setOpen }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balanceAnim, setBalanceAnim] = useState(null);
  const prevBalanceRef = useRef(null);
  const pollRef = useRef(null);

  const [trades, setTrades] = useState([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timeout: null });

  const [showApiPanel, setShowApiPanel] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [apiMsg, setApiMsg] = useState('');

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
    } finally {
      setLoading(false);
    }
  }

  async function loadApiKeys() {
    try {
      const res = await api.listApiKeys();
      if (res && res.keys) setApiKeys(res.keys);
    } catch (err) {
      console.error('failed to load api keys', err);
    }
  }

  async function handleCreateApiKey(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setApiMsg('');
    try {
      const res = await api.createApiKey(newKeyName.trim());
      if (res && res.ok) {
        setApiMsg(`API Key created: ${res.key.api_key}`);
        setNewKeyName('');
        await loadApiKeys();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to create API key');
      }
    } catch (err) {
      setApiMsg('Error creating API key');
    }
    setCreatingKey(false);
  }

  async function handleDeleteApiKey(id) {
    if (!window.confirm('Delete this API key? This cannot be undone.')) return;
    try {
      const res = await api.deleteApiKey(id);
      if (res && res.ok) {
        setApiMsg('API key deleted');
        await loadApiKeys();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to delete key');
      }
    } catch (err) {
      setApiMsg('Error deleting API key');
    }
  }

  async function handleResetApiKey(id) {
    if (!window.confirm('Reset request counter for this API key?')) return;
    try {
      const res = await api.resetApiKeyUsage(id);
      if (res && res.ok) {
        setApiMsg('Request counter reset');
        await loadApiKeys();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to reset');
      }
    } catch (err) {
      setApiMsg('Error resetting key');
    }
  }

  useEffect(() => {
    fetchMe();
    loadApiKeys();
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
  }, []);

  const WS_URL = import.meta.env.VITE_WS_URL || "wss://devsite-backend-production.up.railway.app/ws";
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
      });
      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data)
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
          }
        } catch (e) {
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
  }, [WS_URL]);

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
          <NavItem active={view === 'leaderboard'} label="Leaderboard" onClick={() => navigate('leaderboard')} icon="leaderboard" />
          <NavItem active={view === 'promos'} label="Promocodes" onClick={() => navigate('promos')} icon="promo" />
          <NavItem active={view === 'gambling'} label="Gambling" onClick={() => navigate('gambling')} icon="gambling" />
          <NavItem active={view === 'settings'} label="Settings" onClick={() => navigate('settings')} icon="settings" />
          {me && me.is_admin && (
            <NavItem active={view === 'admin'} label="Admin" onClick={() => navigate('admin')} icon="admin" />
          )}
        </nav>

        <div className="live-trades-card" style={{ marginTop: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Live Trades (offline)</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{WS_URL ? 'disconnected' : 'no feed'}</div>
          </div>

          {WS_URL ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trades.length === 0 ? (
                <div className="muted">websocket not working rn lol</div>
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
                <button 
                  className="api-key-btn" 
                  onClick={() => setShowApiPanel(!showApiPanel)}
                  title="API Keys"
                  style={{ 
                    marginLeft: 'auto',
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 16
                  }}
                >
                  🔑
                </button>
              </div>

              {showApiPanel && (
                <div style={{ 
                  marginTop: 12,
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  maxHeight: 300,
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>API Keys</h4>
                    <button 
                      onClick={() => setShowApiPanel(false)}
                      style={{ 
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: 0
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleCreateApiKey} style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="Key name"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      style={{ 
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 12,
                        marginBottom: 8,
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 4,
                        color: 'white'
                      }}
                      disabled={creatingKey}
                    />
                    <button
                      type="submit"
                      disabled={creatingKey || !newKeyName.trim()}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: 12,
                        background: 'rgba(59, 130, 246, 0.5)',
                        border: 'none',
                        borderRadius: 4,
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {creatingKey ? 'Creating...' : 'Create API Key'}
                    </button>
                  </form>

                  {apiMsg && (
                    <div style={{ 
                      fontSize: 11,
                      padding: 8,
                      background: apiMsg.includes('created') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: apiMsg.includes('created') ? '#86efac' : '#fda4af',
                      borderRadius: 4,
                      marginBottom: 12,
                      wordBreak: 'break-all'
                    }}>
                      {apiMsg}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {apiKeys.length === 0 && (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                        No API keys yet
                      </div>
                    )}
                    {apiKeys.map(key => (
                      <div 
                        key={key.id}
                        style={{
                          padding: 8,
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 4,
                          fontSize: 11
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{key.name}</div>
                        <div style={{ color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' }}>
                          {key.api_key}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ color: '#94a3b8' }}>
                            {key.requests_used}/{key.requests_limit} requests
                          </span>
                          <span style={{ 
                            fontSize: 10,
                            padding: '2px 6px',
                            background: key.active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: key.active ? '#86efac' : '#fda4af',
                            borderRadius: 3
                          }}>
                            {key.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => handleResetApiKey(key.id)}
                            style={{
                              flex: 1,
                              padding: '4px',
                              fontSize: 10,
                              background: 'rgba(59, 130, 246, 0.3)',
                              border: 'none',
                              borderRadius: 3,
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => handleDeleteApiKey(key.id)}
                            style={{
                              flex: 1,
                              padding: '4px',
                              fontSize: 10,
                              background: 'rgba(239, 68, 68, 0.3)',
                              border: 'none',
                              borderRadius: 3,
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ 
                    marginTop: 12,
                    padding: 8,
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: 4,
                    fontSize: 10,
                    color: '#94a3b8'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>API Endpoint:</div>
                    <code style={{ color: '#bfc7d6' }}>GET /api/v1/coin/:symbol</code>
                    <div style={{ marginTop: 4 }}>
                      Use header: <code style={{ color: '#bfc7d6' }}>X-API-Key: your_key</code>
                    </div>
                  </div>
                </div>
              )}

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

function NavItem({ active, label, onClick, icon }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <span className="nav-label">{label}</span>
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
